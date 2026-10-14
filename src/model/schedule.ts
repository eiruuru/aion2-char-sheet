const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export type ManilaParts = {
  year: number
  month: number
  day: number
  weekday: number
  hour: number
  minute: number
}

export function manilaParts(now: number): ManilaParts {
  const shifted = new Date(now + MANILA_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  }
}

function manilaStamp(year: number, month: number, day: number, hour: number, minute = 0): number {
  return Date.UTC(year, month, day, hour - 8, minute, 0, 0)
}

export function dailyPeriodStart(now: number): number {
  const parts = manilaParts(now)
  let { year, month, day } = parts
  if (parts.hour < 15) {
    const previous = new Date(Date.UTC(year, month, day) - DAY_MS)
    year = previous.getUTCFullYear()
    month = previous.getUTCMonth()
    day = previous.getUTCDate()
  }
  return manilaStamp(year, month, day, 15)
}

export function dailyKey(now: number): string {
  const parts = manilaParts(dailyPeriodStart(now))
  const month = String(parts.month + 1).padStart(2, "0")
  const day = String(parts.day).padStart(2, "0")
  return `${parts.year}-${month}-${day}`
}

export function weeklyPeriodStart(now: number): number {
  const start = dailyPeriodStart(now)
  const weekday = manilaParts(start).weekday
  const sinceWednesday = (weekday - 3 + 7) % 7
  return start - sinceWednesday * DAY_MS
}

export function weeklyKey(now: number): string {
  return dailyKey(weeklyPeriodStart(now))
}

export function nextDailyReset(now: number): number {
  return dailyPeriodStart(now) + DAY_MS
}

export function nextWeeklyReset(now: number): number {
  return weeklyPeriodStart(now) + 7 * DAY_MS
}

export function inWeeklyBurnWindow(now: number): boolean {
  const reset = nextWeeklyReset(now)
  return now >= reset - DAY_MS && now < reset
}

export function manilaDateStamp(now: number): string {
  const parts = manilaParts(now)
  const month = String(parts.month + 1).padStart(2, "0")
  const day = String(parts.day).padStart(2, "0")
  return `${parts.year}-${month}-${day}`
}

export function backupFileName(now: number): string {
  return `aion2-tracker-${manilaDateStamp(now)}.json`
}

export type BossTimer = {
  id: string
  name: string
  at: number
}

const BOSSES: { id: string; name: string; days: number[]; hour: number; minute: number }[] = [
  { id: "nahma", name: "Guardian Lord Nahma", days: [0, 5], hour: 21, minute: 0 },
  { id: "executors", name: "Abyss Executors", days: [1, 4, 6], hour: 21, minute: 30 },
]

export function upcomingBosses(now: number): BossTimer[] {
  return BOSSES.map((boss) => ({
    id: boss.id,
    name: boss.name,
    at: nextWeekdayTime(now, boss.days, boss.hour, boss.minute),
  })).sort((a, b) => a.at - b.at)
}

function nextWeekdayTime(now: number, days: number[], hour: number, minute: number): number {
  const today = manilaParts(now)
  for (let offset = 0; offset < 8; offset += 1) {
    const date = new Date(Date.UTC(today.year, today.month, today.day) + offset * DAY_MS)
    const weekday = date.getUTCDay()
    if (!days.includes(weekday)) continue
    const at = manilaStamp(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute)
    if (at > now) return at
  }
  return now + 7 * DAY_MS
}
