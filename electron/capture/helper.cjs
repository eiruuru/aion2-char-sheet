const readline = require("readline")
const fs = require("fs")
const path = require("path")
const {
  npcapPresent,
  parseFarmableNames,
  createGameStream,
  realAdapters,
} = require("./decode.cjs")

const FLUSH_MS = 0
const NOT_DETECTED = "Game packets have not been detected yet. Move or attack, then run Find Adapter."

let capturing = false
let capHandle = null
let openHandles = []
let capModule = null
let roster = []
let boundName = ""
let sawPackets = false
let pendingKills = []
let flushTimer = null
let watch = { packets: 0, attempts: 0, hits: 0, appended: 0, emits: 0, seen: 0, gamePort: 0 }
const farmable = loadFarmableNames()
const gameStream = createGameStream(farmable, path.join(process.env.APPDATA || path.join(__dirname, ".."), "aion2-tracker", "live-mobs.json"))

function loadFarmableNames() {
  const source = path.join(__dirname, "../../src/model/pets.ts")
  try {
    return parseFarmableNames(fs.readFileSync(source, "utf8"))
  } catch {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "farmable-names.json"), "utf8"))
  }
}

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
    const proto = ip.info.protocol === decoders.PROTOCOL.IP.UDP
      ? "udp"
      : ip.info.protocol === decoders.PROTOCOL.IP.TCP
        ? "tcp"
        : ""
    if (!proto) return null
    const header = proto === "udp" ? decoders.UDP(buffer, ip.offset) : decoders.TCP(buffer, ip.offset)
    if (!header) return null
    const start = header.offset
    const end = Math.min(nbytes, ip.offset + ip.info.totallen)
    if (start >= end || end - start < 8) return null
    return {
      proto,
      payload: Buffer.from(buffer.subarray(start, end)),
      srcaddr: ip.info.srcaddr,
      dstaddr: ip.info.dstaddr,
      srcport: header.info.srcport,
      dstport: header.info.dstport,
      seq: header.info.seqno,
      flags: header.info.flags || 0,
    }
  } catch {
    return null
  }
}

function findRosterBytes(payload) {
  for (const entry of roster) {
    const name = String(entry || "").trim()
    if (name.length < 3) continue
    const ascii = Buffer.from(name, "utf8")
    if (payload.includes(ascii)) return entry
    const wide = Buffer.alloc(name.length * 2)
    for (let i = 0; i < name.length; i += 1) wide[i * 2] = name.charCodeAt(i) & 0xff
    if (payload.includes(wide)) return entry
    if (payload.length > 1 && payload.subarray(1).includes(wide)) return entry
  }
  return null
}

function openListen(cap, deviceName, onSlice) {
  const handle = new cap.Cap()
  const buffer = Buffer.alloc(65535)
  handle.open(deviceName, "tcp or udp", 10 * 1024 * 1024, buffer)
  if (handle.setMinBytes) handle.setMinBytes(0)
  handle.on("packet", (nbytes) => {
    const parsed = payloadFromPacket(cap, buffer, nbytes)
    if (!parsed) return
    onSlice(parsed)
  })
  return handle
}

function flushKills() {
  flushTimer = null
  if (!pendingKills.length) return
  const names = pendingKills
  pendingKills = []
  emit({ type: "kills", names, at: new Date().toISOString() })
  watch.emits += 1
}

function noteKill(name) {
  pendingKills.push(name)
  if (!flushTimer) flushTimer = setTimeout(flushKills, FLUSH_MS)
}

function noteDecoded(meta, marked) {
  if (meta.proto !== "tcp") return
  const found = gameStream.push(meta, marked)
  watch.packets += 1
  watch.attempts += found.attempts
  watch.appended += found.appended
  watch.framed = (watch.framed || 0) + (found.framed || 0)
  for (const name of found.names) {
    watch.hits += 1
    noteKill(name)
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

function closeAll() {
  const current = openHandles
  openHandles = []
  capHandle = null
  for (const source of current) closeHandle(source.handle)
}

function lockSource(source) {
  if (capHandle === source.handle) return
  capHandle = source.handle
  capturing = true
  emit({
    type: "adapter",
    device: source.name,
    description: source.description,
    udp: 1,
  })
}

function listenAll() {
  const cap = bindingReady()
  if (!cap) {
    capturing = false
    return
  }
  closeAll()
  sawPackets = false
  const devices = cap.Cap.deviceList?.() || []
  const adapters = realAdapters(devices)
  const loopbacks = devices.filter((device) => device && /loopback/i.test(`${device.name || ""} ${device.description || ""}`))
  status("capturing", roster.length ? "Checking packets for the logged-in roster character." : "Packets are arriving.", boundName)
  for (const device of [...adapters.map((item) => ({ ...item, loopback: false })), ...loopbacks.map((item) => ({ ...item, loopback: true }))]) {
    try {
      const source = { name: device.name, description: typeof device.description === "string" ? device.description : "", handle: null, loopback: Boolean(device.loopback) }
      source.handle = openListen(cap, device.name, (parsed) => {
        watch.seen += 1
        const gamePort = parsed.srcport === 13328 || parsed.dstport === 13328
        if (gamePort) watch.gamePort += 1
        const hit = findRosterBytes(parsed.payload)
        if (hit && hit !== boundName) {
          lockSource(source)
          boundName = hit
          emit({ type: "character", name: hit })
          status("capturing", `Live readings are updating ${hit}.`, hit)
        }
        if (capHandle === source.handle) {
          if (!sawPackets) {
            sawPackets = true
            if (!boundName) status("capturing", roster.length ? "Checking packets for the logged-in roster character." : "Packets are arriving.")
          }
          noteDecoded(parsed, Boolean(hit && hit === boundName))
        }
      })
      openHandles.push(source)
    } catch {
      // This adapter could not be opened. The others keep listening.
    }
  }
  if (!openHandles.length) {
    capturing = false
    emit({ type: "adapter", device: "", description: "", udp: 0 })
    status("needs-adapter", NOT_DETECTED, boundName)
    return
  }
  capturing = true
}

function startCapture() {
  try {
    listenAll()
  } catch (error) {
    capturing = false
    const message = error instanceof Error ? error.message : "Could not open Npcap."
    status("unavailable", `${message} Start this app the same way you start NotMeter.`, "")
  }
}

function findAdapter() {
  listenAll()
}

function stopCapture() {
  capturing = false
  closeAll()
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
