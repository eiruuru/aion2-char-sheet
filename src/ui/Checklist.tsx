import { useState } from "react"
import type { ChecklistRow, MarkOwner, SessionItem } from "../model/checklist"
import { formatCountdown } from "../model/format"
import { nextDailyReset, nextWeeklyReset, upcomingBosses } from "../model/schedule"

const BANDS = [
  { id: "lost", label: "Do now" },
  { id: "today", label: "Still today" },
  { id: "week", label: "Before Wednesday" },
] as const

export function SessionStrip({
  items,
  now,
  onOpen,
}: {
  items: SessionItem[]
  now: number
  onOpen: (characterId: string) => void
}) {
  const [open, setOpen] = useState(true)
  const bosses = upcomingBosses(now)
  const bands = BANDS.map((band) => ({
    ...band,
    groups: groupByTask(items.filter((item) => item.band === band.id)),
  })).filter((band) => band.groups.length)
  const dailyLeft = formatCountdown(nextDailyReset(now) - now)
  const weeklyLeft = formatCountdown(nextWeeklyReset(now) - now)
  return (
    <section className="panel session">
      <details className="today-fold" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>
          <span className="roster-top">
            <h2>Today</h2>
            <span className="muted">Daily reset in {dailyLeft} · Weekly reset in {weeklyLeft}</span>
          </span>
          <span className="muted boss-line">
            {bosses.map((boss) => `${boss.name} ${formatCountdown(boss.at - now)}`).join(" · ")}
          </span>
        </summary>
        {bands.length ? (
          <div className="today-bands">
            {bands.map((band) => (
              <div key={band.id}>
                <h3 className="group-label">{band.label}</h3>
                <div className="today-grid">
                  {band.groups.map(([taskName, people]) => {
                    const shared = people[0]?.shared
                    return (
                      <article key={taskName} className="task-card">
                        <h3>
                          {people[0]?.icon ? <img className="content-icon" src={people[0].icon} alt="" /> : null}
                          <span>{taskName}</span>
                          {shared ? <span className="muted">{people[0].count}/{people[0].cap}</span> : null}
                        </h3>
                        <div className="who">
                          {people.map((person) => (
                            person.characterId ? (
                              <button key={person.id} type="button" title={person.characterName ?? person.detail} aria-label={person.characterName ?? person.detail} onClick={() => onOpen(person.characterId!)}>
                                {person.portrait ? <img src={person.portrait} alt="" /> : <span className="initial">{(person.characterName ?? "?").slice(0, 1)}</span>}
                              </button>
                            ) : (
                              <span key={person.id}>{person.detail}</span>
                            )
                          ))}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>Nothing left that has to be done today.</p>
        )}
      </details>
    </section>
  )
}

function groupByTask(items: SessionItem[]): [string, SessionItem[]][] {
  const groups = new Map<string, SessionItem[]>()
  for (const item of items) {
    const list = groups.get(item.taskName) ?? []
    list.push(item)
    groups.set(item.taskName, list)
  }
  return [...groups.entries()]
}

export function Checklist({
  rows,
  level,
  names,
  roles,
  characterId,
  onBoxes,
  onBank,
}: {
  rows: ChecklistRow[]
  level: number | null
  names: Record<string, string>
  roles: Record<string, "main" | "alt">
  characterId: string
  onBoxes: (taskId: string, owners: MarkOwner[]) => void
  onBank: (taskId: string, value: number) => void
}) {
  return (
    <section className="panel">
      <h3>Checklist</h3>
      {level == null ? (
        <p>Refresh this character to place them on the daily and weekly list.</p>
      ) : level < 45 ? (
        <p>Under level 45, this character only levels. Server pools and the endgame checklist stay off until 45.</p>
      ) : (
        <div className="check-columns">
          <TaskGroup title="Daily" rows={rows.filter((row) => row.cadence === "daily")} names={names} roles={roles} characterId={characterId} onBoxes={onBoxes} onBank={onBank} />
          <TaskGroup title="Weekly" rows={rows.filter((row) => row.cadence === "weekly")} names={names} roles={roles} characterId={characterId} onBoxes={onBoxes} onBank={onBank} />
        </div>
      )}
    </section>
  )
}

function TaskGroup({
  title,
  rows,
  names,
  roles,
  characterId,
  onBoxes,
  onBank,
}: {
  title: string
  rows: ChecklistRow[]
  names: Record<string, string>
  roles: Record<string, "main" | "alt">
  characterId: string
  onBoxes: (taskId: string, owners: MarkOwner[]) => void
  onBank: (taskId: string, value: number) => void
}) {
  if (!rows.length) return null
  const optional = rows.filter((row) => row.tag === "optional")
  const core = rows.filter((row) => row.tag !== "optional")
  const open = core.filter((row) => row.urgency !== "done")
  const done = core.filter((row) => row.urgency === "done")
  const rowProps = { names, roles, characterId, onBoxes, onBank }
  return (
    <div>
      <h4 className="group-label">{title}</h4>
      <ul className="checklist">
        {open.map((row) => (
          <Row key={row.taskId} row={row} {...rowProps} />
        ))}
      </ul>
      {done.length ? (
        <details className="fold">
          <summary>Done {done.length}</summary>
          <ul className="checklist">
            {done.map((row) => (
              <Row key={row.taskId} row={row} {...rowProps} />
            ))}
          </ul>
        </details>
      ) : null}
      {optional.length ? (
        <details className="fold">
          <summary>Optional {optional.length}</summary>
          <ul className="checklist">
            {optional.map((row) => (
              <Row key={row.taskId} row={row} {...rowProps} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

function Row({
  row,
  names,
  roles,
  characterId,
  onBoxes,
  onBank,
}: {
  row: ChecklistRow
  names: Record<string, string>
  roles: Record<string, "main" | "alt">
  characterId: string
  onBoxes: (taskId: string, owners: MarkOwner[]) => void
  onBank: (taskId: string, value: number) => void
}) {
  const tip = [row.notes, row.reason, row.timer].filter(Boolean).join(" ")
  return (
    <li className={`check-row ${row.urgency}`} title={tip}>
      <span className="check-name">
        <span className={`mark ${markClass(row.urgency)}`} aria-label={markLabel(row.urgency)} />
        {row.icon ? <img className="content-icon" src={row.icon} alt="" /> : null}
        <strong>{row.name}</strong>
        {row.shared ? <SharedMark /> : null}
      </span>
      <span className="steppers">
        <Ticks parts={row.parts} label={row.name} names={names} roles={roles} characterId={characterId} stock={row.stockBoxes} bank={row.bank} onBoxes={onBoxes} onBank={onBank} />
        {row.bankCap != null ? (
          <span className="bank stepper">
            Bank
            <button type="button" aria-label={`Decrease ${row.name} bank`} disabled={row.bank == null || row.bank <= 0} onClick={() => onBank(row.taskId, (row.bank ?? 0) - 1)}>−</button>
            <span>{row.bank == null ? "—" : `${row.bank}/${row.bankCap}`}</span>
            <button type="button" aria-label={`Increase ${row.name} bank`} disabled={row.bank != null && row.bank >= row.bankCap} onClick={() => onBank(row.taskId, (row.bank ?? 0) + 1)}>+</button>
            {row.timer ? <span className="muted">{row.timer}</span> : null}
          </span>
        ) : null}
      </span>
    </li>
  )
}

function Ticks({
  parts,
  label,
  names,
  roles,
  characterId,
  stock,
  bank,
  onBoxes,
  onBank,
}: {
  parts: ChecklistRow["parts"]
  label: string
  names: Record<string, string>
  roles: Record<string, "main" | "alt">
  characterId: string
  stock: boolean
  bank: number | null
  onBoxes: (taskId: string, owners: MarkOwner[]) => void
  onBank: (taskId: string, value: number) => void
}) {
  const total = parts.reduce((sum, part) => sum + part.owners.length, 0)
  const cap = parts.reduce((sum, part) => sum + part.cap, 0)
  const boxes = parts.flatMap((part) => Array.from({ length: part.cap }, (_, index) => ({ part, index })))
  const lines: typeof boxes[] = []
  for (let start = 0; start < boxes.length; start += 10) lines.push(boxes.slice(start, start + 10))
  return (
    <span className="ticks" role="group" aria-label={`${label} ${total} of ${cap}`}>
      {lines.map((line, lineIndex) => (
        <span key={lineIndex} className="tick-line">
          {line.map(({ part, index }) => {
            const owner = index < part.owners.length ? part.owners[index] : undefined
            const on = owner !== undefined
            const who = owner ? names[owner] ?? "Saved run" : null
            return (
              <button
                key={`${part.taskId}:${index}`}
                type="button"
                className={`${on ? `tick ${part.shared ? ownerClass(owner ?? null, roles) : "on"}` : "tick"}${part.shared ? " pool" : ""}`}
                aria-pressed={on}
                title={who ?? undefined}
                aria-label={stock ? `Spend one ${label}` : on ? `${who ?? "Someone"} ran ${label}` : `Mark ${label} for this character`}
                onClick={() => {
                  if (stock) {
                    onBank(part.taskId, Math.max(0, (bank ?? 0) - 1))
                    return
                  }
                  if (part.shared) {
                    const next = on
                      ? part.owners.filter((_, ownerIndex) => ownerIndex !== index)
                      : [...part.owners, characterId]
                    onBoxes(part.taskId, next)
                    return
                  }
                  const length = on ? index : index + 1
                  onBoxes(part.taskId, Array.from({ length }, () => characterId))
                }}
              >
                {on ? "✓" : ""}
              </button>
            )
          })}
        </span>
      ))}
    </span>
  )
}

function SharedMark() {
  return (
    <span className="shared-mark" title="Shared on this server" aria-label="Shared on this server">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="5.2" cy="5" r="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="11" cy="5.6" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M1.6 13.2c.4-2.1 1.9-3.1 3.6-3.1s3.2 1 3.6 3.1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M9.4 10.4c.6-.4 1.3-.6 2.1-.6 1.3 0 2.4.6 2.8 2.1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  )
}

function ownerClass(id: string | null, roles: Record<string, "main" | "alt">): string {
  if (!id) return "on"
  if (roles[id] === "main") return "on owner-main"
  const alts = Object.entries(roles)
    .filter(([, role]) => role !== "main")
    .map(([altId]) => altId)
    .sort()
  const index = alts.indexOf(id)
  if (index >= 0) return `on owner-${index % 6}`
  let hash = 0
  for (let cursor = 0; cursor < id.length; cursor += 1) hash = (hash + id.charCodeAt(cursor) * (cursor + 1)) % 6
  return `on owner-${hash}`
}

function markClass(urgency: ChecklistRow["urgency"]): string {
  if (urgency === "do-now") return "lost"
  if (urgency === "before-wednesday") return "week"
  if (urgency === "can-wait") return "wait"
  if (urgency === "done") return "done"
  return "today"
}

function markLabel(urgency: ChecklistRow["urgency"]): string {
  if (urgency === "do-now") return "Do now"
  if (urgency === "can-wait") return "Can wait"
  if (urgency === "before-wednesday") return "Before Wednesday"
  if (urgency === "done") return "Done"
  return "Today"
}
