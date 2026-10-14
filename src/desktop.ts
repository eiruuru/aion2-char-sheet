const STORAGE_KEY = "aion2-tracker-v1"

type TrackerBridge = {
  loadFile: () => Promise<string | null>
  saveFile: (raw: string) => Promise<void>
  getAlwaysOnTop: () => Promise<boolean>
  setAlwaysOnTop: (on: boolean) => Promise<boolean>
}

declare global {
  interface Window {
    tracker?: TrackerBridge
  }
}

export function desktopBridge(): TrackerBridge | null {
  return window.tracker ?? null
}

export async function hydrateDesktopSave(): Promise<void> {
  const raw = await window.tracker?.loadFile()
  if (!raw) return
  localStorage.setItem(STORAGE_KEY, raw)
}
