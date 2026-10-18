const { spawn } = require("child_process")
const { npcapPresent } = require("./decode.cjs")

function createLiveSession({ execPath, helperPath, send }) {
  let child = null
  let phase = "off"
  let detail = ""
  let closing = false

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
          sendEvent(JSON.parse(line))
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
      if (phase === "starting" || phase === "capturing" || phase === "needs-relog") {
        sendEvent({ type: "status", phase: "unavailable", detail: "Live Sync stopped.", boundName: "" })
      }
    })
    next.on("error", () => {
      child = null
      sendEvent({ type: "status", phase: "unavailable", detail: "Could not start Live Sync.", boundName: "" })
    })
    next.stdin.write(`${JSON.stringify({ cmd: "start" })}\n`)
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
    mark(kind) {
      if (!child) return false
      child.stdin.write(`${JSON.stringify({ cmd: "mark", kind: kind === "odyle" ? "odyle" : "pet" })}\n`)
      return true
    },
    stop() {
      stopChild()
    },
  }
}

module.exports = { createLiveSession }
