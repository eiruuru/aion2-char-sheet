const readline = require("readline")
const {
  npcapPresent,
  extractNames,
  matchRosterName,
  findOdyleTotal,
  realAdapters,
} = require("./decode.cjs")

const SNIFF_MS = 2500
const KILL_GAP_MS = 1500
const FLUSH_MS = 300
const NOT_DETECTED = "Game packets have not been detected yet. Move or attack, then run Find Adapter."

let capturing = false
let capHandle = null
let capModule = null
let roster = []
let boundName = ""
let lastOdyle = null
let sawPackets = false
const killSeen = new Map()
let pendingKills = []
let flushTimer = null

function emit(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`)
}

function status(phase, detail, name = boundName) {
  emit({ type: "status", phase, detail: detail ?? "", boundName: name })
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

function closeHandle(handle = capHandle) {
  try {
    handle?.close()
  } catch {
    // already closed
  }
  if (handle === capHandle) capHandle = null
}

function payloadFromPacket(cap, buffer, nbytes) {
  try {
    const decoders = cap.decoders
    const ethernet = decoders.Ethernet(buffer)
    if (!ethernet || ethernet.info.type !== decoders.PROTOCOL.ETHERNET.IPV4) return null
    const ip = decoders.IPV4(buffer, ethernet.offset)
    if (!ip) return null
    const header = ip.info.protocol === decoders.PROTOCOL.IP.UDP
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

function openListen(cap, deviceName, onSlice) {
  const handle = new cap.Cap()
  const buffer = Buffer.alloc(65535)
  handle.open(deviceName, "udp", 10 * 1024 * 1024, buffer)
  if (handle.setMinBytes) handle.setMinBytes(0)
  handle.on("packet", (nbytes) => {
    const payload = payloadFromPacket(cap, buffer, nbytes)
    if (!payload || payload.length < 8) return
    onSlice(Buffer.from(payload.subarray(0, Math.min(payload.length, 256))))
  })
  return handle
}

function flushKills() {
  flushTimer = null
  if (!pendingKills.length) return
  const names = pendingKills
  pendingKills = []
  emit({ type: "kills", names, at: new Date().toISOString() })
}

function noteKill(name) {
  const key = name.toLowerCase()
  const now = Date.now()
  const last = killSeen.get(key) || 0
  if (now - last < KILL_GAP_MS) return
  killSeen.set(key, now)
  if (killSeen.size > 200) {
    const oldest = killSeen.keys().next().value
    if (oldest) killSeen.delete(oldest)
  }
  pendingKills.push(name)
  if (!flushTimer) flushTimer = setTimeout(flushKills, FLUSH_MS)
}

function notePayload(slice) {
  const names = extractNames(slice)
  const who = matchRosterName(names, roster)
  if (who && who !== boundName) {
    boundName = who
    emit({ type: "character", name: who })
    status("capturing", `Live readings are updating ${who}.`, who)
  }
  const amount = findOdyleTotal(slice)
  if (amount != null && amount !== lastOdyle) {
    lastOdyle = amount
    emit({ type: "odyle", amount, at: new Date().toISOString() })
  }
  const rosterKeys = new Set(roster.map((name) => name.toLowerCase()))
  for (const name of names) {
    if (rosterKeys.has(name.toLowerCase())) continue
    noteKill(name)
  }
  if (!sawPackets) {
    sawPackets = true
    if (!boundName) status("capturing", roster.length ? "Waiting for a roster character." : "Packets are arriving.")
  }
}

function bindingReady() {
  if (!npcapPresent()) {
    status("needs-npcap", "Install Npcap, then turn Live Sync on again.", "")
    return null
  }
  const cap = loadCap()
  if (!cap?.Cap) {
    status("unavailable", "Npcap is installed. This build has no capture binding yet, so readings stay manual.", "")
    return null
  }
  return cap
}

function watchDevice(cap, deviceName) {
  closeHandle()
  sawPackets = false
  const handle = openListen(cap, deviceName, (slice) => {
    if (capHandle === handle) notePayload(slice)
  })
  capHandle = handle
  capturing = true
  return handle
}

function startCapture(deviceName) {
  const cap = bindingReady()
  if (!cap) {
    capturing = false
    return
  }
  const device = typeof deviceName === "string" ? deviceName : ""
  if (!device) {
    capturing = true
    status("needs-adapter", NOT_DETECTED, "")
    return
  }
  try {
    status("needs-adapter", NOT_DETECTED, boundName)
    watchDevice(cap, device)
  } catch (error) {
    capturing = false
    const message = error instanceof Error ? error.message : "Could not open Npcap."
    status("unavailable", `${message} Start this app the same way you start NotMeter.`, "")
  }
}

async function findAdapter() {
  const cap = bindingReady()
  if (!cap) return
  closeHandle()
  sawPackets = false
  status("starting", "Finding the adapter. Keep moving or attacking.", boundName)
  const devices = realAdapters(cap.Cap.deviceList?.() || [])
  const opened = []
  let settled = false
  let timer = null
  const winner = await new Promise((resolve) => {
    const finish = (found) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolve(found)
    }
    for (const device of devices) {
      try {
        const handle = openListen(cap, device.name, (slice) => {
          if (!settled) finish({ device, handle })
          if (capHandle === handle) notePayload(slice)
        })
        opened.push(handle)
      } catch {
        // this device would not open
      }
    }
    if (!opened.length) finish(null)
    else timer = setTimeout(() => finish(null), SNIFF_MS)
  })
  for (const handle of opened) {
    if (!winner || handle !== winner.handle) closeHandle(handle)
  }
  if (!winner) {
    capturing = false
    emit({ type: "adapter", device: "", description: "", udp: 0 })
    status("needs-adapter", NOT_DETECTED, boundName)
    return
  }
  capHandle = winner.handle
  capturing = true
  emit({
    type: "adapter",
    device: winner.device.name,
    description: typeof winner.device.description === "string" ? winner.device.description : "",
    udp: 1,
  })
  status("capturing", boundName ? `Live readings are updating ${boundName}.` : "Packets are arriving.", boundName)
}

function stopCapture() {
  capturing = false
  closeHandle()
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  pendingKills = []
  status("off", "", "")
}

function setRoster(names) {
  roster = (Array.isArray(names) ? names : []).filter((name) => typeof name === "string" && name.trim())
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
  if (command.cmd === "roster") setRoster(command.names)
}

status("off", "", "")
const input = readline.createInterface({ input: process.stdin })
input.on("line", onCommand)
