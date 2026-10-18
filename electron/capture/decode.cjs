const fs = require("fs")

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

function pushName(found, seen, text) {
  const name = cleanName(text)
  if (!name) return
  const key = name.toLowerCase()
  if (seen.has(key)) return
  seen.add(key)
  found.push(name)
}

function extractNames(buf) {
  if (!buf || typeof buf.length !== "number") return []
  const limit = Math.min(buf.length, SCAN_BYTES)
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
  const limit = Math.min(buf.length, SCAN_BYTES)
  for (const width of [4, 2]) {
    for (let offset = 0; offset + width <= limit; offset += width) {
      const value = readInt(buf, offset, width)
      if (!ODYLE_CAPS.has(value)) continue
      for (const neighbor of [offset - width, offset + width]) {
        const amount = readInt(buf, neighbor, width)
        if (amount == null || amount < 0 || amount > 2000 || ODYLE_CAPS.has(amount)) continue
        return amount
      }
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
  findOdyleTotal,
  isVirtualAdapter,
  realAdapters,
  pickAdapter,
}
