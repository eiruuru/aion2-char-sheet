import type { CharacterRecord, StoreData } from "./store"
import { farmablePetByName, petById, soulsToNext } from "./pets"
import { creditFarm, normalizePetProgress, type PetProgress, type PetTrack } from "./petProgress"

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

export type LiveKillsEvent = {
  type: "kills"
  at: string
  names: string[]
}

export type LiveCharacterEvent = {
  type: "character"
  name: string
}

export type LiveEvent = LiveStatusEvent | LiveOdyleEvent | LivePetEvent | LiveKillsEvent | LiveCharacterEvent | LiveDiscoveryEvent

export function emptyLiveStatus(): LiveStatus {
  return { phase: "off", detail: "", boundName: "", experimental: LIVE_SYNC_EXPERIMENTAL }
}

export function applyLiveEvent(store: StoreData, characterId: string | null, event: LiveOdyleEvent | LivePetEvent | LiveKillsEvent): StoreData {
  if (!characterId) return store
  return {
    ...store,
    characters: store.characters.map((character) => (
      character.id === characterId ? applyToCharacter(character, event) : character
    )),
  }
}

function applyToCharacter(character: CharacterRecord, event: LiveOdyleEvent | LivePetEvent | LiveKillsEvent): CharacterRecord {
  if (event.type === "odyle") {
    if (!Number.isFinite(event.amount) || event.amount < 0) return character
    if (character.odyle && Date.parse(character.odyle.readAt) > Date.parse(event.at)) return character
    return { ...character, odyle: { amount: Math.floor(event.amount), readAt: event.at } }
  }
  if (event.type === "kills") return applyKills(character, event)
  const next = mergePet(character.petProgress ?? null, event)
  if (!next) return character
  if (character.petProgress && Date.parse(character.petProgress.updatedAt) > Date.parse(next.updatedAt)) return character
  return { ...character, petProgress: next }
}

function applyKills(character: CharacterRecord, event: LiveKillsEvent): CharacterRecord {
  const names = event.names
    .map((name) => farmablePetByName(name))
    .filter((pet): pet is NonNullable<typeof pet> => Boolean(pet))
  if (!names.length) return character
  const petTracks = { ...(character.petTracks ?? {}) }
  let lastId = ""
  let lastTrack: PetTrack = { level: 0, kills: 0 }
  for (const pet of names) {
    lastId = pet.id
    lastTrack = creditFarm(petTracks[pet.id])
    petTracks[pet.id] = lastTrack
  }
  return {
    ...character,
    trackingPetId: lastId,
    petTracks,
    petProgress: progressFromTrack(lastId, lastTrack, event.at, "live"),
  }
}

export function progressFromTrack(id: string, track: PetTrack, at: string, source: PetProgress["source"]): PetProgress {
  const pet = petById(id)
  return {
    name: pet?.name,
    level: track.level,
    souls: track.kills,
    soulsToNext: soulsToNext(track.level),
    source,
    updatedAt: at,
  }
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
