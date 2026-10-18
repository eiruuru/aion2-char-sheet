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
