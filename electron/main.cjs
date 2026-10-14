const { app, BrowserWindow, ipcMain } = require("electron")
const fs = require("fs")
const http = require("http")
const https = require("https")
const path = require("path")

const SAVE_NAME = "aion2-tracker.json"
const WINDOW_NAME = "aion2-window.json"

function besideApp(name) {
  const folder = app.isPackaged ? path.dirname(process.execPath) : app.getPath("userData")
  return path.join(folder, name)
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

function proxy(req, res, origin, prefix) {
  const incoming = new URL(req.url, "http://127.0.0.1")
  const target = new URL(origin)
  const upstreamPath = incoming.pathname.replace(new RegExp(`^${prefix}`), "") + incoming.search
  const upstream = https.request(
    {
      hostname: target.hostname,
      path: upstreamPath,
      method: "GET",
      headers: {
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
    const saved = readText(besideApp(WINDOW_NAME))
    above = saved ? Boolean(JSON.parse(saved).alwaysOnTop) : false
  } catch {
    above = false
  }
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    title: "Aion 2 progress",
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

app.whenReady().then(async () => {
  const root = path.join(app.getAppPath(), "dist")
  const { port } = await startServer(root)
  createWindow(port)

  ipcMain.handle("tracker:load", () => readText(besideApp(SAVE_NAME)))
  ipcMain.handle("tracker:save", (_event, raw) => {
    if (typeof raw !== "string") return
    writeText(besideApp(SAVE_NAME), raw)
  })
  ipcMain.handle("tracker:top-get", () => Boolean(windowRef?.isAlwaysOnTop()))
  ipcMain.handle("tracker:top", (_event, on) => {
    const enabled = Boolean(on)
    windowRef?.setAlwaysOnTop(enabled, "floating")
    writeText(besideApp(WINDOW_NAME), JSON.stringify({ alwaysOnTop: enabled }))
    return enabled
  })
})

app.on("window-all-closed", () => {
  app.quit()
})
