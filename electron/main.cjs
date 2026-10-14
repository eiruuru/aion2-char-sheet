const { app, BrowserWindow, ipcMain, Notification } = require("electron")

if (app.isPackaged) app.setName("Aion 2 Progress")
const fs = require("fs")
const http = require("http")
const https = require("https")
const path = require("path")

const SAVE_NAME = "aion2-tracker.json"
const WINDOW_NAME = "aion2-window.json"

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
    if (incoming.pathname.startsWith("/guide-vault")) {
      proxy(req, res, "https://aion2vault.com", "/guide-vault", {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 (compatible; Aion2Progress/0.3)",
      })
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
  void win.loadURL(`http://127.0.0.1:${port}/`)
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
  const root = path.join(app.getAppPath(), "dist")
  const { port } = await startServer(root)
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
})

app.on("window-all-closed", () => {
  app.quit()
})
