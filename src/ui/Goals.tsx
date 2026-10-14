import { useEffect, useState } from "react"
import type { CharacterRecord } from "../model/store"
import { parseStoredNumber } from "../model/store"
import { formatCountdown, formatNumber, formatWhen } from "../model/format"
import { CUBE_COST, type OdyleProjection } from "../model/odyle"
import { characterGoals, GOAL_KINDS, type ChecklistRow, type GoalLine } from "../model/checklist"
import type { Suggestion } from "../model/suggestions"
import { Sparkline } from "./Sparkline"

export function GoalsPanel({
  character,
  rows,
  suggestions,
  projection,
  now,
  onSaveOdyle,
  onSetOdyleTimer,
  onSpendCube,
}: {
  character: CharacterRecord | null
  rows: ChecklistRow[]
  suggestions: Suggestion[]
  projection: OdyleProjection | null
  now: number
  onSaveOdyle: (amount: number) => void
  onSetOdyleTimer: (remainingMs: number) => void
  onSpendCube: () => void
}) {
  const [tab, setTab] = useState<"goals" | "advice">("goals")
  const goals = characterGoals(rows, now, projection)
  return (
    <aside className="side-column">
      {character ? (
        <OdyleCard
          character={character}
          projection={projection}
          now={now}
          onSave={onSaveOdyle}
          onSetTimer={onSetOdyleTimer}
          onSpendCube={onSpendCube}
        />
      ) : null}
      <section className="goals panel">
        <div className="tabs" role="tablist" aria-label="Goals">
          <button type="button" role="tab" aria-selected={tab === "goals"} onClick={() => setTab("goals")}>Goals</button>
          <button type="button" role="tab" aria-selected={tab === "advice"} onClick={() => setTab("advice")}>Advice</button>
        </div>
        <div className="goals-scroll">
          {tab === "advice" ? (
            <AdviceView character={character} suggestions={suggestions} />
          ) : (
            <>
              {character ? null : <p className="muted">Add a character to track goals.</p>}
              <GoalGroup title="Today" lines={goals.today} empty="Nothing is due in the next two days." />
              <GoalGroup title="Later" lines={goals.later} empty="No other open goals." />
            </>
          )}
        </div>
      </section>
    </aside>
  )
}

function AdviceView({ character, suggestions }: { character: CharacterRecord | null; suggestions: Suggestion[] }) {
  if (!character) return <p className="muted">Add a character to see advice.</p>
  const snapshot = character.latest
  return (
    <>
      <h3>Where to spend next</h3>
      <ul className="suggestions">
        {suggestions.length ? suggestions.map((suggestion) => (
          <li key={suggestion.id}>
            <strong>{suggestion.title}</strong>
            <p>{suggestion.detail}</p>
          </li>
        )) : <li>Nothing to suggest until this character has a profile.</li>}
      </ul>
      <h3>Combat power</h3>
      {snapshot ? (
        <>
          <Sparkline values={character.history.map((point) => point.combatPower)} />
          {character.history.length >= 2 ? (
            <p className="muted">
              First saved reading {formatNumber(character.history[0].combatPower)} on {formatWhen(character.history[0].at)}.
              Latest {formatNumber(snapshot.combatPower)}.
            </p>
          ) : null}
        </>
      ) : <p>Refresh this character to start a combat-power history.</p>}
    </>
  )
}

function GoalGroup({ title, lines, empty }: { title: string; lines: GoalLine[]; empty: string }) {
  const kinds = GOAL_KINDS.map((kind) => ({
    ...kind,
    lines: lines.filter((line) => line.kind === kind.id),
  })).filter((kind) => kind.lines.length)
  return (
    <section className="goal-group">
      <h3>{title}</h3>
      {kinds.length ? kinds.map((kind) => (
        <GoalKind key={kind.id} label={kind.label} lines={kind.lines} />
      )) : <p className="muted">{empty}</p>}
    </section>
  )
}

