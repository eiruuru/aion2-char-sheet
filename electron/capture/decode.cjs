const fs = require("fs")

const NPCAP_FILES = [
  "C:\\Windows\\System32\\Npcap\\wpcap.dll",
  "C:\\Windows\\System32\\wpcap.dll",
]

const RING_LIMIT = 24
const SAMPLE_BYTES = 128

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
  pickAdapter,
}
