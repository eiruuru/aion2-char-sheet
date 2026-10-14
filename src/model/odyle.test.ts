import { describe, expect, it } from "vitest"
import {
  CUBE_COST,
  ODYLE_CAP_FREE,
  ODYLE_PER_TICK,
  ODYLE_TICK_MS,
  compareOdyle,
  projectOdyle,
  shiftOdyleClock,
  spendOdyle,
  spendOdyleReading,
} from "./odyle"

const start = Date.parse("2026-10-14T00:00:00Z")

describe("projectOdyle", () => {
  it("keeps the typed amount before a full tick", () => {
    const projection = projectOdyle({ amount: 100, readAt: new Date(start).toISOString() }, ODYLE_CAP_FREE, start + ODYLE_TICK_MS - 1)
    expect(projection.current).toBe(100)
    expect(projection.full).toBe(false)
    expect(projection.lost).toBe(0)
  })

  it("adds 15 after each whole 3 hour period", () => {
    const projection = projectOdyle({ amount: 100, readAt: new Date(start).toISOString() }, ODYLE_CAP_FREE, start + ODYLE_TICK_MS * 2)
    expect(projection.current).toBe(100 + ODYLE_PER_TICK * 2)
    expect(projection.ticksUntilFull).toBe(Math.ceil((ODYLE_CAP_FREE - 130) / ODYLE_PER_TICK))
  })

  it("stops at the cap and counts regen lost after that", () => {
    const projection = projectOdyle({ amount: 550, readAt: new Date(start).toISOString() }, ODYLE_CAP_FREE, start + ODYLE_TICK_MS * 3)
    expect(projection.current).toBe(ODYLE_CAP_FREE)
    expect(projection.full).toBe(true)
    expect(projection.lost).toBe(550 + 45 - ODYLE_CAP_FREE)
  })

  it("counts every tick as lost when the reading is already at cap", () => {
    const projection = projectOdyle({ amount: 560, readAt: new Date(start).toISOString() }, ODYLE_CAP_FREE, start + ODYLE_TICK_MS * 4)
    expect(projection.lost).toBe(60)
    expect(projection.fullAt).toBe(start)
  })

  it("leaves consumable energy above the cap out of the clock", () => {
    const projection = projectOdyle({ amount: 900, readAt: new Date(start).toISOString() }, ODYLE_CAP_FREE, start + ODYLE_TICK_MS * 5)
    expect(projection.current).toBe(900)
    expect(projection.aboveCap).toBe(true)
    expect(projection.lost).toBe(0)
  })
})

describe("shiftOdyleClock", () => {
  it("keeps the shown amount and moves the next +15 to the time left in game", () => {
    const now = start + ODYLE_TICK_MS + 30 * 60 * 1000
    const reading = { amount: 100, readAt: new Date(start).toISOString() }
    const remaining = 14 * 60 * 1000
    const shifted = shiftOdyleClock(reading, ODYLE_CAP_FREE, now, remaining)
    const projection = projectOdyle(shifted, ODYLE_CAP_FREE, now)
    expect(projection.current).toBe(115)
    expect(projection.nextTickAt).toBe(now + remaining)
  })

  it("does not add 15 when the typed countdown is zero", () => {
    const shifted = shiftOdyleClock({ amount: 100, readAt: new Date(start).toISOString() }, ODYLE_CAP_FREE, start, 0)
    const projection = projectOdyle(shifted, ODYLE_CAP_FREE, start)
    expect(projection.current).toBe(100)
    expect(projection.nextTickAt).toBe(start + 1000)
  })

  it("caps a countdown longer than 3 hours", () => {
    const shifted = shiftOdyleClock({ amount: 100, readAt: new Date(start).toISOString() }, ODYLE_CAP_FREE, start, ODYLE_TICK_MS + 60_000)
    const projection = projectOdyle(shifted, ODYLE_CAP_FREE, start)
    expect(projection.current).toBe(100)
    expect(projection.nextTickAt).toBe(start + ODYLE_TICK_MS)
  })
})

describe("spend and sort", () => {
  it("subtracts a cube without going below zero", () => {
    expect(spendOdyle(50, CUBE_COST)).toBe(10)
    expect(spendOdyle(20, CUBE_COST)).toBe(0)
  })

  it("keeps the time until the next +15 after a cube", () => {
    const now = start + 60 * 60 * 1000
    const reading = { amount: 100, readAt: new Date(start).toISOString() }
    const spent = spendOdyleReading(reading, ODYLE_CAP_FREE, now, CUBE_COST)
    const projection = projectOdyle(spent, ODYLE_CAP_FREE, now)
    expect(projection.current).toBe(60)
    expect(projection.nextTickAt).toBe(now + 2 * 60 * 60 * 1000)
  })

  it("sorts full characters ahead of ones still filling", () => {
    const full = projectOdyle({ amount: 560, readAt: new Date(start).toISOString() }, ODYLE_CAP_FREE, start)
    const filling = projectOdyle({ amount: 100, readAt: new Date(start).toISOString() }, ODYLE_CAP_FREE, start)
    expect(compareOdyle(full, filling)).toBeLessThan(0)
    expect(compareOdyle(null, filling)).toBeGreaterThan(0)
  })
})
