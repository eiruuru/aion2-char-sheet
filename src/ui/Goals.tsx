import { useEffect, useRef, useState, type ReactNode } from "react"
import type { CharacterRecord } from "../model/store"
import { parseStoredNumber } from "../model/store"
import { petFill, type PetProgress } from "../model/petProgress"
import { formatCountdown, formatNumber } from "../model/format"
import { CUBE_COST, type OdyleProjection } from "../model/odyle"
import { rosterGoals, type SessionItem } from "../model/checklist"
import { RefreshIcon } from "./icons"
import { loadVideos, type VideoHit } from "../model/videos"

export function GoalsPanel({
  character,
  projection,
  now,
  due,
  onSelectCharacter,
  onSaveOdyle,
  onSetOdyleTimer,
  onSpendCube,
  onSavePet,
  liveNote,
}: {
  character: CharacterRecord | null
  projection: OdyleProjection | null
  now: number
  due: SessionItem[]
  onSelectCharacter: (characterId: string) => void
  onSaveOdyle: (amount: number) => void
  onSetOdyleTimer: (remainingMs: number) => void
  onSpendCube: () => void
  onSavePet: (progress: PetProgress) => void
  liveNote: ReactNode
}) {
  const [tab, setTab] = useState<"goals" | "class" | "general">("goals")
  const goals = rosterGoals(due, character?.id ?? null, projection, now)
  return (
    <aside className="side-column" data-tour="goals">
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
      {liveNote}
      {character ? <PetCard character={character} onSave={onSavePet} /> : null}
      <section className="goals panel">
        <div className="tabs" role="tablist" aria-label="Goals">
          <button type="button" role="tab" aria-selected={tab === "goals"} onClick={() => setTab("goals")}>Goals</button>
          <button type="button" role="tab" aria-selected={tab === "class"} onClick={() => setTab("class")}>Class Guides</button>
          <button type="button" role="tab" aria-selected={tab === "general"} onClick={() => setTab("general")}>General Guides</button>
        </div>
        <div className="goals-scroll">
          {tab === "class" || tab === "general" ? (
            <VideosView kind={tab} character={character} active />
          ) : (
            goals.length ? (
              <ul className="quests roster-goals">
                {goals.map((goal) => (
                  <li key={goal.id}>
                    <button
                      type="button"
                      className={goal.urgent ? "roster-due urgent" : "roster-due"}
                      disabled={goal.characterId == null}
                      onClick={() => { if (goal.characterId) onSelectCharacter(goal.characterId) }}
                    >
                      <span className="roster-due-top">
                        <strong className={`priority-name priority-${goal.priority}`}>{goal.taskName}</strong>
                        {goal.meta ? <span className="muted">{goal.meta}</span> : null}
                      </span>
                      {goal.detail ? <span className="roster-due-detail">{goal.detail}</span> : null}
                      {goal.due ? <span className="roster-due-due">{goal.due}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{character ? "Nothing open." : "Add a character to track goals."}</p>
            )
          )}
        </div>
      </section>
    </aside>
  )
}

function VideosView({ kind, character, active }: { kind: "class" | "general"; character: CharacterRecord | null; active: boolean }) {
  const [videos, setVideos] = useState<VideoHit[]>([])
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)
  const force = useRef(false)
  const className = character?.className ?? ""
  useEffect(() => {
    if (!active) return
    if (kind === "class" && !className) {
      setVideos([])
      setFailed(false)
      return
    }
    const refresh = force.current
    force.current = false
    let cancel = false
    setVideos([])
    setFailed(false)
    setBusy(true)
    void loadVideos(kind, className, localStorage, Date.now(), refresh).then((result) => {
      if (cancel) return
      setVideos(result.videos)
      setFailed(result.failed)
      setBusy(false)
    })
    return () => { cancel = true }
  }, [active, kind, className, tick])
  return (
    <div className="video-pane">
      <div className="video-head">
        <button type="button" className="icon-button ghost" aria-label="Check for new videos" title="Check for new videos" onClick={() => { force.current = true; setTick((current) => current + 1) }} disabled={busy}>
          <RefreshIcon />
        </button>
      </div>
      {kind === "class" && !className ? <p className="muted">Add a character to see class videos.</p> : null}
      {failed ? <p className="muted">{videos.length ? "Couldn't check YouTube. The saved list is still here." : "Couldn't check YouTube."}</p> : null}
      {videos.length ? (
        <ul className="video-list">
          {videos.map((video) => (
            <li key={video.id}>
              <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`} target="_blank" rel="noreferrer">
                <img src={video.thumbnail} alt="" />
                <span>
                  <strong>{video.title}</strong>
                  {video.channel ? <span className="muted">{video.channel}</span> : null}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : failed || (kind === "class" && !className) || busy ? null : <p className="muted">No Global videos for this search.</p>}
    </div>
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

function PetCard({ character, onSave }: { character: CharacterRecord; onSave: (progress: PetProgress) => void }) {
  const progress = character.petProgress ?? null
  const profile = character.latest?.pet
  const [levelDraft, setLevelDraft] = useState(progress ? String(progress.level) : profile?.level != null ? String(profile.level) : "")
  const [soulsDraft, setSoulsDraft] = useState(progress ? String(progress.souls) : "")
  const [nextDraft, setNextDraft] = useState(progress?.soulsToNext != null ? String(progress.soulsToNext) : "")
  useEffect(() => {
    setLevelDraft(progress ? String(progress.level) : profile?.level != null ? String(profile.level) : "")
    setSoulsDraft(progress ? String(progress.souls) : "")
    setNextDraft(progress?.soulsToNext != null ? String(progress.soulsToNext) : "")
  }, [character.id, progress?.updatedAt, progress?.level, progress?.souls, progress?.soulsToNext, profile?.level])
  const fill = progress ? petFill(progress) : 0
  const title = progress?.name || profile?.name || "Pet"
  return (
    <section className="panel odyle-card">
      <h2>Pet progress</h2>
      <p className="odyle-readout">
        <strong>{title}</strong>
        {progress ? ` · Lv ${progress.level}` : profile?.level != null ? ` · profile Lv ${profile.level}` : null}
        {progress?.source === "live" ? " · live" : null}
      </p>
      {progress && progress.soulsToNext ? (
        <>
          <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={progress.soulsToNext} aria-valuenow={Math.min(progress.souls, progress.soulsToNext)} aria-label="Pet souls">
            <span style={{ width: `${fill * 100}%` }} />
          </div>
          <p className="odyle-readout">{progress.souls} / {progress.soulsToNext} souls</p>
        </>
      ) : progress ? <p className="muted">{progress.souls} souls. Next level total is not set.</p> : <p className="muted">No soul count yet.</p>}
      <div className="odyle-controls pet-controls">
        <label>
          Level
          <input className="timer-input" inputMode="numeric" autoComplete="off" value={levelDraft} onChange={(event) => setLevelDraft(event.target.value)} />
        </label>
        <label>
          Souls
          <input inputMode="numeric" autoComplete="off" value={soulsDraft} onChange={(event) => setSoulsDraft(event.target.value)} />
        </label>
        <label>
          Next
          <input className="timer-input" inputMode="numeric" autoComplete="off" value={nextDraft} onChange={(event) => setNextDraft(event.target.value)} />
        </label>
        <button type="button" className="icon-button" aria-label="Save pet progress" title="Save pet progress" onClick={() => {
          const level = parseStoredNumber(levelDraft)
          const souls = parseStoredNumber(soulsDraft)
          if (level == null || souls == null) return
          const soulsToNext = nextDraft.trim() ? parseStoredNumber(nextDraft) : null
          if (nextDraft.trim() && soulsToNext == null) return
          onSave({
            name: progress?.name || profile?.name,
            level,
            souls,
            soulsToNext,
            source: "manual",
            updatedAt: new Date().toISOString(),
          })
        }}>
          <CheckIcon />
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
