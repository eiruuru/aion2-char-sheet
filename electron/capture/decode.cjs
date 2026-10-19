const fs = require("fs")
const path = require("path")
const zlib = require("zlib")

const NPCAP_FILES = [
  "C:\\Windows\\System32\\Npcap\\wpcap.dll",
  "C:\\Windows\\System32\\wpcap.dll",
]

const RING_LIMIT = 24
const SAMPLE_BYTES = 128
const SCAN_BYTES = 256
const ODYLE_CAPS = new Set([560, 840])

function npcapPresent(exists = fs.existsSync) {
  return NPCAP_FILES.some((file) => {
    try {
      return Boolean(exists(file))
    } catch {
      return false
    }
  })
}

function readInt(buf, offset, width) {
  if (offset < 0 || offset + width > buf.length) return null
  if (width === 2) return buf.readUInt16LE(offset)
  if (width === 4) return buf.readUInt32LE(offset)
  return null
}

function proposeField(before, after, direction) {
  const len = Math.min(before.length, after.length)
  let best = null
  for (const width of [4, 2]) {
    for (let offset = 0; offset + width <= len; offset += 1) {
      const left = readInt(before, offset, width)
      const right = readInt(after, offset, width)
      if (left == null || right == null || left === right) continue
      const delta = right - left
      if (direction === "increase" && delta <= 0) continue
      if (direction === "decrease" && delta >= 0) continue
      if (Math.abs(delta) > 100000) continue
      const score = Math.abs(delta) + (offset % width === 0 ? 0 : 1000)
      if (!best || score < best.score) best = { offset, width, before: left, after: right, score }
    }
  }
  if (!best) return null
  return { offset: best.offset, width: best.width, before: best.before, after: best.after }
}

function emptyLayout() {
  return {}
}

function confirmField(hits, kind, field) {
  const key = `${kind}:${field.offset}:${field.width}`
  const count = (hits[key] ?? 0) + 1
  hits[key] = count
  return count >= 2 ? { offset: field.offset, width: field.width } : null
}

function applyConfirmed(layout, kind, field) {
  if (!field) return layout
  if (kind === "odyle") return { ...layout, odyle: field }
  if (kind === "pet") return { ...layout, petSouls: field }
  if (kind === "pet-level") return { ...layout, petLevel: field }
  return layout
}

function saneOdyle(value) {
  return value != null && value >= 0 && value <= 2000
}

function saneSouls(value) {
  return value != null && value >= 0 && value <= 1000000
}

function saneLevel(value) {
  return value != null && value >= 1 && value <= 200
}

function decodePacket(buf, layout) {
  const found = {}
  if (layout.odyle) {
    const amount = readInt(buf, layout.odyle.offset, layout.odyle.width)
    if (saneOdyle(amount)) found.odyle = amount
  }
  if (layout.petSouls) {
    const souls = readInt(buf, layout.petSouls.offset, layout.petSouls.width)
    if (saneSouls(souls)) found.souls = souls
  }
  if (layout.petLevel) {
    const level = readInt(buf, layout.petLevel.offset, layout.petLevel.width)
    if (saneLevel(level)) found.level = level
  }
  if (layout.petSoulsToNext) {
    const soulsToNext = readInt(buf, layout.petSoulsToNext.offset, layout.petSoulsToNext.width)
    if (saneSouls(soulsToNext)) found.soulsToNext = soulsToNext
  }
  return found
}

