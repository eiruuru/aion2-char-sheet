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
  setLiveRoster: (names) => ipcRenderer.invoke("live-sync:roster", names),
  findAdapter: () => ipcRenderer.invoke("live-sync:find"),
  onLiveEvent: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on("live-sync:event", listener)
    return () => ipcRenderer.removeListener("live-sync:event", listener)
  },
  openPetPopup: () => ipcRenderer.invoke("pet-pop:open"),
  togglePetPopup: () => ipcRenderer.invoke("pet-pop:toggle"),
  onPetVisible: (callback) => {
    const listener = (_event, open) => callback(Boolean(open))
    ipcRenderer.on("pet-pop:visible", listener)
    return () => ipcRenderer.removeListener("pet-pop:visible", listener)
  },
  closePetPopup: () => ipcRenderer.invoke("pet-pop:close"),
  getPetChrome: () => ipcRenderer.invoke("pet-pop:chrome"),
  setPetOpacity: (opacity) => ipcRenderer.invoke("pet-pop:opacity", opacity),
  setPetLocked: (locked) => ipcRenderer.invoke("pet-pop:lock", locked),
  setPetGoal: (payload) => ipcRenderer.send("pet-pop:goal", payload),
  toggleFarmSession: () => ipcRenderer.send("pet-pop:session"),
  publishPetPopup: (state) => ipcRenderer.send("pet-pop:state", state),
  currentPetPopup: () => ipcRenderer.invoke("pet-pop:current"),
  onPetPopup: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on("pet-pop:state", listener)
    return () => ipcRenderer.removeListener("pet-pop:state", listener)
  },
  savePetPopup: (payload) => ipcRenderer.send("pet-pop:save", payload),
  onPetSave: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on("pet-pop:save", listener)
    return () => ipcRenderer.removeListener("pet-pop:save", listener)
  },
  onPetGoal: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on("pet-pop:goal", listener)
    return () => ipcRenderer.removeListener("pet-pop:goal", listener)
  },
  onPetSession: (callback) => {
    const listener = () => callback()
    ipcRenderer.on("pet-pop:session", listener)
    return () => ipcRenderer.removeListener("pet-pop:session", listener)
  },
})
