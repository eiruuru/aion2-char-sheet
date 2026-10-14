import { useEffect, useMemo, useRef, useState } from "react"
import { loadPublicProfile } from "./api/client"
import type { RegionId, SearchHit } from "./api/types"
import { buildSnapshot } from "./model/snapshot"
import {
  applyBoxChange,
  rowsForCharacter,
  sessionItems,
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
import { AddCharacter } from "./ui/AddCharacter"
import { CharacterPanel } from "./ui/CharacterPanel"
import { SessionStrip } from "./ui/Checklist"

const REFRESH_MS = 20 * 60 * 1000
let profileRefresh: Promise<void> | null = null

export function App() {
  const [store, setStore] = useState<StoreData>(() => loadStore())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [adding, setAdding] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [aboveGame, setAboveGame] = useState(false)
  const desktop = desktopBridge()
  const storeRef = useRef(store)
  storeRef.current = store

  useEffect(() => {
    saveStore(store)
  }, [store])

  useEffect(() => {
    void desktop?.getAlwaysOnTop().then(setAboveGame)
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

  const ordered = useMemo(
    () => rosterOrder(store.characters, store.membership, now),
    [store.characters, store.membership, now],
  )
  const selected = ordered.find((character) => character.id === selectedId) ?? ordered[0] ?? null

  async function loadProfile(record: CharacterRecord) {
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
    if (!selected) return
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
    if (!selected) return
    const at = Date.now()
    setNow(at)
    setStore((current) => {
      const base = current.checklist ?? normalizeStore(current, at).checklist!
      const checklist = applyBoxChange(base, taskId, selected, owners, current.membership, at)
      return { ...current, checklist }
    })
  }
  function makeMain() {
    if (!selected) return
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
    if (!selected) return
    if (!window.confirm(`Remove ${selected.name} from this tracker?`)) return
    setStore((current) => ({
      ...current,
      characters: current.characters.filter((character) => character.id !== selected.id),
    }))
    setSelectedId(null)
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
  const suggestions = selected ? characterSuggestions(selected, store.characters, store.membership, now) : []
  const checklistRoster = store.characters.map((character) => toChecklistCharacter(character, store.membership, now))
  const progress = store.checklist ?? normalizeStore(store, now).checklist!
  const session = sessionItems(checklistRoster, progress, store.membership, now)
  const selectedChecklist = selected
    ? checklistRoster.find((character) => character.id === selected.id) ?? null
    : null
  const checklistRows = selectedChecklist
    ? rowsForCharacter(selectedChecklist, checklistRoster, progress, store.membership, now)
    : []

  function changeBank(taskId: string, value: number) {
    if (!selected) return
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
          <h1>Aion 2 progress</h1>
        </div>
        <div className="actions">
          <label className="check">
            <input
              type="checkbox"
              checked={store.membership}
              onChange={(event) => setStore((current) => ({ ...current, membership: event.target.checked }))}
            />
            Special Quai Membership (Odyle cap {store.membership ? "840" : "560"})
          </label>
          {desktop && (
            <label className="check">
              <input
                type="checkbox"
                checked={aboveGame}
                onChange={(event) => {
                  const on = event.target.checked
                  setAboveGame(on)
                  void desktop.setAlwaysOnTop(on)
                }}
              />
              Keep this window above the game
            </label>
          )}
          <button type="button" onClick={exportFile}>Export</button>
          <label className="file">
            Import
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
          <button type="button" className="ghost" onClick={() => {
            if (!window.confirm(desktop ? "Clear every saved character in this app?" : "Clear every saved character on this browser?")) return
            setStore(emptyStore())
            setSelectedId(null)
          }}>
            Clear
          </button>
        </div>
      </header>
      {error ? <p className="error banner">{error}</p> : null}
      <SessionStrip items={session} now={now} onOpen={setSelectedId} />
      <section className="roster-bar panel">
        <div className="who">
          {ordered.map((character) => (
            <button
              key={character.id}
              type="button"
              className={character.id === selected?.id ? "selected" : undefined}
              title={character.name}
              aria-label={character.name}
              aria-pressed={character.id === selected?.id}
              onClick={() => setSelectedId(character.id)}
            >
              {character.latest?.portrait ? <img src={character.latest.portrait} alt="" /> : <span className="initial">{character.name.slice(0, 1)}</span>}
            </button>
          ))}
          <button type="button" className="add-character" onClick={() => setAdding((open) => !open)}>
            {adding ? "Close" : "Add"}
          </button>
        </div>
      </section>
      {adding ? <AddCharacter onAdd={addCharacter} /> : null}
      {selected ? (
        <CharacterPanel
          character={selected}
          suggestions={suggestions}
          projection={projection}
          now={now}
          busy={busyId === selected.id}
          onRefresh={() => void refreshRecord(selected)}
          onDelete={removeSelected}
          onSetMain={makeMain}
          onSaveOdyle={saveOdyle}
          onSetOdyleTimer={setOdyleTimer}
          onSpendCube={spendCube}
          checklistRows={checklistRows}
          names={Object.fromEntries(store.characters.map((character) => [character.id, character.name]))}
          roles={Object.fromEntries(store.characters.map((character) => [character.id, character.role]))}
          onChecklistBoxes={changeBoxes}
          onChecklistBank={changeBank}
        />
      ) : (
        <section className="panel empty">
          <h2>Track the main, then the alts</h2>
          <p>Search the public character profile, pin who you play, and the page will rank Daevanion, gear, and skill gaps. Odyle still needs a number from the game so you can see who is about to cap.</p>
        </section>
      )}
    </div>
  )
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
