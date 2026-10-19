const { app, BrowserWindow, ipcMain, Notification, screen } = require("electron")
const { createLiveSession } = require("./capture/session.cjs")

if (app.isPackaged) app.setName("Aion 2 Progress")
const fs = require("fs")
const http = require("http")
const https = require("https")
const path = require("path")

const SAVE_NAME = "aion2-tracker.json"
const WINDOW_NAME = "aion2-window.json"
const PET_WINDOW_NAME = "aion2-pet-window.json"

function savePath(name) {
  return path.join(app.getPath("userData"), name)
}

function adoptLegacySave(name) {
  const dest = savePath(name)
  if (fs.existsSync(dest) || !app.isPackaged) return
  const legacy = path.join(path.dirname(process.execPath), name)
  if (!fs.existsSync(legacy)) return
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(legacy, dest)
}

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8")
  } catch {
    return null
  }
}

function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8"
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8"
  if (file.endsWith(".css")) return "text/css; charset=utf-8"
  if (file.endsWith(".svg")) return "image/svg+xml"
  if (file.endsWith(".png")) return "image/png"
  if (file.endsWith(".webp")) return "image/webp"
  if (file.endsWith(".json")) return "application/json"
  return "application/octet-stream"
}

function proxy(req, res, origin, prefix, headers) {
  const incoming = new URL(req.url, "http://127.0.0.1")
  const target = new URL(origin)
  const upstreamPath = incoming.pathname.replace(new RegExp(`^${prefix}`), "") + incoming.search
  const upstream = https.request(
    {
      hostname: target.hostname,
      path: upstreamPath,
      method: "GET",
      headers: headers ?? {
        accept: "application/json",
        referer: "https://aion2.plaync.com/en-us/characters/index",
        origin: "https://aion2.plaync.com",
      },
    },
    (up) => {
      res.writeHead(up.statusCode || 502, {
        "content-type": up.headers["content-type"] || "application/json",
      })
      up.pipe(res)
    },
  )
  upstream.on("error", () => {
    res.writeHead(502)
    res.end("Aion 2 request failed")
  })
  upstream.end()
}

function startServer(root) {
  const server = http.createServer((req, res) => {
    const incoming = new URL(req.url || "/", "http://127.0.0.1")
    if (incoming.pathname.startsWith("/nc-search")) {
      proxy(req, res, "https://api-search.plaync.com", "/nc-search")
      return
    }
    if (incoming.pathname.startsWith("/nc-aion")) {
      proxy(req, res, "https://aion2.plaync.com", "/nc-aion")
      return
    }
    if (incoming.pathname.startsWith("/youtube")) {
      proxy(req, res, "https://www.youtube.com", "/youtube", {
        accept: "text/html",
        "accept-language": "en-US,en",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      })
      return
    }
    const relative = incoming.pathname === "/" ? "index.html" : incoming.pathname.replace(/^\/+/, "")
    const file = path.normalize(path.join(root, relative))
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403)
      res.end()
      return
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        fs.readFile(path.join(root, "index.html"), (fallbackError, html) => {
          if (fallbackError) {
            res.writeHead(404)
            res.end("Missing app files")
            return
          }
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
          res.end(html)
        })
        return
      }
      res.writeHead(200, { "content-type": contentType(file) })
      res.end(data)
    })
  })
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      resolve({ server, port: typeof address === "object" && address ? address.port : 0 })
    })
  })
}

let windowRef = null
let petWindow = null
let petPopupState = null
let petChrome = { opacity: 1, locked: false, x: null, y: null, width: null, height: null }

function petCoordinate(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number) : null
}

function petSpan(value, min, max) {
  const number = petCoordinate(value)
  if (number == null) return null
  return Math.min(max, Math.max(min, number))
}

function readPetChrome() {
  try {
    const raw = JSON.parse(readText(savePath(PET_WINDOW_NAME)) || "")
    const opacity = Number(raw?.opacity)
    return {
      opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0.35, opacity)) : 1,
      locked: Boolean(raw?.locked),
      x: petCoordinate(raw?.x),
      y: petCoordinate(raw?.y),
      width: petSpan(raw?.width, 340, 1600),
      height: petSpan(raw?.height, 220, 1200),
    }
  } catch {
    return { opacity: 1, locked: false, x: null, y: null, width: null, height: null }
  }
}

function applyPetChrome() {
  if (!petWindow || petWindow.isDestroyed()) return
  petWindow.setOpacity(petChrome.opacity)
  if (typeof petWindow.setMovable === "function") petWindow.setMovable(!petChrome.locked)
}

function writePetChrome(next) {
  petChrome = {
    opacity: Math.min(1, Math.max(0.35, Number(next?.opacity) || 1)),
    locked: Boolean(next?.locked),
    x: petCoordinate(next?.x),
    y: petCoordinate(next?.y),
    width: petSpan(next?.width, 340, 1600),
    height: petSpan(next?.height, 220, 1200),
  }
  writeText(savePath(PET_WINDOW_NAME), JSON.stringify(petChrome))
  applyPetChrome()
}

