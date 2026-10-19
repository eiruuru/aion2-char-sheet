import { describe, expect, it } from "vitest"
import { farmRemaining, finishFarmSession, formatElapsed, normalizeFarmSessions, type FarmSession } from "./farmSession"

const session = (id: string): FarmSession => ({
  id,
  characterId: "siel:lunatiq",
  characterName: "Lunatiq",
  startedAt: "2026-10-19T03:00:00.000Z",
  endedAt: "2026-10-19T03:12:00.000Z",
  pets: [{ petId: "zaif", name: "Zaif", kills: 22, goal: 32 }],
})

describe("farm sessions", () => {
  it("counts down to a session goal", () => {
    expect(farmRemaining(0, null)).toBe("0 kills this session")
    expect(farmRemaining(1, null)).toBe("1 kill this session")
    expect(farmRemaining(22, 32)).toBe("10 left")
    expect(farmRemaining(31, 32)).toBe("1 left")
    expect(farmRemaining(32, 32)).toBe("Done")
    expect(formatElapsed(75_000)).toBe("01:15")
    expect(formatElapsed(3_661_000)).toBe("1:01:01")
  })

  it("keeps the newest 40 sessions", () => {
    const saved = Array.from({ length: 40 }, (_, index) => session(`old-${index}`))
    const next = finishFarmSession(saved, session("new"))
    expect(next).toHaveLength(40)
    expect(next[0]?.id).toBe("new")
    expect(next.some((item) => item.id === "old-39")).toBe(false)
    expect(normalizeFarmSessions([{ ...session("kept"), pets: [{ petId: "zaif", name: "Zaif", kills: 2, goal: null }] }])).toHaveLength(1)
    expect(normalizeFarmSessions([{ id: "bad" }])).toEqual([])
  })
})