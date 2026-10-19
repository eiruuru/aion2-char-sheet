import { petById, petByName, soulsToNext } from "./pets"

export type PetProgressSource = "manual" | "live"

export type PetProgress = {
  name?: string
  level: number
  souls: number
  soulsToNext: number | null
  source: PetProgressSource
  updatedAt: string
}

export function petFill(progress: PetProgress): number {
  if (progress.soulsToNext == null || progress.soulsToNext <= 0) return 0
  return Math.max(0, Math.min(1, progress.souls / progress.soulsToNext))
}

export type PetTrack = {
  level: number
  kills: number
  live?: boolean
}

export function trackFill(track: PetTrack): number {
  const next = soulsToNext(track.level)
  if (next == null || next <= 0) return 1
  return Math.max(0, Math.min(1, track.kills / next))
}

export function emptyPetTrack(level = 0): PetTrack {
  return { level, kills: 0 }
}

export function normalizePetTrack(value: unknown): PetTrack | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<PetTrack>
  const level = finiteFloor(raw.level)
  const kills = finiteFloor(raw.kills)
  if (level == null || kills == null) return null
  return { level: Math.min(level, 3), kills, ...(raw.live ? { live: true } : {}) }
}

export function creditFarm(track: PetTrack | null | undefined): PetTrack {
  const fresh = !track?.live
  let level = fresh ? 0 : Math.min(track?.level ?? 0, 3)
  let kills = fresh ? 1 : (track?.kills ?? 0) + 1
  while (level < 3) {
    const need = soulsToNext(level)
    if (need == null || kills < need) break
    kills -= need
    level += 1
  }
  return { level, kills, live: true }
}

export function normalizePetTracks(value: unknown): Record<string, PetTrack> {
  if (!value || typeof value !== "object") return {}
  const tracks: Record<string, PetTrack> = {}
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!petById(id)) continue
    const track = normalizePetTrack(raw)
    if (track) tracks[id] = track
  }
  return tracks
}

export function seedTrackFromProgress(progress: PetProgress | null | undefined): { id: string; track: PetTrack } | null {
  const pet = petByName(progress?.name)
  if (!pet || !progress) return null
  return { id: pet.id, track: { level: Math.min(progress.level, 3), kills: progress.souls } }
}

export function normalizePetProgress(value: unknown): PetProgress | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<PetProgress>
  const level = finiteFloor(raw.level)
  const souls = finiteFloor(raw.souls)
  if (level == null || souls == null) return null
  const soulsToNext = raw.soulsToNext == null ? null : finiteFloor(raw.soulsToNext)
  if (raw.soulsToNext != null && soulsToNext == null) return null
  const updatedAt = typeof raw.updatedAt === "string" && Number.isFinite(Date.parse(raw.updatedAt))
    ? raw.updatedAt
    : new Date(0).toISOString()
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : undefined
  return {
    name,
    level,
    souls,
    soulsToNext,
    source: raw.source === "live" ? "live" : "manual",
    updatedAt,
  }
}

function finiteFloor(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null
  return Math.floor(value)
}