function cleanName(text) {
  const trimmed = String(text || "").replace(/\s+/g, " ").trim()
  if (trimmed.length < 3 || trimmed.length > 40) return null
  if (!/^[A-Za-z][A-Za-z' -]*[A-Za-z]$/.test(trimmed)) return null
  if (!/[A-Z]/.test(trimmed)) return null
  return trimmed
}

function isLikelyMobName(text) {
  const name = String(text || "").trim()
  if (name.replace(/ /g, "").length < 5) return false
  const words = name.split(" ")
  if (words.some((word) => /^(all|welcome|the|you|player|system)$/i.test(word))) return false
  return words.every((word) => /^[A-Z][a-z]+(?:'[a-z]+)?$/.test(word))
}

function pushName(found, seen, text) {
  const name = cleanName(text)
  if (!name) return
  const key = name.toLowerCase()
  if (seen.has(key)) return
  seen.add(key)
  found.push(name)
}

function extractNames(buf, scanLimit = SCAN_BYTES) {
  if (!buf || typeof buf.length !== "number") return []
  const limit = Math.min(buf.length, scanLimit)
  const found = []
  const seen = new Set()
  let run = ""
  for (let i = 0; i < limit; i += 1) {
    const code = buf[i]
    if (code >= 32 && code < 127 && /[A-Za-z' -]/.test(String.fromCharCode(code))) {
      run += String.fromCharCode(code)
    } else {
      pushName(found, seen, run)
      run = ""
    }
  }
  pushName(found, seen, run)
  let wide = ""
  for (let i = 0; i + 1 < limit; i += 2) {
    const code = buf[i]
    const high = buf[i + 1]
    if (high === 0 && code >= 32 && code < 127 && /[A-Za-z' -]/.test(String.fromCharCode(code))) {
      wide += String.fromCharCode(code)
    } else {
      pushName(found, seen, wide)
      wide = ""
    }
  }
  pushName(found, seen, wide)
  return found
}

function matchRosterName(names, roster) {
  const list = (roster || []).filter((entry) => typeof entry === "string" && entry.trim())
  for (const name of names || []) {
    const hit = list.find((entry) => entry.toLowerCase() === String(name).toLowerCase())
    if (hit) return hit
  }
  return null
}

function findOdyleTotal(buf) {
  if (!buf || typeof buf.length !== "number") return null
  const limit = Math.min(buf.length, 8192)
  const width = 4
  for (let offset = 0; offset + width <= limit; offset += width) {
    const value = readInt(buf, offset, width)
    if (!ODYLE_CAPS.has(value)) continue
    for (const neighbor of [offset - width, offset + width]) {
      const amount = readInt(buf, neighbor, width)
      if (amount == null || amount < 0 || amount > 840 || ODYLE_CAPS.has(amount)) continue
      return amount
    }
  }
  return null
}

function isVirtualAdapter(device) {
  const text = `${device?.name || ""} ${device?.description || ""}`.toLowerCase()
  if (!text.trim()) return true
  return /loopback|bluetooth|virtual|hyper-v|wsl|vbox|vmware|wan miniport|tunnel|pseudo|teredo|isatap/.test(text)
}

function realAdapters(devices) {
  return (devices || []).filter((device) => device && typeof device.name === "string" && device.name && !isVirtualAdapter(device))
}

const STREAM_CAP = 256 * 1024
const LOOKBACK = 1536

function parseFarmableNames(source) {
  const names = []
  const re = /\["([^"]+)", "([^"]+)"\]/g
  let match = re.exec(source)
  while (match) {
    if (match[1] !== "Special") names.push(match[2])
    match = re.exec(source)
  }
  return names
}

function seqAdd(seq, count) {
  return (seq + count) >>> 0
}

function seqBefore(left, right) {
  return ((left - right) | 0) < 0
}

function decodeLz4Block(src, maxOut = 8192) {
  if (!src || src.length < 2) return null
  const out = Buffer.alloc(maxOut)
  let input = 0
  let output = 0
  while (input < src.length) {
    const token = src[input]
    input += 1
    let literals = token >> 4
    if (literals === 15) {
      let extra = 255
      while (extra === 255) {
        if (input >= src.length) return null
        extra = src[input]
        input += 1
        literals += extra
        if (literals > maxOut) return null
      }
    }
    if (literals > 0) {
      if (input + literals > src.length || output + literals > maxOut) return null
      src.copy(out, output, input, input + literals)
      input += literals
      output += literals
    }
    if (input >= src.length) break
    if (input + 2 > src.length) return null
    const offset = src.readUInt16LE(input)
    input += 2
    if (offset === 0 || offset > output) return null
    let matchLength = (token & 0x0f) + 4
    if ((token & 0x0f) === 15) {
      let extra = 255
      while (extra === 255) {
        if (input >= src.length) return null
        extra = src[input]
        input += 1
        matchLength += extra
        if (matchLength > maxOut) return null
      }
    }
    if (output + matchLength > maxOut) return null
    for (let i = 0; i < matchLength; i += 1) out[output + i] = out[output - offset + i]
    output += matchLength
  }
  if (output < 8) return null
  return out.subarray(0, output)
}

function wordAt(hay, word, from) {
  let at = hay.indexOf(word, from)
  while (at >= 0) {
    const before = at === 0 || /[^a-z0-9]/.test(hay[at - 1])
    const after = at + word.length >= hay.length || /[^a-z0-9]/.test(hay[at + word.length])
    if (before && after) return at
    at = hay.indexOf(word, at + 1)
  }
  return -1
}

function matchCatalogName(text, names) {
  const hay = String(text || "").toLowerCase()
  if (!hay) return null
  let best = null
  for (const name of names || []) {
    const words = String(name).toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) continue
    let from = 0
    let found = true
    for (const word of words) {
      const at = wordAt(hay, word, from)
      if (at < 0) {
        found = false
        break
      }
      from = at + word.length
    }
    if (!found) continue
    if (!best || words.length > best.words || (words.length === best.words && name.length > best.name.length)) {
      best = { name, words: words.length }
    }
  }
  return best ? best.name : null
}

function readableText(buf) {
  const latin = buf.toString("latin1")
  let wide = ""
  for (let i = 0; i + 1 < buf.length; i += 2) {
    const code = buf[i]
    wide += buf[i + 1] === 0 && code >= 32 && code < 127 ? String.fromCharCode(code) : "\n"
  }
  let odd = ""
  for (let i = 1; i + 1 < buf.length; i += 2) {
    const code = buf[i]
    odd += buf[i + 1] === 0 && code >= 32 && code < 127 ? String.fromCharCode(code) : "\n"
  }
  let be = ""
  for (let i = 0; i + 1 < buf.length; i += 2) {
    const code = buf[i + 1]
    be += buf[i] === 0 && code >= 32 && code < 127 ? String.fromCharCode(code) : "\n"
  }
  return `${latin}\n${wide}\n${odd}\n${be}`
}

function tryInflate(buf) {
  if (!buf || buf.length < 8 || buf[0] !== 0x78) return null
  try {
    const out = zlib.inflateSync(buf, { maxOutputLength: 8192 })
    return out && out.length >= 8 ? out : null
  } catch {
    return null
  }
}

function readVarint(buf, offset) {
  let value = 0
  let shift = 0
  let count = 0
  while (offset + count < buf.length && count < 5) {
    const byte = buf[offset + count]
    count += 1
    value |= (byte & 0x7f) << shift
    if ((byte & 0x80) === 0) return { value, length: count }
    shift += 7
    if (shift >= 32) return null
  }
  return null
}

function transportSize(value, width) {
  const size = value + width - 4
  if (!Number.isFinite(size) || size < 3 || size > 65535) return null
  return size
}

function decodeLz4Exact(src, expected) {
  if (!src || expected < 8 || expected > 5000000) return null
  const out = decodeLz4Block(src, expected)
  if (!out || out.length !== expected) return null
  return out
}

function unpackBundle(payload) {
  if (!payload || payload.length < 7 || payload[0] !== 0xff || payload[1] !== 0xff) return null
  const expected = payload.readUInt32LE(2)
  return decodeLz4Exact(payload.subarray(6), expected)
}

// Mob codes are the published DBAion2 DPS npc ids, commit 55931aa, kept only where the English name matches a farmable pet in this app.
let mobCodes = null
function farmMobCodes() {
  if (mobCodes) return mobCodes
  try {
    mobCodes = JSON.parse(fs.readFileSync(path.join(__dirname, "mob-codes.json"), "utf8"))
  } catch {
    mobCodes = {}
  }
  return mobCodes
}

function markerIndex(buf, needle) {
  const at = buf.indexOf(Buffer.from(needle))
  return at
}

function mobCodeOf(payload) {
  const marked = markerIndex(payload, [0x00, 0x40, 0x02])
  const fallback = markerIndex(payload, [0x00, 0x00, 0x02])
  const at = marked >= 3 ? marked : fallback
  if (at < 3) return null
  return payload[at - 3] | (payload[at - 2] << 8) | (payload[at - 1] << 16)
}

function foldActor(id) {
  return id > 1000000 ? (id & 0x3fff) | 0x4000 : id
}

function sameActor(left, right) {
  if (left == null || right == null) return false
  if (left === right) return true
  const small = (id) => (id > 1000000 ? id & 0x3fff : id)
  return small(left) === small(right)
}

function creditOnce(state, found, id, pet) {
  if (!pet || !id) return
  if (!state.credited) state.credited = new Set()
  if (state.credited.has(id)) return
  state.credited.add(id)
  if (state.credited.size > 4000) {
    const oldest = state.credited.keys().next().value
    if (oldest != null) state.credited.delete(oldest)
  }
  found.push(pet)
}

function rememberMob(state, id, pet, persist = true) {
  state.mobs.set(id, pet)
  const folded = foldActor(id)
  if (folded !== id) state.mobs.set(folded, pet)
  if (state.mobs.size > 4000) {
    const oldest = state.mobs.keys().next().value
    if (oldest != null) state.mobs.delete(oldest)
  }
  if (!persist || !state.mobFile) return
  if (!state.mobTimes) state.mobTimes = new Map()
  state.mobTimes.set(id, Date.now())
  const now = Date.now()
  const rows = []
  for (const [mobId, at] of state.mobTimes) {
    if (now - at > 10 * 60 * 1000) continue
    const name = state.mobs.get(mobId)
    if (name) rows.push({ id: mobId, pet: name, at })
  }
  try {
    fs.mkdirSync(path.dirname(state.mobFile), { recursive: true })
    fs.writeFileSync(state.mobFile, JSON.stringify(rows))
  } catch {
    // The next spawn writes the names again.
  }
}

function loadRememberedMobs(state) {
  if (!state.mobFile) return
  try {
    const rows = JSON.parse(fs.readFileSync(state.mobFile, "utf8"))
    const now = Date.now()
    for (const row of rows) {
      if (!row || typeof row.id !== "number" || typeof row.pet !== "string") continue
      if (now - row.at > 10 * 60 * 1000) continue
      rememberMob(state, row.id, row.pet, false)
      if (!state.mobTimes) state.mobTimes = new Map()
      state.mobTimes.set(row.id, row.at)
    }
  } catch {
    // A missing file means this is the first fight since the names were saved.
  }
}

function lookupMob(state, id) {
  return state.mobs.get(id) || state.mobs.get(foldActor(id)) || null
}

function skillTarget(payload, state) {
  const attacker = readVarint(payload, 2)
  if (!attacker || !state) return null
  let cursor = 2 + attacker.length
  let marker = false
  for (let step = 0; step < 12 && cursor < payload.length; step += 1) {
    const value = readVarint(payload, cursor)
    if (!value) return null
    cursor += value.length
    if (!marker) {
      if (value.value === 1) marker = true
      continue
    }
    if (lookupMob(state, value.value)) return value.value
  }
  return null
}

function noteCombatLink(payload, state) {
  if (!state.selfId || !state.struck || !payload || payload.length < 4) return
  if (payload[0] !== 0x02 || payload[1] !== 0x38) return
  const attacker = readVarint(payload, 2)
  if (!attacker) return
  if (!sameActor(attacker.value, state.selfId) && !mineHas(state, attacker.value)) return
  const target = skillTarget(payload, state)
  const pet = target ? lookupMob(state, target) : null
  if (!pet || state.struck.has(target)) return
  state.struck.set(target, pet)
  if (state.struck.size > 4000) {
    const oldest = state.struck.keys().next().value
    if (oldest != null) state.struck.delete(oldest)
  }
}

function noteOwnHit(payload, state) {
  if (!state.selfId || !state.struck) return
  const attacker = readVarint(payload, 2)
  if (!attacker || attacker.value <= 0) return
  if (!sameActor(attacker.value, state.selfId) && !mineHas(state, attacker.value)) return
  const skill = readVarint(payload, 2 + attacker.length)
  if (!skill) return
  const gap = readVarint(payload, 2 + attacker.length + skill.length)
  if (!gap) return
  const target = readVarint(payload, 2 + attacker.length + skill.length + gap.length)
  if (!target || target.value <= 0 || state.struck.has(target.value)) return
  const pet = lookupMob(state, target.value) || ""
  state.struck.set(target.value, pet)
  if (state.struck.size > 4000) {
    const oldest = state.struck.keys().next().value
    if (oldest != null) state.struck.delete(oldest)
  }
  if (!pet) return
  pushTrace(state, { kind: "hit", target: target.value, pet, attacker: attacker.value, selfId: state.selfId || 0, hypothesisId: "C" })
}

function rememberMine(state, id) {
  state.mine.add(id)
  const folded = foldActor(id)
  if (folded !== id) state.mine.add(folded)
}

function mineHas(state, id) {
  return state.mine.has(id) || state.mine.has(foldActor(id))
}

function adoptSummons(state) {
  if (!state.selfId) return
  for (const [summon, owner] of state.owners) {
    if (sameActor(owner, state.selfId)) rememberMine(state, summon)
  }
}

function pushTrace(state, trace) {
  state.trace = trace
  if (!state.traces) state.traces = []
  if (state.traces.length < 40) state.traces.push(trace)
}

function learnSelf(state, id) {
  if (!id) return
  if (!state.selfId) state.selfId = id
  adoptSummons(state)
}

function summonOwner(payload) {
  const key = markerIndex(payload, [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])
  if (key < 0) return null
  const mark = markerIndex(payload.subarray(key + 8), [0x07, 0x02, 0x06])
  if (mark < 0) return null
  const at = key + 8 + mark + 3
  if (at + 2 > payload.length) return null
  const owner = payload[at] | (payload[at + 1] << 8)
  if (owner < 1 || owner > 999999) return null
  return owner
}

function noteMobPayload(payload, state, names) {
  const text = payloadName(payload, names)
  const found = []
  if (!payload || payload.length < 3 || !state) return { names: found, marker: text.marker }
  const opcode = (payload[0] << 8) | payload[1]
  if (opcode === 0x3336) state.profiles = (state.profiles || 0) + 1
  if (opcode === 0x4136) state.spawns = (state.spawns || 0) + 1
  if (opcode === 0x4236) state.deaths = (state.deaths || 0) + 1
  if (payload.includes(Buffer.from([0x3c, 0x0e, 0x20]))) state.sparkie = (state.sparkie || 0) + 1
  const opKey = payload.subarray(0, 2).toString("hex")
  if (opcode === 0x3336) {
    const actor = readVarint(payload, 2)
    if (actor && actor.value > 0) learnSelf(state, actor.value)
  } else if (opcode === 0x008d) {
    const actor = readVarint(payload, 2)
    const at = actor ? 2 + actor.length : 0
    if (actor && actor.value > 0 && payload[at] === 1 && payload[at + 1] === 1) {
      state.own = (state.own || 0) + 1
      learnSelf(state, actor.value)
    }
  } else if (opcode === 0x4136) {
    const summon = readVarint(payload, 2)
    const code = mobCodeOf(payload)
    const pet = code == null ? null : farmMobCodes()[String(code)]
    if (summon && summon.value > 0 && pet) {
      state.farm = (state.farm || 0) + 1
      rememberMob(state, summon.value, pet)
      pushTrace(state, { kind: "spawn", summon: summon.value, code: code || 0, pet, selfId: state.selfId || 0, hypothesisId: "D" })
      if (state.struck?.has(summon.value) && !state.struck.get(summon.value)) state.struck.set(summon.value, pet)
      const pendingAt = state.pendingDeaths?.get(summon.value) || 0
      if (pendingAt && Date.now() - pendingAt < 30000) {
        state.pendingDeaths.delete(summon.value)
        creditOnce(state, found, summon.value, pet)
        pushTrace(state, { kind: "late", summon: summon.value, pet, selfId: state.selfId || 0, hypothesisId: "F" })
      }
      const owner = summonOwner(payload)
      if (owner) {
        state.owners.set(summon.value, owner)
        if (state.owners.size > 4000) {
          const oldest = state.owners.keys().next().value
          if (oldest != null) state.owners.delete(oldest)
        }
        adoptSummons(state)
      }
    }
  } else if (opcode === 0x4236) {
    const dead = readVarint(payload, 2)
    const killer = dead ? readVarint(payload, 2 + dead.length) : null
    const flag = killer ? readVarint(payload, 2 + dead.length + killer.length) : null
    const pet = dead ? lookupMob(state, dead.value) : null
    const counted = Boolean(flag && (flag.value === 1 || flag.value === 3))
    const struck = Boolean(dead && state.struck?.has(dead.value))
    const mine = Boolean(pet && counted && struck)
    if ((state.deathLogs || 0) < 12) {
      state.deathLogs = (state.deathLogs || 0) + 1
      pushTrace(state, {
        kind: "death",
        dead: dead ? dead.value : 0,
        killer: killer ? killer.value : 0,
        flag: flag ? flag.value : -1,
        selfId: state.selfId || 0,
        pet: pet || "",
        mine: Boolean(mine),
        head: payload.subarray(0, 18).toString("hex"),
        hypothesisId: "A",
      })
    }
    if (mine && pet && dead) creditOnce(state, found, dead.value, pet)
    else if (dead && counted && struck) {
      if (!state.pendingDeaths) state.pendingDeaths = new Map()
      state.pendingDeaths.set(dead.value, Date.now())
      if (state.pendingDeaths.size > 4000) {
        const oldest = state.pendingDeaths.keys().next().value
        if (oldest != null) state.pendingDeaths.delete(oldest)
      }
    }
  }
  if (opKey === "0438") noteOwnHit(payload, state)
  if (opKey === "0238") noteCombatLink(payload, state)
  return { names: found, marker: text.marker }
}

function payloadName(payload, names) {
  if (!payload || payload.length < 2) return { name: null, marker: false }
  let body = payload
  if (payload[0] === 0x78) {
    const inflated = tryInflate(payload)
    if (inflated) body = inflated
  }
  const text = readableText(body)
  return { name: matchCatalogName(text, names), marker: /sparkie|highland/i.test(text) }
}

function frameMessages(buf, names, state, depth = 0) {
  const found = []
  let framed = 0
  let marker = false
  let offset = 0
  if (!buf || depth > 8) return { names: found, framed, consumed: 0, marker }
  while (offset < buf.length) {
    if (buf[offset] === 0x00) {
      offset += 1
      continue
    }
    const length = readVarint(buf, offset)
    if (!length || length.value <= 0) {
      if (offset + 5 > buf.length) break
      offset += 1
      continue
    }
    const size = transportSize(length.value, length.length)
    if (size == null) {
      offset += 1
      continue
    }
    if (offset + size > buf.length) break
    const packet = buf.subarray(offset, offset + size)
    const first = packet[length.length]
    const extra = first >= 0xf0 && first < 0xff
    const payloadAt = length.length + (extra ? 1 : 0)
    if (payloadAt >= packet.length) {
      offset += 1
      continue
    }
    framed += 1
    const payload = packet.subarray(payloadAt)
    if (payload.length >= 2 && payload[0] === 0xff && payload[1] === 0xff) {
      if (state) state.bundles = (state.bundles || 0) + 1
      const nested = unpackBundle(payload)
      if (state) state.opened = (state.opened || 0) + (nested ? 1 : 0)
      if (nested) {
        const inner = frameMessages(nested, names, state, depth + 1)
        found.push(...inner.names)
        framed += inner.framed
        marker = marker || inner.marker
      }
    } else {
      const hit = noteMobPayload(payload, state, names)
      found.push(...hit.names)
      marker = marker || hit.marker
    }
    offset += size
  }
  return { names: found, framed, consumed: offset, marker }
}

function createDirection() {
  return { next: null, pending: [], ready: Buffer.alloc(0), rest: Buffer.alloc(0) }
}

function drainDirection(flow) {
  const chunks = []
  let moved = true
  while (moved) {
    moved = false
    for (let i = 0; i < flow.pending.length; i += 1) {
      const segment = flow.pending[i]
      const end = seqAdd(segment.seq, segment.data.length)
      if (!seqBefore(flow.next, end)) {
        flow.pending.splice(i, 1)
        i -= 1
        moved = true
        continue
      }
      if (!seqBefore(flow.next, segment.seq)) {
        const skip = seqBefore(segment.seq, flow.next) ? (flow.next - segment.seq) >>> 0 : 0
        if (skip < segment.data.length) {
          chunks.push(segment.data.subarray(skip))
          flow.next = seqAdd(segment.seq, segment.data.length)
        }
        flow.pending.splice(i, 1)
        i -= 1
        moved = true
      }
    }
  }
  if (!chunks.length && flow.pending.length > 24) {
    flow.pending.sort((left, right) => ((left.seq - flow.next) | 0) - ((right.seq - flow.next) | 0))
    flow.next = flow.pending[0].seq
    return drainDirection(flow)
  }
  if (!chunks.length) return Buffer.alloc(0)
  const added = Buffer.concat(chunks)
  flow.ready = Buffer.concat([flow.ready, added])
  if (flow.ready.length > STREAM_CAP) flow.ready = flow.ready.subarray(flow.ready.length - STREAM_CAP)
  return added
}

function connectionId(meta) {
  const left = `${meta.srcaddr}:${meta.srcport}`
  const right = `${meta.dstaddr}:${meta.dstport}`
  return left < right ? `${left}|${right}` : `${right}|${left}`
}

function usesGamePort(meta) {
  return meta.srcport === 13328 || meta.dstport === 13328
}

function createGameStream(names, mobFile = "") {
  let characterSeen = false
  const followed = new Set()
  const directions = new Map()
  const state = { selfId: null, mobs: new Map(), mine: new Set(), owners: new Map(), struck: new Map(), pendingDeaths: new Map(), trace: null, mobFile }
  loadRememberedMobs(state)
  return {
    push(meta, marked) {
      if (!meta || meta.proto !== "tcp" || typeof meta.seq !== "number") return { names: [], attempts: 0, appended: 0, marker: false, flow: "" }
      const id = connectionId(meta)
      if (marked) characterSeen = true
      if (characterSeen && (marked || usesGamePort(meta))) followed.add(id)
      if (!followed.has(id)) return { names: [], attempts: 0, appended: 0, marker: false, flow: "" }
      const directionId = `${meta.srcaddr}:${meta.srcport}>${meta.dstaddr}:${meta.dstport}`
      if ((meta.flags & 0x04) !== 0) {
        directions.set(directionId, createDirection())
        return { names: [], attempts: 0, appended: 0, marker: false, flow: id }
      }
      let flow = directions.get(directionId)
      if (!flow) {
        flow = createDirection()
        directions.set(directionId, flow)
      }
      const syn = (meta.flags & 0x02) !== 0
      const dataSeq = syn ? seqAdd(meta.seq, 1) : meta.seq
      if (flow.next == null) flow.next = dataSeq
      if (meta.payload && meta.payload.length) flow.pending.push({ seq: dataSeq, data: Buffer.from(meta.payload) })
      if (flow.pending.length > 64) flow.pending.shift()
      const added = drainDirection(flow)
      if (!added.length) return { names: [], attempts: 0, appended: 0, marker: false, flow: id, framed: 0 }
      state.trace = null
      state.traces = []
      if (added.includes(Buffer.from([0x41, 0x36]))) state.rawSpawn = (state.rawSpawn || 0) + 1
      if (added.includes(Buffer.from([0x3c, 0x0e, 0x20]))) state.rawSparkie = (state.rawSparkie || 0) + 1
      flow.rest = Buffer.concat([flow.rest, added])
      if (flow.rest.length > STREAM_CAP) flow.rest = flow.rest.subarray(flow.rest.length - STREAM_CAP)
      const scanned = frameMessages(flow.rest, names, state)
      flow.rest = flow.rest.subarray(Math.min(scanned.consumed, flow.rest.length))
      return {
        names: scanned.names,
        attempts: scanned.framed,
        appended: added.length,
        marker: scanned.marker,
        flow: id,
        framed: scanned.framed,
        selfId: state.selfId,
        profiles: state.profiles || 0,
        spawns: state.spawns || 0,
        farm: state.farm || 0,
        deaths: state.deaths || 0,
        sparkie: state.sparkie || 0,
        bundles: state.bundles || 0,
        opened: state.opened || 0,
        rawSpawn: state.rawSpawn || 0,
        rawSparkie: state.rawSparkie || 0,
        own: state.own || 0,
        trace: state.trace,
        traces: state.traces || [],
      }
    },
  }
}

function pickAdapter(rows) {
  let best = null
  for (const row of rows || []) {
    const udp = Number(row && row.udp) || 0
    if (!row || typeof row.name !== "string" || !row.name || udp <= 0) continue
    if (!best || udp > best.udp) {
      best = { name: row.name, description: typeof row.description === "string" ? row.description : "", udp }
    }
  }
  return best
}

function createRing() {
  const samples = []
  return {
    push(buf, at) {
      const slice = Buffer.from(buf.subarray(0, Math.min(buf.length, SAMPLE_BYTES)))
      samples.push({ at, len: buf.length, bytes: slice })
      if (samples.length > RING_LIMIT) samples.shift()
    },
    pair() {
      if (samples.length < 2) return null
      return { before: samples[samples.length - 2], after: samples[samples.length - 1] }
    },
    latest() {
      return samples[samples.length - 1] ?? null
    },
  }
}

module.exports = {
  NPCAP_FILES,
  npcapPresent,
  readInt,
  proposeField,
  emptyLayout,
  confirmField,
  applyConfirmed,
  decodePacket,
  createRing,
  extractNames,
  matchRosterName,
  isLikelyMobName,
  findOdyleTotal,
  isVirtualAdapter,
  realAdapters,
  pickAdapter,
  parseFarmableNames,
  decodeLz4Block,
  matchCatalogName,
  createGameStream,
}
