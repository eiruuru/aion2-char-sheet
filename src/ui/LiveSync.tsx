import type { LiveStatus } from "../model/liveSync"
import { GuideIcon, SheetIcon } from "./icons"

function streamState(status: LiveStatus, desktop: boolean): { text: string; tone: "found" | "looking" | "idle" } {
  if (!desktop) return { text: "in the Windows app", tone: "idle" }
  if (status.phase === "needs-npcap") return { text: "needs Npcap", tone: "looking" }
  if (status.phase === "unavailable") return { text: "unavailable", tone: "looking" }
  if (status.phase === "off") return { text: "off", tone: "idle" }
  if (status.phase === "capturing" && status.boundName) return { text: "found", tone: "found" }
  return { text: "looking", tone: "looking" }
}

export function LiveStatusStrip({
  status,
  characterName,
  farmingName,
  sessionOn,
  desktop,
  onToggle,
  onToggleSession,
  onOpenFarm,
  farmOpen,
  onToggleFarm,
  onFindAdapter,
  view,
  onView,
}: {
  status: LiveStatus
  characterName: string | null
  farmingName: string | null
  sessionOn: boolean
  desktop: boolean
  onToggle: () => void
  onToggleSession: () => void
  onOpenFarm: () => void
  farmOpen: boolean
  onToggleFarm: () => void
  onFindAdapter: () => void
  view: "sheet" | "guide"
  onView: (view: "sheet" | "guide") => void
}) {
  const stream = streamState(status, desktop)
  return (
    <div className="live-row">
    <div className="live-strip" role="status">
      <button
        type="button"
        className={`live-chip ${stream.tone}`}
        title={status.detail || "Turn packet reading on or off"}
        onClick={onToggle}
      >
        <span className="live-dot" />
        Stream: {stream.text}
      </button>
      <span className={characterName ? "live-chip found" : "live-chip"}>
        <span className="live-dot" />
        Character: {characterName || "—"}
      </span>
      <button
        type="button"
        className={sessionOn ? "live-chip found" : "live-chip"}
        title={sessionOn ? "Stop counting kills" : "Count kills until you turn this off"}
        onClick={onToggleSession}
      >
        <span className="live-dot" />
        Session: {sessionOn ? "on" : "off"}
      </button>
      <button type="button" className={farmingName ? "live-chip found" : "live-chip"} onClick={onOpenFarm}>
        <span className="live-dot" />
        Farming: {farmingName || "—"}
      </button>
      {status.phase === "needs-adapter" ? (
        <button type="button" className="live-find" onClick={onFindAdapter}>Find adapter</button>
      ) : null}
    </div>
      <div className="live-views" role="group" aria-label="Character view" data-tour="view">
        <button type="button" className={view === "sheet" ? "live-moon open" : "live-moon"} aria-pressed={view === "sheet"} aria-label="Character sheet" title="Character sheet" onClick={() => onView("sheet")}>
          <SheetIcon />
        </button>
        <button type="button" className={view === "guide" ? "live-moon open" : "live-moon"} aria-pressed={view === "guide"} aria-label="Class guide" title="Class guide" onClick={() => onView("guide")}>
          <GuideIcon />
        </button>
      </div>
      <button type="button" className={farmOpen ? "live-moon open" : "live-moon"} aria-pressed={farmOpen} aria-label={farmOpen ? "Close pet progress" : "Open pet progress"} title={farmOpen ? "Close pet progress" : "Open pet progress"} onClick={onToggleFarm}>
        <MoonIcon />
      </button>
    </div>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M10.2 2.2a5.6 5.6 0 1 0 3.6 8.8 4.6 4.6 0 0 1-3.6-8.8Z" fill="currentColor" />
    </svg>
  )
}
