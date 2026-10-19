import { useEffect, useRef, useState } from "react"
import { desktopBridge } from "../desktop"
import { farmRemaining, formatElapsed } from "../model/farmSession"
import { CloseIcon, GoalIcon, OpacityIcon, PinIcon, ResizeIcon } from "./icons"

export const PET_POP_KEY = "aion2-pet-pop"

export type PetPopupLine = {
  petId: string
  name: string
  genus: string
  icon: string | null
  level: number
  kills: number
  next: number | null
  sessionKills: number
  goal: number | null
}

export type PetPopupState = {
  characterName: string
  active: boolean
  startedAt: number | null
  endedAt: number | null
  lines: PetPopupLine[]
}

export function writePetPopup(state: PetPopupState | null) {
  localStorage.setItem(PET_POP_KEY, JSON.stringify(state))
  desktopBridge()?.publishPetPopup?.(state)
}

function lineFrom(value: unknown): PetPopupLine | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<PetPopupLine>
  if (typeof raw.petId !== "string" || typeof raw.name !== "string") return null
  const goal = typeof raw.goal === "number" && raw.goal >= 1 ? Math.floor(raw.goal) : null
  return {
    petId: raw.petId,
    name: raw.name,
    genus: typeof raw.genus === "string" ? raw.genus : "",
    icon: typeof raw.icon === "string" ? raw.icon : null,
    level: typeof raw.level === "number" ? raw.level : 0,
    kills: typeof raw.kills === "number" ? raw.kills : 0,
    next: typeof raw.next === "number" ? raw.next : null,
    sessionKills: typeof raw.sessionKills === "number" ? raw.sessionKills : 0,
    goal,
  }
}

function popupFromPayload(value: unknown): PetPopupState | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<PetPopupState> & Partial<PetPopupLine>
  const startedAt = typeof raw.startedAt === "number" ? raw.startedAt : null
  const endedAt = typeof raw.endedAt === "number" ? raw.endedAt : null
  if (Array.isArray(raw.lines)) {
    return {
      characterName: typeof raw.characterName === "string" ? raw.characterName : "",
      active: Boolean(raw.active),
      startedAt,
      endedAt,
      lines: raw.lines.map(lineFrom).filter((line): line is PetPopupLine => Boolean(line)),
    }
  }
  const line = lineFrom(raw)
  if (!line) return null
  return { characterName: typeof raw.characterName === "string" ? raw.characterName : "", active: true, startedAt, endedAt, lines: [line] }
}

export function readPetPopup(): PetPopupState | null {
  try {
    return popupFromPayload(JSON.parse(localStorage.getItem(PET_POP_KEY) ?? "null"))
  } catch {
    return null
  }
}

let browserPop: Window | null = null

export function openFarmWindow() {
  const desktop = desktopBridge()
  if (desktop?.openPetPopup) {
    void desktop.openPetPopup()
    return
  }
  browserPop = window.open(`${location.origin}${location.pathname}#pet`, "aion2-pet", "popup,width=400,height=320")
}

export function toggleFarmWindow() {
  const desktop = desktopBridge()
  if (desktop?.togglePetPopup) {
    void desktop.togglePetPopup()
    return
  }
  if (browserPop && !browserPop.closed) {
    browserPop.close()
    browserPop = null
    return
  }
  openFarmWindow()
}

function shownGoal(line: PetPopupLine, draft: string | undefined): number | null {
  if (draft === undefined) return line.goal
  const trimmed = draft.trim()
  if (!trimmed) return null
  const parsed = Math.floor(Number(trimmed))
  if (!Number.isFinite(parsed) || parsed < 1) return line.goal
  return parsed
}

function elapsedMs(state: PetPopupState | null, tick: number): number {
  if (!state?.startedAt) return 0
  const end = state.active ? tick : (state.endedAt ?? state.startedAt)
  return Math.max(0, end - state.startedAt)
}

