import { useEffect, useRef, useState } from "react"
import { PRIORITY_RANK, type ChecklistRow, type MarkOwner, type Priority } from "../model/checklist"

export function Checklist({
  cadence,
  rows,
  level,
  names,
  roles,
  characterId,
  onBoxes,
  onBank,
}: {
  cadence: "daily" | "weekly" | "season"
  rows: ChecklistRow[]
  level: number | null
  names: Record<string, string>
  roles: Record<string, "main" | "alt">
  characterId: string
  onBoxes: (taskId: string, owners: MarkOwner[]) => void
  onBank: (taskId: string, value: number) => void
}) {
  const group = rows.filter((row) => row.cadence === cadence)
  if (level == null) return <p>Refresh this character to place them on the daily and weekly list.</p>
  if (level < 45) return <p>Under level 45, this character only levels. Server pools and the endgame checklist stay off until 45.</p>
  if (!group.length) return <p className="muted">Nothing on this list.</p>
  return (
    <>
      {cadence === "season" ? (
        <p className="muted">Halloween runs through the Nov 4 maintenance. Conquerors of the Abyss rift stones run through the Oct 28 maintenance. Weekly limits clear Wednesday 3:00 PM.</p>
      ) : null}
      <TaskGroup title="" rows={group} names={names} roles={roles} characterId={characterId} onBoxes={onBoxes} onBank={onBank} />
    </>
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
  const ranked = [...rows].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
  const open = ranked.filter((row) => row.urgency !== "done")
  const done = ranked.filter((row) => row.urgency === "done")
  const rowProps = { names, roles, characterId, onBoxes, onBank }
  return (
    <div>
      {title ? <h4 className="group-label">{title}</h4> : null}
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
    </div>
  )
}

export function PriorityMark({ priority }: { priority: Priority }) {
  const label = `${priority[0].toUpperCase()}${priority.slice(1)} priority`
  return (
    <svg className={`priority priority-${priority}`} viewBox="0 0 16 16" fill="currentColor" aria-label={label} role="img">
      {priority === "critical" ? <path d="M8 1.6 14.2 8 8 14.4 1.8 8Z" /> : null}
      {priority === "high" ? <path d="M3 10.6 8 4.4 13 10.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {priority === "medium" ? <circle cx="8" cy="8" r="3.1" /> : null}
      {priority === "low" ? <path d="M3.2 8h9.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> : null}
    </svg>
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
  const entryBoxes = row.taskId === "transcendence" || row.taskId === "nightmare"
  const hasBoxes = row.parts.some((part) => part.cap > 0)
  const total = String(row.bank ?? 0)
  return (
    <li className={`check-row ${row.urgency}`} title={tip}>
      <span className="check-head">
        <span className="check-name">
          <span className={`mark ${markClass(row.urgency)}`} aria-label={markLabel(row.urgency)} />
          <PriorityMark priority={row.priority} />
          <span className="check-icon">
            {row.icon ? <img className="content-icon" src={row.icon} alt="" /> : null}
          </span>
          <span className="check-title">
            <strong className={`priority-name priority-${row.priority}`}>{row.name}</strong>
            {row.mode === "note" ? <p className="muted">{row.notes}</p> : null}
          </span>
          {row.shared ? <SharedMark /> : null}
        </span>
      </span>
      {row.mode !== "note" && (hasBoxes || entryBoxes) ? (
        <Ticks parts={row.parts} label={row.name} names={names} roles={roles} characterId={characterId} stock={row.stockBoxes} bank={row.bank} entryCount={entryBoxes ? row.bank ?? 0 : null} onBoxes={onBoxes} onBank={onBank} />
      ) : null}
      {row.mode !== "note" && row.bankCap != null ? (
        <span className="check-bank">
          <span className="bank stepper">
            Entries
            <button type="button" aria-label={`Decrease ${row.name} entries`} disabled={row.bank == null || row.bank <= 0} onClick={() => onBank(row.taskId, (row.bank ?? 0) - 1)}>−</button>
            <span className="bank-value">{total} / {row.bankCap}</span>
            <button type="button" aria-label={`Increase ${row.name} entries`} disabled={row.bank != null && row.bank >= row.bankCap} onClick={() => onBank(row.taskId, (row.bank ?? 0) + 1)}>+</button>
          </span>
          {row.timer ? <span className="muted bank-timer">{row.timer}</span> : null}
        </span>
      ) : null}
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
  entryCount,
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
  entryCount: number | null
  onBoxes: (taskId: string, owners: MarkOwner[]) => void
  onBank: (taskId: string, value: number) => void
}) {
  const lineRef = useRef<HTMLSpanElement>(null)
  const [perRow, setPerRow] = useState(8)
  useEffect(() => {
    const node = lineRef.current
    if (!node) return
    const measure = () => {
      const probe = node.querySelector("button.tick")
      const line = node.querySelector(".tick-line")
      if (!probe || !line) return
      const gap = parseFloat(getComputedStyle(line).columnGap || getComputedStyle(line).gap) || 0
      const box = probe.getBoundingClientRect().width
      if (box <= 0 || node.clientWidth <= 0) return
      const count = Math.max(1, Math.floor((node.clientWidth + gap) / (box + gap)))
      setPerRow((current) => current === count ? current : count)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const total = entryCount ?? parts.reduce((sum, part) => sum + part.owners.length, 0)
  const cap = entryCount ?? parts.reduce((sum, part) => sum + part.cap, 0)
  const spend = entryCount != null || stock
  const boxes = entryCount != null
    ? Array.from({ length: entryCount }, (_, index) => ({ part: parts[0], index }))
    : parts.flatMap((part) => Array.from({ length: part.cap }, (_, index) => ({ part, index })))
  const lines: typeof boxes[] = []
  for (let start = 0; start < boxes.length; start += perRow) lines.push(boxes.slice(start, start + perRow))
  if (entryCount != null && lines.length === 0) lines.push([])
  return (
    <span className="ticks" ref={lineRef} role="group" aria-label={entryCount != null ? `${label} ${entryCount} entries` : `${label} ${total} of ${cap}`}>
      {lines.map((line, lineIndex) => {
        const spare = lineIndex === lines.length - 1 && line.length < perRow ? perRow - line.length : 0
        return (
        <span key={lineIndex} className="tick-line">
          {line.map(({ part, index }) => {
            if (!part) return null
            const owner = entryCount == null && index < part.owners.length ? part.owners[index] : undefined
            const on = owner !== undefined
            const who = owner ? names[owner] ?? "Saved run" : null
            return (
              <button
                key={`${part.taskId}:${index}`}
                type="button"
                className={`${on ? `tick ${part.shared ? ownerClass(owner ?? null, roles) : "on"}` : "tick"}${part.shared ? " pool" : ""}`}
                aria-pressed={on}
                title={who ?? undefined}
                aria-label={spend ? `Spend one ${label}` : on ? `${who ?? "Someone"} ran ${label}` : `Mark ${label} for this character`}
                onClick={() => {
                  if (spend) {
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
          {Array.from({ length: spare }, (_, index) => (
            <button key={`unused-${index}`} type="button" className="tick unused" disabled aria-hidden="true" tabIndex={-1}>×</button>
          ))}
        </span>
        )
      })}
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
