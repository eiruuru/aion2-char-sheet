import type { RegionId } from "../api/types"
import { emptyProgress, migrateSharedKeys, syncProgress, type ChecklistProgress } from "./checklist"
import type { OdyleReading } from "./odyle"
import { historySnapshot, type Snapshot } from "./snapshot"

export type Resources = {
  crystals: number | null
  kinah: number | null
  abyss: number | null
}

export type CharacterRole = "main" | "alt"

export type CharacterRecord = {
  id: string
  characterId: string
  serverId: number
  serverName: string
  region: RegionId
  name: string
  className: string
  raceName: string
  role: CharacterRole
  addedAt: string
  odyle: OdyleReading | null
  resources: Resources
  latest: Snapshot | null
  history: Snapshot[]
}

export type StoreData = {
  version: 1
  membership: boolean
  characters: CharacterRecord[]
  checklist?: ChecklistProgress
  selectedId?: string
}

const STORAGE_KEY = "aion2-tracker-v1"
const HISTORY_LIMIT = 30

export const EMPTY_RESOURCES: Resources = { crystals: null, kinah: null, abyss: null }

export function emptyStore(now = Date.now()): StoreData {
  return { version: 1, membership: false, characters: [], checklist: emptyProgress(now) }
}

export function normalizeStore(store: StoreData, now = Date.now()): StoreData {
  return {
    version: 1,
    membership: Boolean(store.membership),
    characters: store.characters,
    checklist: migrateSharedKeys(syncProgress(store.checklist ?? emptyProgress(now), now), store.characters),
    selectedId: typeof store.selectedId === "string" && store.selectedId ? store.selectedId : undefined,
  }
}

export function chooseCharacter(savedId: string | null | undefined, ids: string[]): string | null {
  if (savedId && ids.includes(savedId)) return savedId
  return ids[0] ?? null
}

export function characterKey(region: RegionId, serverId: number, characterId: string): string {
  return `${region}:${serverId}:${characterId}`
}

export function loadStore(): StoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as StoreData
    if (parsed.version !== 1 || !Array.isArray(parsed.characters)) return emptyStore()
    return normalizeStore(parsed)
  } catch {
    return emptyStore()
  }
}

export function saveStore(store: StoreData): void {
  const raw = JSON.stringify(store)
  localStorage.setItem(STORAGE_KEY, raw)
  void window.tracker?.saveFile(raw).catch(() => {})
}

export function withSnapshot(character: CharacterRecord, snapshot: Snapshot, name?: string): CharacterRecord {
  return {
    ...character,
    name: name || character.name,
    className: snapshot.className || character.className,
    raceName: snapshot.raceName || character.raceName,
    latest: snapshot,
    history: [...character.history, historySnapshot(snapshot)].slice(-HISTORY_LIMIT),
  }
}

export function parseStoredNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.floor(value)
}