export function PetPopupApp() {
  const [state, setState] = useState<PetPopupState | null>(() => readPetPopup())
  const [failed, setFailed] = useState(false)
  const [tick, setTick] = useState(() => Date.now())
  const [chrome, setChrome] = useState({ opacity: 1, locked: false })
  const [goalDraft, setGoalDraft] = useState<Record<string, string>>({})
  const pushed = useRef(0)
  const desktop = desktopBridge()
  useEffect(() => {
    document.title = "Pet progress"
    document.body.classList.add("pet-pop-body")
    const apply = (value: unknown) => {
      pushed.current += 1
      setState(popupFromPayload(value))
    }
    const stop = desktop?.onPetPopup?.(apply)
    void desktop?.currentPetPopup?.().then((value) => {
      if (pushed.current === 0) setState(popupFromPayload(value) ?? readPetPopup())
    })
    void desktop?.getPetChrome?.().then((value) => {
      if (value) setChrome(value)
    })
    const pull = () => {
      if (desktop?.onPetPopup) return
      setState(readPetPopup())
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === PET_POP_KEY) pull()
    }
    window.addEventListener("storage", onStorage)
    const timer = desktop?.onPetPopup ? 0 : window.setInterval(pull, 100)
    return () => {
      document.body.classList.remove("pet-pop-body")
      window.removeEventListener("storage", onStorage)
      if (timer) window.clearInterval(timer)
      stop?.()
    }
  }, [desktop])
  useEffect(() => {
    setGoalDraft({})
  }, [state?.startedAt])
  useEffect(() => {
    if (!state?.active || !state.startedAt) return
    const timer = window.setInterval(() => setTick(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [state?.active, state?.startedAt])
  useEffect(() => {
    setFailed(false)
  }, [state?.lines.map((line) => line.petId).join("|")])
  return (
    <section className={chrome.locked ? "pet-pop locked" : "pet-pop"}>
      <header className="pet-pop-bar">
        <div className="pet-pop-session-wrap">
          <span className="pet-pop-session-label">SESSION</span>
          <button
            type="button"
            className="pet-pop-session"
            aria-pressed={Boolean(state?.active)}
            title={state?.active ? "Turn session off" : "Turn session on"}
            onClick={() => {
              if (desktop?.toggleFarmSession) desktop.toggleFarmSession()
              else window.opener?.postMessage({ type: "pet-session" }, location.origin)
            }}
          >
            {state?.active ? "On" : "Off"}
          </button>
        </div>
        <div className="pet-pop-tools">
          <label className="pet-pop-opacity">
            <OpacityIcon />
            <input
              type="range"
              min={35}
              max={100}
              aria-label="Window opacity"
              value={Math.round(chrome.opacity * 100)}
              style={{ ["--fill" as string]: `${((Math.round(chrome.opacity * 100) - 35) / 65) * 100}%` }}
              onChange={(event) => {
                const opacity = Number(event.target.value) / 100
                setChrome((current) => ({ ...current, opacity }))
                void desktop?.setPetOpacity?.(opacity)
              }}
            />
          </label>
          <button
            type="button"
            className={chrome.locked ? "pet-pop-icon on" : "pet-pop-icon"}
            aria-pressed={chrome.locked}
            aria-label={chrome.locked ? "Unlock window position" : "Lock window position"}
            title={chrome.locked ? "Unlock window position" : "Lock window position"}
            onClick={() => {
              const locked = !chrome.locked
              setChrome((current) => ({ ...current, locked }))
              void desktop?.setPetLocked?.(locked)
            }}
          >
            <PinIcon />
          </button>
          <button type="button" className="pet-pop-icon" aria-label="Close pet progress" onClick={() => {
            if (desktop?.closePetPopup) void desktop.closePetPopup()
            else window.close()
          }}>
            <CloseIcon />
          </button>
        </div>
      </header>
      {state && state.lines.length ? (
        <div className="pet-pop-lines">
          {state.lines.map((line) => (
              <article className="pet-pop-line" key={line.petId}>
                <div className="pet-pop-top">
                  {line.icon && !failed ? (
                    <img className="pet-portrait" src={line.icon} alt="" onError={() => setFailed(true)} />
                  ) : (
                    <span className={`pet-portrait genus-${line.genus.toLowerCase()}`} aria-hidden="true">{line.name.slice(0, 1)}</span>
                  )}
                  <div>
                    <h2>{line.name}</h2>
                    <p className="muted">{state.characterName ? `${state.characterName} · ` : ""}{line.genus}</p>
                    <p className="odyle-readout">{farmRemaining(line.sessionKills, shownGoal(line, goalDraft[line.petId]))}</p>
                  </div>
                </div>
                <label className="pet-pop-goal">
                  <GoalIcon />
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    aria-label={`Goal for ${line.name}`}
                    value={goalDraft[line.petId] ?? (line.goal ?? "")}
                    onChange={(event) => {
                      const raw = event.target.value
                      setGoalDraft((current) => ({ ...current, [line.petId]: raw }))
                      const trimmed = raw.trim()
                      const parsed = trimmed ? Math.floor(Number(trimmed)) : null
                      if (trimmed && (!Number.isFinite(parsed) || parsed == null || parsed < 1)) return
                      desktop?.setPetGoal?.({ petId: line.petId, goal: parsed })
                    }}
                  />
                </label>
              </article>
            ))}
        </div>
      ) : (
        <p className="pet-pop-empty muted">{state?.active ? "Session is on. Kills will show up here." : "Turn Session on to track kills."}</p>
      )}
      <footer className="pet-pop-timer">{formatElapsed(elapsedMs(state, tick))}</footer>
      <span className="pet-pop-resize" aria-hidden="true"><ResizeIcon /></span>
    </section>
  )
}
