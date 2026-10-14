import { useEffect, useMemo, useRef, useState } from "react"
import { loadPublicProfile } from "./api/client"
import type { RegionId, SearchHit } from "./api/types"
import { buildSnapshot } from "./model/snapshot"
import {
  applyBoxChange,
  rowsForCharacter,
  setTaskBank,
  type ChecklistCharacter,
  type MarkOwner,
} from "./model/checklist"
import { backupFileName } from "./model/schedule"
import {
  characterKey,
  emptyStore,
  loadStore,
  normalizeStore,
  saveStore,
  withSnapshot,
  type CharacterRecord,
  type StoreData,
} from "./model/store"
import { factionName } from "./api/serverList"
import { characterSuggestions, rosterOrder } from "./model/suggestions"
import { CUBE_COST, odyleCap, projectOdyle, shiftOdyleClock, spendOdyleReading } from "./model/odyle"
import { desktopBridge } from "./desktop"
import { APP_VERSION, reduceUpdateStatus, UPDATE_SKIP_KEY, WINDOW_TITLE, type UpdateOffer } from "./model/updates"
import { AddCharacter } from "./ui/AddCharacter"
import { CharacterPanel } from "./ui/CharacterPanel"
import { GoalsPanel } from "./ui/Goals"
import { ExportIcon, ImportIcon, MembershipIcon, PinIcon, TrashIcon, UpdateIcon } from "./ui/icons"
import { Onboarding } from "./ui/Onboarding"
import { SAMPLE_ID, charactersForTour, sampleProgress } from "./ui/sampleSheet"
import { clearOnboardingSeen, readOnboardingSeen, writeOnboardingSeen } from "./ui/tour"

const REFRESH_MS = 20 * 60 * 1000
let profileRefresh: Promise<void> | null = null

