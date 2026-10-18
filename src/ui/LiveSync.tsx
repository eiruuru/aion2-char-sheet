import type { LiveStatus } from "../model/liveSync"
import { LIVE_SYNC_EXPERIMENTAL } from "../model/liveSync"

const PHASE_LABEL: Record<LiveStatus["phase"], string> = {
  off: "Live Sync off",
  starting: "Live Sync starting",
  capturing: "Live Sync on",
  "needs-npcap": "Npcap missing",
  "needs-relog": "Re-log once",
  "needs-adapter": "Find Adapter",
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
  const on = status.phase === "starting" || status.phase === "capturing" || status.phase === "needs-relog" || status.phase === "needs-adapter"
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
  onFindAdapter,
}: {
  status: LiveStatus
  characterName: string | null
  desktop: boolean
  onFindAdapter: () => void
}) {
  if (!desktop) return <p className="muted live-note">Live Sync runs in the Windows app. Install Npcap, then turn it on there.</p>
  const watching = status.phase === "capturing" || status.phase === "needs-relog" || status.phase === "starting" || status.phase === "needs-adapter"
  return (
    <div className="live-note">
      <p className="muted">
        {status.detail || "Passive Npcap read. It does not log in or change the game."}
        {characterName && watching ? ` Following ${characterName}.` : ""}
      </p>
      {watching ? (
        <div className="live-marks">
          <button type="button" onClick={onFindAdapter}>Find Adapter</button>
        </div>
      ) : null}
    </div>
  )
}
