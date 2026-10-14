const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("tracker", {
  loadFile: () => ipcRenderer.invoke("tracker:load"),
  saveFile: (raw) => ipcRenderer.invoke("tracker:save", raw),
  getAlwaysOnTop: () => ipcRenderer.invoke("tracker:top-get"),
  setAlwaysOnTop: (on) => ipcRenderer.invoke("tracker:top", on),
})
