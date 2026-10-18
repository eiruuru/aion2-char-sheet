import { describe, expect, it } from "vitest"
import { normalizePetProgress, petFill } from "./petProgress"

describe("pet progress", () => {
  it("keeps a valid reading and drops a broken one", () => {
    expect(normalizePetProgress({
      name: " Swift Lupa ",
      level: 3,
      souls: 12,
      soulsToNext: 40,
      source: "live",
      updatedAt: "2026-10-18T12:00:00.000Z",
    })).toEqual({
      name: "Swift Lupa",
      level: 3,
      souls: 12,
      soulsToNext: 40,
      source: "live",
      updatedAt: "2026-10-18T12:00:00.000Z",
    })
    expect(normalizePetProgress({ level: -1, souls: 1 })).toBeNull()
    expect(normalizePetProgress(null)).toBeNull()
  })

  it("fills the bar from souls toward the next level", () => {
    expect(petFill({ level: 1, souls: 10, soulsToNext: 40, source: "manual", updatedAt: "2026-10-18T12:00:00.000Z" })).toBe(0.25)
    expect(petFill({ level: 1, souls: 50, soulsToNext: 40, source: "manual", updatedAt: "2026-10-18T12:00:00.000Z" })).toBe(1)
    expect(petFill({ level: 1, souls: 4, soulsToNext: null, source: "manual", updatedAt: "2026-10-18T12:00:00.000Z" })).toBe(0)
  })
})
