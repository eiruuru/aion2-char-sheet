import packageJson from "../../package.json"

export const APP_VERSION: string = packageJson.version
export const UPDATE_SKIP_KEY = "aion2-update-skip"
export const WINDOW_TITLE = `AION 2 Character Sheet v${APP_VERSION}`

export type UpdateStatus = {
  status: "checking" | "available" | "none" | "downloading" | "downloaded" | "error"
  version?: string
  notes?: unknown
  percent?: number
  message?: string
}

export type UpdateOffer = {
  version: string
  notes: string
  phase: "available" | "downloading" | "downloaded"
  percent: number | null
}

export type UpdateView = {
  offer: UpdateOffer | null
  notice: string
  install: boolean
}

export function formatReleaseNotes(notes: unknown): string {
  if (typeof notes === "string") return notes.trim()
  if (!Array.isArray(notes)) return ""
  return notes
    .map((item) => {
      if (typeof item === "string") return item.trim()
      if (item && typeof item === "object" && "note" in item) {
        const note = item.note
        return typeof note === "string" ? note.trim() : ""
      }
      return ""
    })
    .filter(Boolean)
    .join("\n\n")
}

export function shouldOfferUpdate(version: string, skipped: string | null, manual: boolean): boolean {
  if (!version) return false
  if (manual) return true
  return skipped !== version
}

export function reduceUpdateStatus(current: UpdateOffer | null, status: UpdateStatus, skipped: string | null, manual: boolean): UpdateView {
  if (status.status === "checking") return { offer: current, notice: "", install: false }
  if (status.status === "none") return { offer: null, notice: manual ? "Up to date" : "", install: false }
  if (status.status === "error") {
    const offer = current?.phase === "downloading" ? { ...current, phase: "available" as const, percent: null } : current
    return { offer, notice: manual ? status.message || "Couldn't check for updates" : "", install: false }
  }
  if (status.status === "available") {
    const version = status.version ?? ""
    if (!shouldOfferUpdate(version, skipped, manual)) return { offer: current, notice: "", install: false }
    return {
      offer: { version, notes: formatReleaseNotes(status.notes), phase: "available", percent: null },
      notice: "",
      install: false,
    }
  }
  if (status.status === "downloading") {
    if (!current) return { offer: null, notice: "", install: false }
    return { offer: { ...current, phase: "downloading", percent: status.percent ?? 0 }, notice: "", install: false }
  }
  const version = status.version || current?.version || ""
  return {
    offer: {
      version,
      notes: formatReleaseNotes(status.notes) || current?.notes || "",
      phase: "downloaded",
      percent: 100,
    },
    notice: "",
    install: true,
  }
}
