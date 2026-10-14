import { describe, expect, it } from "vitest"
import { formatReleaseNotes, reduceUpdateStatus, shouldOfferUpdate, type UpdateOffer } from "./updates"

describe("formatReleaseNotes", () => {
  it("keeps a release description", () => {
    expect(formatReleaseNotes("  Fixes the checklist.\nAdds the update card.  ")).toBe(
      "Fixes the checklist.\nAdds the update card.",
    )
  })

  it("joins note entries and drops empty ones", () => {
    expect(formatReleaseNotes([
      { version: "0.4.0", note: "Checklist rows wrap." },
      { version: "0.3.1", note: "   " },
      "Window title shows the version.",
    ])).toBe("Checklist rows wrap.\n\nWindow title shows the version.")
  })

  it("returns an empty string when a release has no notes", () => {
    expect(formatReleaseNotes(null)).toBe("")
    expect(formatReleaseNotes(undefined)).toBe("")
  })
})

describe("shouldOfferUpdate", () => {
  it("hides a version the user chose to stay on", () => {
    expect(shouldOfferUpdate("0.4.0", "0.4.0", false)).toBe(false)
  })

  it("shows a newer version and a manual check of the skipped one", () => {
    expect(shouldOfferUpdate("0.5.0", "0.4.0", false)).toBe(true)
    expect(shouldOfferUpdate("0.4.0", "0.4.0", true)).toBe(true)
    expect(shouldOfferUpdate("", null, true)).toBe(false)
  })
})

describe("reduceUpdateStatus", () => {
  const offer: UpdateOffer = { version: "0.4.0", notes: "Notes", phase: "available", percent: null }

  it("stays quiet when the launch check finds nothing", () => {
    expect(reduceUpdateStatus(null, { status: "none" }, null, false)).toEqual({ offer: null, notice: "", install: false })
  })

  it("offers a release and installs only after the download finishes", () => {
    const shown = reduceUpdateStatus(null, { status: "available", version: "0.4.0", notes: "Checklist rows wrap." }, null, false)
    expect(shown.offer).toEqual({ version: "0.4.0", notes: "Checklist rows wrap.", phase: "available", percent: null })
    expect(shown.install).toBe(false)
    const progress = reduceUpdateStatus(shown.offer, { status: "downloading", percent: 40 }, null, true)
    expect(progress.offer?.phase).toBe("downloading")
    expect(progress.offer?.percent).toBe(40)
    const done = reduceUpdateStatus(progress.offer, { status: "downloaded", version: "0.4.0" }, null, true)
    expect(done.install).toBe(true)
    expect(done.offer?.phase).toBe("downloaded")
  })

  it("keeps a skipped release hidden until the check is manual", () => {
    expect(reduceUpdateStatus(null, { status: "available", version: "0.4.0", notes: "Notes" }, "0.4.0", false).offer).toBeNull()
    expect(reduceUpdateStatus(offer, { status: "available", version: "0.4.0", notes: "Notes" }, "0.4.0", true).offer?.version).toBe("0.4.0")
  })

  it("reports an up to date check only when the user asked", () => {
    expect(reduceUpdateStatus(null, { status: "none" }, null, true).notice).toBe("Up to date")
    expect(reduceUpdateStatus(offer, { status: "error", message: "Offline" }, null, false).notice).toBe("")
    expect(reduceUpdateStatus(offer, { status: "error", message: "Offline" }, null, true).notice).toBe("Offline")
    const failed = reduceUpdateStatus({ ...offer, phase: "downloading", percent: 20 }, { status: "error", message: "Offline" }, null, true)
    expect(failed.offer?.phase).toBe("available")
  })
})
