const readline = require("readline")
const {
  npcapPresent,
  proposeField,
  emptyLayout,
  confirmField,
  applyConfirmed,
  decodePacket,
  createRing,
  pickAdapter,
} = require("./decode.cjs")

const SNIFF_MS = 2500
const NOT_DETECTED = "Game packets have not been detected yet. Move or attack, then run Find Adapter."

const hits = {}
let layout = emptyLayout()
let ring = createRing()
let capturing = false
let capHandle = null
let sawDecode = false
let sawPackets = false
let capModule = null

function emit(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`)
}

function status(phase, detail) {
  emit({ type: "status", phase, detail: detail ?? "", boundName: "" })
}

function loadCap() {
  if (capModule) return capModule
  try {
    capModule = require("cap")
  } catch {
    capModule = null
  }
  return capModule
}

function closeHandle() {
  try {
    capHandle?.close()
  } catch {
    // already closed
  }
  capHandle = null
}

function countUdp(cap, device, ms) {
  return new Promise((resolve) => {
    const handle = new cap.Cap()
    const buffer = Buffer.alloc(65535)
    let udp = 0
    try {
      handle.open(device, "udp", 10 * 1024 * 1024, buffer)
      if (handle.setMinBytes) handle.setMinBytes(0)
      handle.on("packet", (nbytes) => {
        const payload = payloadFromPacket(cap, buffer, nbytes)
        if (payload && payload.length >= 8) udp += 1
      })
    } catch {
      resolve(0)
      return
    }
    setTimeout(() => {
      try { handle.close() } catch { /* already closed */ }
      resolve(udp)
    }, ms)
  })
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

function bindingReady() {
  if (!npcapPresent()) {
    status("needs-npcap", "Install Npcap, then turn Live Sync on again.")
    return null
  }
  const cap = loadCap()
  if (!cap?.Cap) {
    status("unavailable", "Npcap is installed. This build has no capture binding yet, so readings stay manual.")
    return null
  }
  return cap
}

function startCapture(deviceName) {
  closeHandle()
  sawDecode = false
  sawPackets = false
  const cap = bindingReady()
  if (!cap) {
    capturing = false
    return
  }
  const device = typeof deviceName === "string" ? deviceName : ""
  if (!device) {
    capturing = true
    status("needs-adapter", NOT_DETECTED)
    return
  }
  try {
    const handle = new cap.Cap()
    const buffer = Buffer.alloc(65535)
    status("needs-adapter", NOT_DETECTED)
    handle.open(device, "udp", 10 * 1024 * 1024, buffer)
    if (handle.setMinBytes) handle.setMinBytes(0)
    handle.on("packet", (nbytes) => {
      const payload = payloadFromPacket(cap, buffer, nbytes)
      if (!payload || payload.length < 8) return
      if (!sawPackets) {
        sawPackets = true
        status("needs-relog", "Packets are arriving. Re-log or teleport once, then mark a pet soul gain or an Odyle change.")
      }
      const before = sawDecode
      noteSample(Buffer.from(payload))
      if (!before && sawDecode) status("capturing", "Live readings are updating the selected character.")
    })
    capHandle = handle
    capturing = true
  } catch (error) {
    capturing = false
    const message = error instanceof Error ? error.message : "Could not open Npcap."
    status("unavailable", `${message} Start this app the same way you start NotMeter.`)
  }
}

async function findAdapter() {
  const cap = bindingReady()
  if (!cap) return
  closeHandle()
  status("starting", "Finding the adapter. Keep moving or attacking.")
  const devices = cap.Cap.deviceList?.() || []
  const rows = []
  for (const device of devices) {
    if (!device?.name) continue
    const udp = await countUdp(cap, device.name, SNIFF_MS)
    rows.push({ name: device.name, description: device.description || "", udp })
  }
  const best = pickAdapter(rows)
  if (!best) {
    emit({ type: "adapter", device: "", description: "", udp: 0 })
    status("needs-adapter", NOT_DETECTED)
    return
  }
  emit({ type: "adapter", device: best.name, description: best.description, udp: best.udp })
  startCapture(best.name)
}

function stopCapture() {
  capturing = false
  closeHandle()
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
  if (command.cmd === "start") startCapture(command.device)
  if (command.cmd === "find") void findAdapter()
  if (command.cmd === "stop") stopCapture()
  if (command.cmd === "mark") mark(command.kind === "odyle" ? "odyle" : "pet")
  if (command.cmd === "layout" && command.layout && typeof command.layout === "object") {
    layout = command.layout
  }
}

status("off", "")
const input = readline.createInterface({ input: process.stdin })
input.on("line", onCommand)