export function App() {
  const [store, setStore] = useState<StoreData>(() => loadStore())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [adding, setAdding] = useState(false)
  const [focusToken, setFocusToken] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [aboveGame, setAboveGame] = useState(false)
  const [tourOpen, setTourOpen] = useState(() => !readOnboardingSeen(localStorage))
  const [updateOffer, setUpdateOffer] = useState<UpdateOffer | null>(null)
  const [updateNotice, setUpdateNotice] = useState("")
  const desktop = desktopBridge()
  const updateAsked = useRef(false)
  const updateOfferRef = useRef<UpdateOffer | null>(null)
  const storeRef = useRef(store)
  updateOfferRef.current = updateOffer
  storeRef.current = store

  useEffect(() => {
    saveStore(store)
  }, [store])

  useEffect(() => {
    document.title = WINDOW_TITLE
  }, [])

  useEffect(() => {
    void desktop?.getAlwaysOnTop().then(setAboveGame)
  }, [desktop])

  useEffect(() => {
    if (!desktop) return
    const stop = desktop.onUpdate((status) => {
      const next = reduceUpdateStatus(updateOfferRef.current, status, localStorage.getItem(UPDATE_SKIP_KEY), updateAsked.current)
      setUpdateNotice(next.notice)
      setUpdateOffer(next.offer)
      if (next.install) void desktop.installUpdate()
    })
    void desktop.checkForUpdates()
    return stop
  }, [desktop])

  useEffect(() => {
    const tick = () => {
      if (!document.hidden) setNow(Date.now())
    }
    const timer = window.setInterval(tick, 1000)
    document.addEventListener("visibilitychange", tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", tick)
    }
  }, [])

  useEffect(() => {
    setStore((current) => {
      const next = normalizeStore(current, Date.now())
      const samePeriod = next.checklist?.dailyKey === current.checklist?.dailyKey
        && next.checklist?.weeklyKey === current.checklist?.weeklyKey
      const sameCounts = JSON.stringify(next.checklist?.counts) === JSON.stringify(current.checklist?.counts)
      return samePeriod && sameCounts ? current : next
    })
  }, [now])

  const previewing = tourOpen && store.characters.length === 0
  const shownCharacters = useMemo(
    () => charactersForTour(store.characters, previewing),
    [store.characters, previewing],
  )
  const ordered = useMemo(
    () => rosterOrder(shownCharacters, store.membership, now),
    [shownCharacters, store.membership, now],
  )
  const selected = ordered.find((character) => character.id === selectedId) ?? ordered[0] ?? null

  async function loadProfile(record: CharacterRecord) {
    if (record.id === SAMPLE_ID) return
    setBusyId(record.id)
    setError("")
    try {
      const loaded = await loadPublicProfile(record.region, record.serverId, record.characterId)
      const snapshot = buildSnapshot(
        loaded.info,
        loaded.equipment,
        loaded.details.map((entry) => ({
          boardId: entry.board.id,
          boardName: entry.board.name,
          detail: entry.detail,
        })),
      )
      setStore((current) => ({
        ...current,
        characters: current.characters.map((character) => (
          character.id === record.id
            ? withSnapshot(character, snapshot, loaded.info.profile.characterName)
            : character
        )),
      }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Refresh failed")
    } finally {
      setBusyId(null)
    }
  }

  function refreshRecord(record: CharacterRecord) {
    if (profileRefresh) return
    const job = loadProfile(record).finally(() => {
      if (profileRefresh === job) profileRefresh = null
    })
    profileRefresh = job
  }

  useEffect(() => {
    const kick = () => {
      if (document.hidden || profileRefresh) return
      const characters = storeRef.current.characters
      const stale = characters.some((character) => {
        const at = character.latest ? Date.parse(character.latest.at) : 0
        return !character.latest || Date.now() - at >= REFRESH_MS
      })
      if (!stale) return
      const job = (async () => {
        for (const character of characters) {
          if (document.hidden) return
          await loadProfile(character)
        }
      })().finally(() => {
        if (profileRefresh === job) profileRefresh = null
      })
      profileRefresh = job
    }
    const timer = window.setInterval(kick, REFRESH_MS)
    document.addEventListener("visibilitychange", kick)
    kick()
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", kick)
    }
  }, [])

  function addCharacter(hit: SearchHit, region: RegionId) {
    const id = characterKey(region, hit.serverId, hit.characterId)
    const existing = store.characters.find((character) => character.id === id)
    if (existing) {
      setSelectedId(existing.id)
      setError(`${hit.name} is already on the roster.`)
      return
    }
    const onServer = store.characters.filter((character) => character.region === region && character.serverId === hit.serverId)
    if (onServer.length >= SERVER_SLOTS) {
      setError(`${hit.serverName} already has ${SERVER_SLOTS} characters.`)
      return
    }
    const record: CharacterRecord = {
      id,
      characterId: hit.characterId,
      serverId: hit.serverId,
      serverName: hit.serverName,
      region,
      name: hit.name,
      className: "",
      raceName: factionName(hit.race),
      role: store.characters.some((character) => character.role === "main") ? "alt" : "main",
      addedAt: new Date().toISOString(),
      odyle: null,
      resources: { crystals: null, kinah: null, abyss: null },
      latest: null,
      history: [],
    }
    setStore((current) => ({ ...current, characters: [...current.characters, record] }))
    setSelectedId(id)
    setAdding(false)
    setError("")
    void refreshRecord(record)
  }

  function updateSelected(patch: (character: CharacterRecord) => CharacterRecord) {
    if (!selected || selected.id === SAMPLE_ID) return
    setStore((current) => ({
      ...current,
      characters: current.characters.map((character) => (
        character.id === selected.id ? patch(character) : character
      )),
    }))
  }

  function saveOdyle(amount: number) {
    updateSelected((character) => ({
      ...character,
      odyle: { amount, readAt: new Date().toISOString() },
    }))
    setNow(Date.now())
  }

  function setOdyleTimer(remainingMs: number) {
    const at = Date.now()
    setNow(at)
    updateSelected((character) => {
      if (!character.odyle) return character
      return { ...character, odyle: shiftOdyleClock(character.odyle, odyleCap(store.membership), at, remainingMs) }
    })
  }

  function spendCube() {
    const at = Date.now()
    setNow(at)
    updateSelected((character) => {
      if (!character.odyle) return character
      return { ...character, odyle: spendOdyleReading(character.odyle, odyleCap(store.membership), at, CUBE_COST) }
    })
  }

  function changeBoxes(taskId: string, owners: MarkOwner[]) {
    if (!selected || selected.id === SAMPLE_ID) return
    const at = Date.now()
    setNow(at)
    setStore((current) => {
      const base = current.checklist ?? normalizeStore(current, at).checklist!
      const checklist = applyBoxChange(base, taskId, selected, owners, current.membership, at)
      return { ...current, checklist }
    })
  }
  function makeMain() {
    if (!selected || selected.id === SAMPLE_ID) return
    setStore((current) => ({
      ...current,
      characters: current.characters.map((character) => {
        if (character.id === selected.id) return { ...character, role: "main" }
        if (character.role === "main") return { ...character, role: "alt" }
        return character
      }),
    }))
  }

  function removeSelected() {
    if (!selected || selected.id === SAMPLE_ID) return
    if (!window.confirm(`Remove ${selected.name} from this tracker?`)) return
    const remaining = store.characters.filter((character) => character.id !== selected.id)
    setStore((current) => ({
      ...current,
      characters: current.characters.filter((character) => character.id !== selected.id),
    }))
    setSelectedId(null)
    window.focus()
    if (remaining.length === 0) {
      setAdding(true)
      setFocusToken((token) => token + 1)
    }
  }

  function exportFile() {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = backupFileName(Date.now())
    link.click()
    URL.revokeObjectURL(url)
  }

  function importFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as StoreData
        if (parsed.version !== 1 || !Array.isArray(parsed.characters)) {
          setError("That file is not an Aion 2 tracker export.")
          return
        }
        setStore(normalizeStore(parsed))
        setSelectedId(parsed.characters[0]?.id ?? null)
        setError("")
      } catch {
        setError("Could not read that file.")
      }
    }
    reader.readAsText(file)
  }

  const cap = odyleCap(store.membership)
  const projection = selected?.odyle ? projectOdyle(selected.odyle, cap, now) : null
  const suggestions = selected ? characterSuggestions(selected, shownCharacters, store.membership, now) : []
  const checklistRoster = shownCharacters.map((character) => toChecklistCharacter(character, store.membership, now))
  const progress = (previewing ? sampleProgress(now) : null) ?? store.checklist ?? normalizeStore(store, now).checklist!
  const selectedChecklist = selected
    ? checklistRoster.find((character) => character.id === selected.id) ?? null
    : null
  const checklistRows = selectedChecklist
    ? rowsForCharacter(selectedChecklist, checklistRoster, progress, store.membership, now)
    : []
  const names = Object.fromEntries(shownCharacters.map((character) => [character.id, character.name]))
  const roles = Object.fromEntries(shownCharacters.map((character) => [character.id, character.role]))

  function changeBank(taskId: string, value: number) {
    if (!selected || selected.id === SAMPLE_ID) return
    const at = Date.now()
    setNow(at)
    setStore((current) => {
      const base = current.checklist ?? normalizeStore(current, at).checklist!
      return { ...current, checklist: setTaskBank(base, taskId, selected, value, current.membership, at) }
    })
  }

  return (
    <div className="app">
      <header className="top">
        <div>
          <p className="eyebrow">Local roster</p>
          <h1>AION 2 Character Sheet</h1>
        </div>
        <div className="actions">
          <span className="app-version">v{APP_VERSION}</span>
          <button type="button" className="icon-button ghost" aria-label="Check for updates" title="Check for updates" onClick={() => {
            updateAsked.current = true
            setUpdateNotice("")
            if (!desktop) {
              setUpdateNotice("Updates install inside the Windows app.")
              return
            }
            void desktop.checkForUpdates().then((result) => {
              if (!result.supported) setUpdateNotice("Updates install inside the Windows app.")
            })
          }}>
            <UpdateIcon />
          </button>
          <div className="tour-tools" data-tour="tools">
          <button
            type="button"
            className={store.membership ? "icon-button" : "icon-button ghost"}
            aria-pressed={store.membership}
            aria-label={`Special Quai Membership, Odyle cap ${store.membership ? "840" : "560"}`}
            title={`Special Quai Membership (Odyle cap ${store.membership ? "840" : "560"})`}
            onClick={() => setStore((current) => ({ ...current, membership: !current.membership }))}
          >
            <MembershipIcon />
          </button>
          {desktop && (
            <button
              type="button"
              className={aboveGame ? "icon-button" : "icon-button ghost"}
              aria-pressed={aboveGame}
              aria-label="Keep this window above the game"
              title="Keep this window above the game"
              onClick={() => {
                const on = !aboveGame
                setAboveGame(on)
                void desktop.setAlwaysOnTop(on)
              }}
            >
              <PinIcon />
            </button>
          )}
          <button type="button" className="icon-button ghost" aria-label="Export" title="Export" onClick={exportFile}>
            <ExportIcon />
          </button>
          <label className="icon-button ghost file" title="Import" aria-label="Import">
            <ImportIcon />
            <input
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) importFile(file)
                event.target.value = ""
              }}
            />
          </label>
          </div>
          <button type="button" className="icon-button ghost" aria-label="Clear" title="Clear" onClick={() => {
            if (!window.confirm(desktop ? "Clear every saved character in this app?" : "Clear every saved character on this browser?")) return
            clearOnboardingSeen(localStorage)
            setStore(emptyStore())
            setSelectedId(null)
            setTourOpen(true)
          }}>
            <TrashIcon />
          </button>
        </div>
      </header>
      {updateNotice ? <p className="muted update-status">{updateNotice}</p> : null}
      {updateOffer ? (
        <section className="panel update-card">
          <h2>Update v{updateOffer.version}</h2>
          {updateOffer.notes ? <p className="update-notes">{updateOffer.notes}</p> : <p className="muted">Version {updateOffer.version} is ready.</p>}
          {updateOffer.phase === "available" ? (
            <div className="update-actions">
              <button type="button" className="quiet" onClick={() => {
                localStorage.setItem(UPDATE_SKIP_KEY, updateOffer.version)
                setUpdateOffer(null)
              }}>Stay on v{APP_VERSION}</button>
              <button type="button" onClick={() => {
                setUpdateOffer((current) => current ? { ...current, phase: "downloading", percent: 0 } : current)
                void desktop?.downloadUpdate()
              }}>Update to v{updateOffer.version}</button>
            </div>
          ) : (
            <p className="muted">{updateOffer.phase === "downloaded" ? "Restarting…" : `Downloading… ${updateOffer.percent ?? 0}%`}</p>
          )}
        </section>
      ) : null}
      {error ? <p className="error banner">{error}</p> : null}
      <div className="workspace">
        <div className="character-column">
          <section className="roster-bar panel" data-tour="roster">
            {rosterGroups(ordered).map((group) => (
              <div className="who" key={group.key}>
                {group.slots.map((slot, index) => slot.kind === "character" ? (
                  <button
                    key={slot.character.id}
                    type="button"
                    className={["roster-pick", rosterTone(slot.character, shownCharacters), slot.character.id === selected?.id ? "selected" : ""].filter(Boolean).join(" ")}
                    title={`${slot.character.name} · ${slot.character.role === "main" ? "Main" : "Alt"}`}
                    aria-label={`${slot.character.name}, ${slot.character.role === "main" ? "main" : "alt"}`}
                    aria-pressed={slot.character.id === selected?.id}
                    onClick={() => setSelectedId(slot.character.id)}
                  >
                    {slot.character.latest?.portrait ? <img src={slot.character.latest.portrait} alt="" /> : <span className="initial">{slot.character.name.slice(0, 1)}</span>}
                  </button>
                ) : (
                  <button
                    key={`${group.key}-slot-${index}`}
                    type="button"
                    className={slot.kind === "premium" ? "roster-slot premium" : "roster-slot"}
                    aria-label={slot.kind === "premium" ? "Premium character slot" : "Empty character slot"}
                    title={slot.kind === "premium" ? "Bought in-game with premium currency" : "Empty slot"}
                    onClick={() => setAdding((open) => !open)}
                  >
                    <span className="slot-face" />
                  </button>
                ))}
              </div>
            ))}
          </section>
          {adding ? <AddCharacter onAdd={addCharacter} focusToken={focusToken} /> : null}
          {selected ? (
            <CharacterPanel
              character={selected}
              busy={busyId === selected.id}
              onRefresh={() => void refreshRecord(selected)}
              onDelete={removeSelected}
              onSetMain={makeMain}
              checklistRows={checklistRows}
              names={names}
              roles={roles}
              onChecklistBoxes={changeBoxes}
              onChecklistBank={changeBank}
            />
          ) : (
            <section className="panel empty">
              <h2>Your characters, on this device</h2>
              <p>Search a public profile and pin your main, then the alts. This sheet shows gear, skills, Daevanion, and cosmetics, and keeps dailies, weeklies, seasonal tasks, and goals here. Type the Odyle number from the game so you can see who is about to cap.</p>
              <p>It does not log into Aion 2, change a character, or mark tasks in the game. Refresh only reads the public profile. Checklist marks stay on this device, and export is the backup.</p>
            </section>
          )}
        </div>
        <GoalsPanel
          character={selected}
          rows={checklistRows}
          suggestions={suggestions}
          projection={projection}
          now={now}
          onSaveOdyle={saveOdyle}
          onSetOdyleTimer={setOdyleTimer}
          onSpendCube={spendCube}
        />
      </div>
      {tourOpen ? (
        <Onboarding
          hasCharacter={Boolean(selected)}
          preview={previewing}
          desktop={Boolean(desktop)}
          onDone={() => {
            writeOnboardingSeen(localStorage)
            setTourOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

const SERVER_SLOTS = 6
const FREE_SLOTS = 4

type RosterSlot =
  | { kind: "character"; character: CharacterRecord }
  | { kind: "free" }
  | { kind: "premium" }

function rosterGroups(characters: CharacterRecord[]): { key: string; slots: RosterSlot[] }[] {
  const groups = new Map<string, CharacterRecord[]>()
  for (const character of characters) {
    const key = `${character.region}:${character.serverId}`
    const list = groups.get(key) ?? []
    list.push(character)
    groups.set(key, list)
  }
  if (!groups.size) groups.set("empty", [])
  return [...groups.entries()].map(([key, list]) => ({ key, slots: serverSlots(list) }))
}

function serverSlots(characters: CharacterRecord[]): RosterSlot[] {
  const slots: RosterSlot[] = characters.map((character) => ({ kind: "character", character }))
  if (slots.length >= SERVER_SLOTS) return slots
  while (slots.length < FREE_SLOTS) slots.push({ kind: "free" })
  while (slots.length < SERVER_SLOTS) slots.push({ kind: "premium" })
  return slots
}

function rosterTone(character: CharacterRecord, characters: CharacterRecord[]): string {
  if (character.role === "main") return "role-main"
  const alts = characters.filter((entry) => entry.role !== "main").map((entry) => entry.id).sort()
  const index = alts.indexOf(character.id)
  return `role-${index >= 0 ? index % 6 : 0}`
}

function toChecklistCharacter(character: CharacterRecord, membership: boolean, now: number): ChecklistCharacter {
  const projection = character.odyle ? projectOdyle(character.odyle, odyleCap(membership), now) : null
  return {
    id: character.id,
    name: character.name,
    role: character.role,
    level: character.latest?.level ?? null,
    itemLevel: character.latest?.itemLevel ?? null,
    odyleKnown: projection != null,
    odyleNearCap: projection != null && (projection.full || projection.aboveCap || projection.ticksUntilFull <= 1),
    portrait: character.latest?.portrait,
    region: character.region,
    serverId: character.serverId,
  }
}
