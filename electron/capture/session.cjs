const { spawn } = require("child_process")
const fs = require("fs")
const path = require("path")
const { npcapPresent } = require("./decode.cjs")

function readDevice(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
    return typeof parsed.device === "string" ? parsed.device : ""
  } catch {
    return ""
  }
}

function writeDevice(file, device) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify({ device }))
}

function createLiveSession({ execPath, helperPath, adapterFile, send }) {
  let child = null
  let phase = "off"
  let detail = ""
  let closing = false
  let roster = []

  function sendEvent(event) {
    if (event?.type === "status") {
      phase = event.phase || phase
      detail = typeof event.detail === "string" ? event.detail : ""
    }
    send(event)
  }

  function stopChild() {
    if (!child) return
    closing = true
    try {
      child.stdin.write(`${JSON.stringify({ cmd: "stop" })}\n`)
    } catch {
      // process already gone
    }
    child.kill()
    child = null
  }

  function startChild() {
    if (child) return
    phase = "starting"
    sendEvent({ type: "status", phase: "starting", detail: "Opening Npcap.", boundName: "" })
    const next = spawn(execPath, [helperPath], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    })
    closing = false
    child = next
    let buffer = ""
    next.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8")
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line)
          if (adapterFile && event?.type === "adapter" && typeof event.device === "string" && event.device) {
            writeDevice(adapterFile, event.device)
          }
          sendEvent(event)
        } catch {
          // ignore a broken helper line
        }
      }
    })
    next.on("exit", () => {
      if (child === next) child = null
      if (closing) {
        closing = false
        return
      }
      if (phase === "starting" || phase === "capturing" || phase === "needs-relog" || phase === "needs-adapter") {
        sendEvent({ type: "status", phase: "unavailable", detail: "Live Sync stopped.", boundName: "" })
      }
    })
    next.on("error", () => {
      child = null
      sendEvent({ type: "status", phase: "unavailable", detail: "Could not start Live Sync.", boundName: "" })
    })
    next.stdin.write(`${JSON.stringify({ cmd: "start", device: adapterFile ? readDevice(adapterFile) : "" })}\n`)
    next.stdin.write(`${JSON.stringify({ cmd: "roster", names: roster })}\n`)
  }

  return {
    snapshot() {
      return { phase, detail, boundName: "", experimental: true, npcap: npcapPresent() }
    },
    setEnabled(on) {
      if (!on) {
        stopChild()
        sendEvent({ type: "status", phase: "off", detail: "", boundName: "" })
        return this.snapshot()
      }
      if (!npcapPresent()) {
        sendEvent({
          type: "status",
          phase: "needs-npcap",
          detail: "Install Npcap, then turn Live Sync on again.",
          boundName: "",
        })
        return this.snapshot()
      }
      startChild()
      return this.snapshot()
    },
    setRoster(names) {
      roster = Array.isArray(names) ? names.filter((name) => typeof name === "string" && name.trim()) : []
      if (!child) return
      child.stdin.write(`${JSON.stringify({ cmd: "roster", names: roster })}\n`)
    },
    findAdapter() {
      if (!npcapPresent()) {
        sendEvent({
          type: "status",
          phase: "needs-npcap",
          detail: "Install Npcap, then turn Live Sync on again.",
          boundName: "",
        })
        return false
      }
      if (!child) startChild()
      child?.stdin.write(`${JSON.stringify({ cmd: "find" })}\n`)
      return true
    },
    stop() {
      stopChild()
    },
  }
}

module.exports = { createLiveSession }
