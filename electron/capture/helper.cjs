const readline = require("readline")
const {
  npcapPresent,
  proposeField,
  emptyLayout,
  confirmField,
  applyConfirmed,
  decodePacket,
  createRing,
} = require("./decode.cjs")

const hits = {}
let layout = emptyLayout()
let ring = createRing()
let capturing = false
let capHandle = null
let sawDecode = false

function emit(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`)
}

function status(phase, detail) {
  emit({ type: "status", phase, detail: detail ?? "", boundName: "" })
}

function loadCap() {
  try {
    return require("cap")
  } catch {
    return null
  }
}

function payloadFromPacket(cap, buffer, nbytes) {
  try {
    const decoders = cap.decoders
    const ethernet = decoders.Ethernet(buffer)
    if (!ethernet || ethernet.info.type !== decoders.PROTOCOL.ETHERNET.IPV4) return null
    const ip = decoders.IPV4(buffer, ethernet.offset)
    if (!ip) return null
    const header = ip.info.protocol === decoders.PROTOCOL.IP.TCP
      ? decoders.TCP(buffer, ip.offset)
      : ip.info.protocol === decoders.PROTOCOL.IP.UDP
        ? decoders.UDP(buffer, ip.offset)
        : null
    if (!header) return null
    const start = header.offset
    const end = Math.min(nbytes, ip.offset + ip.info.totallen)
    if (start >= end) return null
    return buffer.subarray(start, end)
  } catch {
    return null
  }
}

function noteSample(bytes) {
  ring.push(bytes, Date.now())
  const found = decodePacket(bytes, layout)
  if (found.odyle == null && found.souls == null && found.level == null) return
  sawDecode = true
  const at = new Date().toISOString()
  if (found.odyle != null) emit({ type: "odyle", amount: found.odyle, at })
  if (found.souls != null || found.level != null || found.soulsToNext != null) {
    emit({
      type: "pet",
      at,
      ...(found.level != null ? { level: found.level } : {}),
      ...(found.souls != null ? { souls: found.souls } : {}),
      ...(found.soulsToNext != null ? { soulsToNext: found.soulsToNext } : {}),
    })
  }
}

function startCapture() {
  if (capturing) return
  capturing = true
  sawDecode = false
  if (!npcapPresent()) {
    status("needs-npcap", "Install Npcap, then turn Live Sync on again.")
    capturing = false
    return
  }
  const cap = loadCap()
  if (!cap?.Cap) {
    status("unavailable", "Npcap is installed. This build has no capture binding yet, so readings stay manual.")
    capturing = false
    return
  }
  try {
    const device = cap.Cap.findDevice()
    if (!device) {
      status("unavailable", "Npcap did not list a network device.")
      capturing = false
      return
    }
    const handle = new cap.Cap()
    const buffer = Buffer.alloc(65535)
    handle.open(device, "ip", 10 * 1024 * 1024, buffer)
    handle.setMinBytes && handle.setMinBytes(0)
    handle.on("packet", (nbytes) => {
      const payload = payloadFromPacket(cap, buffer, nbytes)
      if (!payload || payload.length < 8) return
      const before = sawDecode
      noteSample(Buffer.from(payload))
      if (!before && sawDecode) status("capturing", "Live readings are updating the selected character.")
    })
    capHandle = handle
    status("needs-relog", "Capturing. Re-log or teleport once so the next reading binds to the selected character.")
  } catch (error) {
    status("unavailable", error instanceof Error ? error.message : "Could not open Npcap.")
    capturing = false
  }
}

function stopCapture() {
  capturing = false
  try {
    capHandle?.close()
  } catch {
    // already closed
  }
  capHandle = null
  status("off", "")
}

function mark(kind) {
  const pair = ring.pair()
  if (!pair) {
    emit({ type: "discovery", note: "Not enough packets yet. Re-log, change the value in game, then mark again." })
    return
  }
  const direction = kind === "odyle" ? "any" : "increase"
  const field = proposeField(pair.before.bytes, pair.after.bytes, direction)
  if (!field) {
    emit({ type: "discovery", note: "No small integer changed between the last two packets." })
    return
  }
  const confirmed = confirmField(hits, kind === "odyle" ? "odyle" : "pet", field)
  if (confirmed) layout = applyConfirmed(layout, kind === "odyle" ? "odyle" : "pet", confirmed)
  emit({
    type: "discovery",
    note: confirmed
      ? `Locked ${kind} at offset ${confirmed.offset}.`
      : `Candidate ${kind} offset ${field.offset} (${field.before} → ${field.after}). Mark the same change once more to lock it.`,
    layout,
  })
  if (confirmed) {
    const found = decodePacket(pair.after.bytes, layout)
    noteSample(pair.after.bytes)
    if (found.odyle == null && found.souls == null) {
      emit({ type: "discovery", note: "Field locked, but the latest packet did not hold a usable value yet." })
    }
  }
}

function onCommand(line) {
  let command
  try {
    command = JSON.parse(line)
  } catch {
    return
  }
  if (command.cmd === "start") startCapture()
  if (command.cmd === "stop") stopCapture()
  if (command.cmd === "mark") mark(command.kind === "odyle" ? "odyle" : "pet")
  if (command.cmd === "layout" && command.layout && typeof command.layout === "object") {
    layout = command.layout
  }
}

status("off", "")
const input = readline.createInterface({ input: process.stdin })
input.on("line", onCommand)
