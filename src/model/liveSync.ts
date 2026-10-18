import type { CharacterRecord, StoreData } from "./store"
import { normalizePetProgress, type PetProgress } from "./petProgress"

export const LIVE_SYNC_EXPERIMENTAL = true

export type LivePhase = "off" | "starting" | "capturing" | "needs-npcap" | "needs-relog" | "needs-adapter" | "unavailable"

export type LiveStatus = {
  phase: LivePhase
  detail: string
  boundName: string
  experimental: boolean
}

export type LivePetEvent = {
  type: "pet"
  at: string
  name?: string
  level?: number
  souls?: number
  soulsToNext?: number | null
}

export type LiveOdyleEvent = {
  type: "odyle"
  at: string
  amount: number
}

export type LiveStatusEvent = {
  type: "status"
  phase: LivePhase
  detail?: string
  boundName?: string
}

export type LiveDiscoveryEvent = {
  type: "discovery"
  note: string
}

export type LiveEvent = LiveStatusEvent | LiveOdyleEvent | LivePetEvent | LiveDiscoveryEvent

export function emptyLiveStatus(): LiveStatus {
  return { phase: "off", detail: "", boundName: "", experimental: LIVE_SYNC_EXPERIMENTAL }
}

export function applyLiveEvent(store: StoreData, characterId: string | null, event: LiveOdyleEvent | LivePetEvent): StoreData {
  if (!characterId) return store
  return {
    ...store,
    characters: store.characters.map((character) => (
      character.id === characterId ? applyToCharacter(character, event) : character
    )),
  }
}

function applyToCharacter(character: CharacterRecord, event: LiveOdyleEvent | LivePetEvent): CharacterRecord {
  if (event.type === "odyle") {
    if (!Number.isFinite(event.amount) || event.amount < 0) return character
    if (character.odyle && Date.parse(character.odyle.readAt) > Date.parse(event.at)) return character
    return { ...character, odyle: { amount: Math.floor(event.amount), readAt: event.at } }
  }
  const next = mergePet(character.petProgress ?? null, event)
  if (!next) return character
  if (character.petProgress && Date.parse(character.petProgress.updatedAt) > Date.parse(next.updatedAt)) return character
  return { ...character, petProgress: next }
}

function mergePet(current: PetProgress | null, event: LivePetEvent): PetProgress | null {
  const level = event.level ?? current?.level
  const souls = event.souls ?? current?.souls
  if (level == null || souls == null) return current
  const soulsToNext = event.soulsToNext !== undefined ? event.soulsToNext : current?.soulsToNext ?? null
  return normalizePetProgress({
    name: event.name ?? current?.name,
    level,
    souls,
    soulsToNext,
    source: "live",
    updatedAt: event.at,
  })
}