function GoalKind({ label, lines }: { label: string; lines: GoalLine[] }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="goal-kind">
      <button type="button" className="group-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <ChevronIcon />
        {label}
      </button>
      {open ? (
        <ul className="quests">
          {lines.map((line) => (
            <li key={line.id} className="quest">
              {line.icon ? <img className="content-icon" src={line.icon} alt="" /> : <span className="quest-mark" aria-hidden="true" />}
              <span>
                <strong>{line.title}</strong>
                {line.detail ? <p className="muted">{line.detail}</p> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 6.2 8 10.2 12 6.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function OdyleCard({
  character,
  projection,
  now,
  onSave,
  onSetTimer,
  onSpendCube,
}: {
  character: CharacterRecord
  projection: OdyleProjection | null
  now: number
  onSave: (amount: number) => void
  onSetTimer: (remainingMs: number) => void
  onSpendCube: () => void
}) {
  const [amountDraft, setAmountDraft] = useState(character.odyle ? String(character.odyle.amount) : "")
  const [hourDraft, setHourDraft] = useState("")
  const [minuteDraft, setMinuteDraft] = useState("")
  useEffect(() => {
    setAmountDraft(character.odyle ? String(character.odyle.amount) : "")
    if (!projection?.nextTickAt) {
      setHourDraft("")
      setMinuteDraft("")
      return
    }
    const totalMinutes = Math.floor(Math.max(0, projection.nextTickAt - Date.now()) / 60000)
    setHourDraft(String(Math.floor(totalMinutes / 60)))
    setMinuteDraft(String(totalMinutes % 60))
  }, [character.id, character.odyle?.amount, character.odyle?.readAt, projection?.nextTickAt])
  const timerPaused = !projection || projection.full || projection.aboveCap || projection.nextTickAt == null
  return (
    <section className="panel odyle-card">
      <h2>Odyle energy</h2>
      {projection ? (
        <>
          <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={projection.cap} aria-valuenow={Math.min(projection.current, projection.cap)} aria-label="Odyle energy">
            <span style={{ width: `${Math.min(100, (projection.current / projection.cap) * 100)}%` }} />
          </div>
          <p className="odyle-readout">
            <strong>{formatNumber(projection.current)} / {formatNumber(projection.cap)}</strong>
            {projection.aboveCap ? " · regen paused" : null}
            {projection.full && !projection.aboveCap ? " · at the cap" : null}
            {!projection.full && !projection.aboveCap && projection.nextTickAt ? ` · +15 in ${formatCountdown(projection.nextTickAt - now)}` : null}
            {!projection.full && projection.fullAt ? ` · full in ${formatCountdown(projection.fullAt - now)}` : null}
          </p>
        </>
      ) : <p className="muted">No reading yet.</p>}
      <div className="odyle-controls">
        <label>
          Reading
          <input inputMode="numeric" autoComplete="off" value={amountDraft} onChange={(event) => setAmountDraft(event.target.value)} />
        </label>
        <button type="button" className="icon-button" aria-label="Save reading" title="Save reading" onClick={() => {
          const amount = parseStoredNumber(amountDraft)
          if (amount == null) return
          onSave(amount)
        }}>
          <CheckIcon />
        </button>
        <label>
          Hours
          <input className="timer-input" inputMode="numeric" autoComplete="off" value={hourDraft} disabled={timerPaused} onChange={(event) => setHourDraft(event.target.value)} />
        </label>
        <label>
          Min
          <input className="timer-input" inputMode="numeric" autoComplete="off" value={minuteDraft} disabled={timerPaused} onChange={(event) => setMinuteDraft(event.target.value)} />
        </label>
        <button type="button" className="icon-button" aria-label="Set timer" title="Set timer" disabled={!projection || timerPaused} onClick={() => {
          const hours = clockPart(hourDraft)
          const minutes = clockPart(minuteDraft)
          if (hours == null || minutes == null || minutes > 59) return
          onSetTimer((hours * 60 + minutes) * 60 * 1000)
        }}>
          <ClockIcon />
        </button>
        <button type="button" className="icon-button" aria-label={`Opened a cube, minus ${CUBE_COST}`} title={`Opened a cube (−${CUBE_COST})`} disabled={!projection} onClick={onSpendCube}>
          <CubeIcon />
        </button>
      </div>
    </section>
  )
}

function clockPart(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return 0
  if (!/^\d+$/.test(trimmed)) return null
  return Number(trimmed)
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8.2 6.2 11.5 13 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 5.2V8l2 1.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function CubeIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2.2 13 5v6L8 13.8 3 11V5Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M3 5 8 8l5-3M8 8v5.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}
