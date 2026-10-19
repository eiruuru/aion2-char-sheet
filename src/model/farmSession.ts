export type FarmSessionPet = {
  petId: string
  name: string
  kills: number
  goal: number | null
}

export type FarmSession = {
  id: string
  characterId: string
  characterName: string
  startedAt: string
  endedAt: string
  pets: FarmSessionPet[]
}

const SESSION_LIMIT = 40

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const clock = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  return hours > 0 ? `${hours}:${clock}` : clock
}

export function farmRemaining(kills: number, goal: number | null): string {
  if (goal == null) return kills === 1 ? "1 kill this session" : `${kills} kills this session`
  if (kills >= goal) return "Done"
  const left = goal - kills
  return left === 1 ? "1 left" : `${left} left`
}

export function finishFarmSession(sessions: FarmSession[], session: FarmSession): FarmSession[] {
  return [session, ...sessions.filter((item) => item.id !== session.id)].slice(0, SESSION_LIMIT)
}

function finiteCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null
  return Math.floor(value)
}

function sessionPet(value: unknown): FarmSessionPet | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<FarmSessionPet>
  if (typeof raw.petId !== "string" || typeof raw.name !== "string") return null
  const kills = finiteCount(raw.kills)
  if (kills == null) return null
  const goal = raw.goal == null ? null : finiteCount(raw.goal)
  if (raw.goal != null && (goal == null || goal < 1)) return null
  return { petId: raw.petId, name: raw.name, kills, goal }
}

export function normalizeFarmSessions(value: unknown): FarmSession[] {
  if (!Array.isArray(value)) return []
  const sessions: FarmSession[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const raw = item as Partial<FarmSession>
    if (typeof raw.id !== "string" || typeof raw.characterId !== "string") continue
    if (typeof raw.startedAt !== "string" || typeof raw.endedAt !== "string") continue
    const pets = Array.isArray(raw.pets) ? raw.pets.map(sessionPet).filter((pet): pet is FarmSessionPet => Boolean(pet)) : []
    sessions.push({
      id: raw.id,
      characterId: raw.characterId,
      characterName: typeof raw.characterName === "string" ? raw.characterName : "",
      startedAt: raw.startedAt,
      endedAt: raw.endedAt,
      pets,
    })
  }
  return sessions.slice(0, SESSION_LIMIT)
}
