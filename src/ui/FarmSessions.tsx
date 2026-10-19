import { formatElapsed, type FarmSession } from "../model/farmSession"

export function FarmSessionList({ sessions }: { sessions: FarmSession[] }) {
  if (!sessions.length) return <p className="muted">No farm sessions yet.</p>
  return (
    <ul className="farm-sessions">
      {sessions.map((session) => {
        const start = Date.parse(session.startedAt)
        const end = Date.parse(session.endedAt)
        const pets = session.pets.map((pet) => (
          pet.goal == null ? `${pet.name} ${pet.kills}` : `${pet.name} ${pet.kills}/${pet.goal}`
        )).join(", ")
        return (
          <li className="farm-session-row" key={session.id}>
            <div className="farm-session-meta">
              <span>{Number.isNaN(start) ? session.startedAt : new Date(start).toLocaleString()}</span>
              <span>{formatElapsed(end - start)}</span>
            </div>
            <p>{pets || "No kills"}</p>
          </li>
        )
      })}
    </ul>
  )
}
