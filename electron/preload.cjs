const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("tracker", {
  loadFile: () => ipcRenderer.invoke("tracker:load"),
  saveFile: (raw) => ipcRenderer.invoke("tracker:save", raw),
  getAlwaysOnTop: () => ipcRenderer.invoke("tracker:top-get"),
  setAlwaysOnTop: (on) => ipcRenderer.invoke("tracker:top", on),
  notify: (payload) => ipcRenderer.invoke("tracker:notify", payload),
  getVersion: () => ipcRenderer.invoke("updates:version"),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  downloadUpdate: () => ipcRenderer.invoke("updates:download"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  onUpdate: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on("updates:status", listener)
    return () => ipcRenderer.removeListener("updates:status", listener)
  },
  getLiveSync: () => ipcRenderer.invoke("live-sync:get"),
  setLiveSync: (on) => ipcRenderer.invoke("live-sync:set", on),
  markLiveSync: (kind) => ipcRenderer.invoke("live-sync:mark", kind),
  findAdapter: () => ipcRenderer.invoke("live-sync:find"),
  onLiveEvent: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on("live-sync:event", listener)
    return () => ipcRenderer.removeListener("live-sync:event", listener)
  },
})
