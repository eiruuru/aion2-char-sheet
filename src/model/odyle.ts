export const ODYLE_TICK_MS = 3 * 60 * 60 * 1000
export const ODYLE_PER_TICK = 15
export const ODYLE_CAP_FREE = 560
export const ODYLE_CAP_MEMBER = 840
export const CUBE_COST = 40

export type OdyleReading = {
  amount: number
  readAt: string
}

export type OdyleProjection = {
  current: number
  cap: number
  full: boolean
  aboveCap: boolean
  lost: number
  fullAt: number | null
  nextTickAt: number | null
  ticksUntilFull: number
}

export function odyleCap(membership: boolean): number {
  return membership ? ODYLE_CAP_MEMBER : ODYLE_CAP_FREE
}

export function projectOdyle(reading: OdyleReading, cap: number, now = Date.now()): OdyleProjection {
  const readAt = Date.parse(reading.readAt)
  const amount = Math.max(0, Math.floor(reading.amount))
  if (!Number.isFinite(readAt)) {
    return { current: amount, cap, full: amount >= cap, aboveCap: amount > cap, lost: 0, fullAt: null, nextTickAt: null, ticksUntilFull: 0 }
  }
  if (amount > cap) {
    return { current: amount, cap, full: true, aboveCap: true, lost: 0, fullAt: null, nextTickAt: null, ticksUntilFull: 0 }
  }
  const elapsed = Math.max(0, now - readAt)
  const ticks = Math.floor(elapsed / ODYLE_TICK_MS)
  const raw = amount + ticks * ODYLE_PER_TICK
  if (raw >= cap) {
    const needed = Math.ceil((cap - amount) / ODYLE_PER_TICK)
    return {
      current: cap,
      cap,
      full: true,
      aboveCap: false,
      lost: raw - cap,
      fullAt: readAt + needed * ODYLE_TICK_MS,
      nextTickAt: null,
      ticksUntilFull: 0,
    }
  }
  const room = cap - raw
  const ticksUntilFull = Math.ceil(room / ODYLE_PER_TICK)
  return {
    current: raw,
    cap,
    full: false,
    aboveCap: false,
    lost: 0,
    fullAt: readAt + (ticks + ticksUntilFull) * ODYLE_TICK_MS,
    nextTickAt: readAt + (ticks + 1) * ODYLE_TICK_MS,
    ticksUntilFull,
  }
}

export function spendOdyle(current: number, cost: number): number {
  return Math.max(0, current - cost)
}

export function shiftOdyleClock(reading: OdyleReading, cap: number, now: number, remainingMs: number): OdyleReading {
  const projection = projectOdyle(reading, cap, now)
  const remaining = Math.min(ODYLE_TICK_MS, Math.max(1000, remainingMs))
  return {
    amount: projection.current,
    readAt: new Date(now + remaining - ODYLE_TICK_MS).toISOString(),
  }
}

export function spendOdyleReading(reading: OdyleReading, cap: number, now: number, cost: number): OdyleReading {
  const projection = projectOdyle(reading, cap, now)
  const remaining = projection.nextTickAt == null ? ODYLE_TICK_MS : projection.nextTickAt - now
  return shiftOdyleClock(
    { amount: spendOdyle(projection.current, cost), readAt: new Date(now).toISOString() },
    cap,
    now,
    remaining,
  )
}

export function compareOdyle(
  a: OdyleProjection | null,
  b: OdyleProjection | null,
): number {
  const rank = (projection: OdyleProjection | null) => {
    if (!projection) return 3
    if (projection.full) return 0
    if (projection.fullAt != null) return 1
    return 2
  }
  const rankA = rank(a)
  const rankB = rank(b)
  if (rankA !== rankB) return rankA - rankB
  if (rankA === 0) return (b?.lost ?? 0) - (a?.lost ?? 0)
  if (rankA === 1) return (a?.fullAt ?? 0) - (b?.fullAt ?? 0)
  return 0
}
