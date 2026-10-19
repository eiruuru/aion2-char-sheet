import { useEffect, useRef, useState } from "react"
import { desktopBridge } from "../desktop"

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
}

export type PetPopupState = {
  characterName: string
  active: boolean
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
  return {
    petId: raw.petId,
    name: raw.name,
    genus: typeof raw.genus === "string" ? raw.genus : "",
    icon: typeof raw.icon === "string" ? raw.icon : null,
    level: typeof raw.level === "number" ? raw.level : 0,
    kills: typeof raw.kills === "number" ? raw.kills : 0,
    next: typeof raw.next === "number" ? raw.next : null,
    sessionKills: typeof raw.sessionKills === "number" ? raw.sessionKills : 0,
  }
}

function popupFromPayload(value: unknown): PetPopupState | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<PetPopupState> & Partial<PetPopupLine>
  if (Array.isArray(raw.lines)) {
    return {
      characterName: typeof raw.characterName === "string" ? raw.characterName : "",
      active: Boolean(raw.active),
      lines: raw.lines.map(lineFrom).filter((line): line is PetPopupLine => Boolean(line)),
    }
  }
  const line = lineFrom(raw)
  if (!line) return null
  return { characterName: typeof raw.characterName === "string" ? raw.characterName : "", active: true, lines: [line] }
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
  browserPop = window.open(`${location.origin}${location.pathname}#pet`, "aion2-pet", "popup,width=360,height=230")
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

export function PetPopupApp() {
  const [state, setState] = useState<PetPopupState | null>(() => readPetPopup())
  const [failed, setFailed] = useState(false)
  const pushed = useRef(0)
  useEffect(() => {
    document.title = "Pet progress"
    document.body.classList.add("pet-pop-body")
    const desktop = desktopBridge()
    const apply = (value: unknown) => {
      pushed.current += 1
      setState(popupFromPayload(value))
    }
    const stop = desktop?.onPetPopup?.(apply)
    void desktop?.currentPetPopup?.().then((value) => {
      if (pushed.current === 0) setState(popupFromPayload(value) ?? readPetPopup())
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
  }, [])
  useEffect(() => {
    setFailed(false)
  }, [state?.lines.map((line) => line.petId).join("|")])
  const desktop = desktopBridge()
  return (
    <section className="pet-pop">
      <header className="pet-pop-bar">
        <strong>{state?.active ? "Session on" : "Session off"}</strong>
        <button type="button" className="pet-pop-close" aria-label="Close pet progress" onClick={() => {
          if (desktop?.closePetPopup) void desktop.closePetPopup()
          else window.close()
        }}>×</button>
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
                  </div>
                </div>
                <p className="odyle-readout">{line.sessionKills} {line.sessionKills === 1 ? "kill" : "kills"} this session</p>
              </article>
            ))}
        </div>
      ) : (
        <p className="muted">{state?.active ? "Session is on. Kills will show up here." : "Turn Session on to track kills."}</p>
      )}
    </section>
  )
}