function petPlace() {
  if (!petChrome.locked || petChrome.x == null || petChrome.y == null) return {}
  const { x, y } = petChrome
  const visible = screen.getAllDisplays().some((display) => {
    const area = display.workArea
    return x + 80 > area.x && x < area.x + area.width && y + 40 > area.y && y < area.y + area.height
  })
  return visible ? { x, y } : {}
}

function petSize() {
  if (!petChrome.locked || petChrome.width == null || petChrome.height == null) return { width: 400, height: 320 }
  return { width: petChrome.width, height: petChrome.height }
}

function rememberPetBounds() {
  if (!petWindow || petWindow.isDestroyed() || !petChrome.locked) return
  const [x, y] = petWindow.getPosition()
  const [width, height] = petWindow.getSize()
  if (petChrome.x === x && petChrome.y === y && petChrome.width === width && petChrome.height === height) return
  writePetChrome({ ...petChrome, x, y, width, height })
}
let appPort = 0
let stopLiveSync = () => {}

function createWindow(port) {
  let above = false
  try {
    const saved = readText(savePath(WINDOW_NAME))
    above = saved ? Boolean(JSON.parse(saved).alwaysOnTop) : false
  } catch {
    above = false
  }
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    title: `AION 2 Character Sheet v${app.getVersion()}`,
    backgroundColor: "#070707",
    alwaysOnTop: above,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  if (above) win.setAlwaysOnTop(true, "floating")
  windowRef = win
  win.on("closed", () => {
    if (windowRef === win) windowRef = null
    if (petWindow && !petWindow.isDestroyed()) petWindow.close()
  })
  void win.loadURL(`http://127.0.0.1:${port}/`)
}

function petIsOpen() {
  return Boolean(petWindow && !petWindow.isDestroyed() && petWindow.isVisible())
}

function tellPetVisible(open) {
  windowRef?.webContents.send("pet-pop:visible", Boolean(open))
}

function raisePetWindow(focus) {
  if (!petWindow || petWindow.isDestroyed()) return
  petWindow.setAlwaysOnTop(true, "screen-saver")
  try {
    if (typeof petWindow.setVisibleOnAllWorkspaces === "function") petWindow.setVisibleOnAllWorkspaces(true)
  } catch {
    // Older Electron builds reject this on some desktops.
  }
  if (focus) petWindow.show()
  else if (typeof petWindow.showInactive === "function") petWindow.showInactive()
  else petWindow.show()
  petWindow.moveTop()
}

