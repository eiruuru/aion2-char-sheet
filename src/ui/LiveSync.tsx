import type { LiveStatus } from "../model/liveSync"
import { LIVE_SYNC_EXPERIMENTAL } from "../model/liveSync"

const PHASE_LABEL: Record<LiveStatus["phase"], string> = {
  off: "Live Sync off",
  starting: "Live Sync starting",
  capturing: "Live Sync on",
  "needs-npcap": "Npcap missing",
  "needs-relog": "Re-log once",
  unavailable: "Live Sync unavailable",
}

export function LiveSyncButton({
  status,
  desktop,
  onToggle,
}: {
  status: LiveStatus
  desktop: boolean
  onToggle: () => void
}) {
  const on = status.phase === "starting" || status.phase === "capturing" || status.phase === "needs-relog"
  const label = desktop ? PHASE_LABEL[status.phase] : "Live Sync"
  return (
    <button
      type="button"
      className={on ? "live-sync on" : "live-sync"}
      aria-pressed={on}
      title={status.detail || "Optional Windows capture for pet souls and Odyle"}
      onClick={onToggle}
    >
      {label}
      {LIVE_SYNC_EXPERIMENTAL ? <span>Experimental</span> : null}
    </button>
  )
}

export function LiveSyncNote({
  status,
  characterName,
  desktop,
  onMark,
}: {
  status: LiveStatus
  characterName: string | null
  desktop: boolean
  onMark: (kind: "pet" | "odyle") => void
}) {
  if (!desktop) return <p className="muted live-note">Live Sync runs in the Windows app. Install Npcap, then turn it on there.</p>
  const watching = status.phase === "capturing" || status.phase === "needs-relog" || status.phase === "starting"
  return (
    <div className="live-note">
      <p className="muted">
        {status.detail || "Passive Npcap read. It does not log in or change the game."}
        {characterName && watching ? ` Bound to ${characterName}.` : ""}
      </p>
      {watching ? (
        <div className="live-marks">
          <button type="button" onClick={() => onMark("pet")}>Mark pet soul gain</button>
          <button type="button" onClick={() => onMark("odyle")}>Mark Odyle change</button>
        </div>
      ) : null}
    </div>
  )
}
