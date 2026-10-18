import type { LiveEvent, LiveStatus } from "./model/liveSync"
import type { UpdateStatus } from "./model/updates"

const STORAGE_KEY = "aion2-tracker-v1"

export type { UpdateStatus }

type TrackerBridge = {
  loadFile: () => Promise<string | null>
  saveFile: (raw: string) => Promise<void>
  getAlwaysOnTop: () => Promise<boolean>
  setAlwaysOnTop: (on: boolean) => Promise<boolean>
  notify: (payload: { title: string; body: string }) => Promise<boolean>
  getVersion: () => Promise<string>
  checkForUpdates: () => Promise<{ supported: boolean }>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
  onUpdate: (callback: (status: UpdateStatus) => void) => () => void
  getLiveSync: () => Promise<LiveStatus & { npcap: boolean }>
  setLiveSync: (on: boolean) => Promise<LiveStatus & { npcap: boolean }>
  markLiveSync: (kind: "pet" | "odyle") => Promise<boolean>
  onLiveEvent: (callback: (event: LiveEvent) => void) => () => void
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