function openPetWindow(focus = false) {
  if (petWindow && !petWindow.isDestroyed()) {
    raisePetWindow(focus)
    tellPetVisible(true)
    return true
  }
  const place = petPlace()
  const size = petSize()
  petWindow = new BrowserWindow({
    ...size,
    minWidth: 340,
    minHeight: 220,
    ...place,
    show: false,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    backgroundColor: "#10140f",
    title: "Pet progress",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  petWindow.on("moved", rememberPetBounds)
  petWindow.on("resized", rememberPetBounds)
  petWindow.on("close", rememberPetBounds)
  petWindow.on("closed", () => {
    petWindow = null
    tellPetVisible(false)
  })
  void petWindow.loadURL(`http://127.0.0.1:${appPort}/#pet`)
  applyPetChrome()
  if (petChrome.locked) {
    petWindow.setBounds({
      ...size,
      ...(place.x != null && place.y != null ? place : {}),
    })
  }
  raisePetWindow(focus)
  tellPetVisible(true)
  return true
}

function publishUpdate(status, extra) {
  windowRef?.webContents.send("updates:status", { status, ...(extra ?? {}) })
}

let updaterReady = false

function ensureUpdater() {
  if (!app.isPackaged) return null
  const { autoUpdater } = require("electron-updater")
  if (updaterReady) return autoUpdater
  updaterReady = true
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.on("checking-for-update", () => publishUpdate("checking"))
  autoUpdater.on("update-available", (info) => publishUpdate("available", {
    version: info?.version ?? "",
    notes: info?.releaseNotes ?? null,
  }))
  autoUpdater.on("update-not-available", () => publishUpdate("none"))
  autoUpdater.on("download-progress", (progress) => publishUpdate("downloading", {
    percent: Math.max(0, Math.round(progress?.percent ?? 0)),
  }))
  autoUpdater.on("update-downloaded", (info) => publishUpdate("downloaded", {
    version: info?.version ?? "",
    notes: info?.releaseNotes ?? null,
  }))
  autoUpdater.on("error", (error) => publishUpdate("error", {
    message: error?.message || "Update check failed",
  }))
  return autoUpdater
}

app.whenReady().then(async () => {
  adoptLegacySave(SAVE_NAME)
  adoptLegacySave(WINDOW_NAME)
  petChrome = readPetChrome()
  const root = path.join(app.getAppPath(), "dist")
  const { port } = await startServer(root)
  appPort = port
  createWindow(port)
  ensureUpdater()

  ipcMain.handle("tracker:load", () => readText(savePath(SAVE_NAME)))
  ipcMain.handle("tracker:save", (_event, raw) => {
    if (typeof raw !== "string") return
    writeText(savePath(SAVE_NAME), raw)
  })
  ipcMain.handle("tracker:top-get", () => Boolean(windowRef?.isAlwaysOnTop()))
  ipcMain.handle("tracker:top", (_event, on) => {
    const enabled = Boolean(on)
    windowRef?.setAlwaysOnTop(enabled, "floating")
    writeText(savePath(WINDOW_NAME), JSON.stringify({ alwaysOnTop: enabled }))
    return enabled
  })
  ipcMain.handle("updates:version", () => app.getVersion())
  ipcMain.handle("updates:check", async () => {
    const autoUpdater = ensureUpdater()
    if (!autoUpdater) return { supported: false }
    await autoUpdater.checkForUpdates().catch(() => {})
    return { supported: true }
  })
  ipcMain.handle("updates:download", async () => {
    const autoUpdater = ensureUpdater()
    if (!autoUpdater) return
    await autoUpdater.downloadUpdate().catch(() => {})
  })
  ipcMain.handle("tracker:notify", (_event, payload) => {
    if (!app.isPackaged || windowRef?.isFocused() || !Notification.isSupported()) return false
    const title = typeof payload?.title === "string" ? payload.title : ""
    const body = typeof payload?.body === "string" ? payload.body : ""
    if (!title) return false
    new Notification({ title, body }).show()
    return true
  })
  ipcMain.handle("updates:install", () => {
    const autoUpdater = ensureUpdater()
    if (!autoUpdater) return
    autoUpdater.quitAndInstall(false, true)
  })

  const helperPath = path.join(__dirname, "capture", "helper.cjs").replace(
    `${path.sep}app.asar${path.sep}`,
    `${path.sep}app.asar.unpacked${path.sep}`,
  )
  const liveSync = createLiveSession({
    execPath: process.execPath,
    helperPath,
    adapterFile: savePath("aion2-live-adapter.json"),
    send: (event) => {
      windowRef?.webContents.send("live-sync:event", event)
      const named = event?.type === "character" || (event?.type === "status" && event.phase === "capturing" && event.boundName)
      if (named) openPetWindow()
    },
  })
  stopLiveSync = () => liveSync.stop()
  ipcMain.handle("live-sync:get", () => liveSync.snapshot())
  ipcMain.handle("live-sync:set", (_event, on) => {
    const result = liveSync.setEnabled(Boolean(on))
    if (on) openPetWindow()
    return result
  })
  ipcMain.handle("live-sync:roster", (_event, names) => liveSync.setRoster(names))
  ipcMain.handle("live-sync:find", () => liveSync.findAdapter())
  ipcMain.handle("pet-pop:open", () => openPetWindow(true))
  ipcMain.handle("pet-pop:toggle", () => {
    if (petIsOpen()) {
      petWindow.close()
      return false
    }
    openPetWindow(true)
    return true
  })
  ipcMain.handle("pet-pop:close", () => {
    if (petWindow && !petWindow.isDestroyed()) petWindow.close()
    return false
  })
  ipcMain.handle("pet-pop:chrome", () => petChrome)
  ipcMain.handle("pet-pop:opacity", (_event, opacity) => {
    writePetChrome({ ...petChrome, opacity })
    return petChrome
  })
  ipcMain.handle("pet-pop:lock", (_event, locked) => {
    writePetChrome({ ...petChrome, locked: Boolean(locked) })
    if (petChrome.locked) rememberPetBounds()
    return petChrome
  })
  ipcMain.handle("pet-pop:current", () => petPopupState)
  ipcMain.on("pet-pop:state", (_event, state) => {
    petPopupState = state ?? null
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send("pet-pop:state", petPopupState)
    }
  })
  ipcMain.on("pet-pop:save", (event, payload) => {
    if (petWindow && event.sender === petWindow.webContents) {
      windowRef?.webContents.send("pet-pop:save", payload)
    }
  })
  ipcMain.on("pet-pop:goal", (event, payload) => {
    if (petWindow && event.sender === petWindow.webContents) {
      windowRef?.webContents.send("pet-pop:goal", payload)
    }
  })
  ipcMain.on("pet-pop:session", (event) => {
    if (petWindow && event.sender === petWindow.webContents) {
      windowRef?.webContents.send("pet-pop:session")
    }
  })
})

app.on("before-quit", () => {
  try {
    stopLiveSync()
  } catch {
    // helper already stopped
  }
})

app.on("window-all-closed", () => {
  app.quit()
})
