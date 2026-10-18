import { describe, expect, it } from "vitest"
import type { CharacterRecord } from "./store"
import type { Snapshot } from "./snapshot"
import { boardRank, rosterOrder } from "./suggestions"

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    at: "2026-10-14T00:00:00Z",
    level: 45,
    className: "Chanter",
    raceName: "Elyos",
    combatPower: 1000,
    itemLevel: 1500,
    titleName: "None",
    titlesOwned: 1,
    titlesTotal: 10,
    boards: [
      { id: 81, name: "Nezekan", open: true, openNodeCount: 40, totalNodeCount: 88, openPercent: 45 },
      { id: 84, name: "Triniel", open: true, openNodeCount: 10, totalNodeCount: 116, openPercent: 9 },
    ],
    gear: [],
    skills: [],
    closedNodes: [],
    ...overrides,
  }
}

function character(overrides: Partial<CharacterRecord> = {}): CharacterRecord {
  return {
    id: "nae:1101:abc",
    characterId: "abc",
    serverId: 1101,
    serverName: "Siel",
    region: "nae",
    name: "Aria",
    className: "Chanter",
    raceName: "Elyos",
    role: "main",
    addedAt: "2026-10-14T00:00:00Z",
    odyle: null,
    resources: { crystals: null, kinah: null, abyss: null },
    latest: snapshot(),
    history: [],
    ...overrides,
  }
}

describe("suggestions", () => {
  it("ranks Daevanion boards in unlock order", () => {
    expect(boardRank({ id: 84, name: "Triniel" })).toBeLessThan(boardRank({ id: 86, name: "Azphel" }))
  })

  it("keeps the main first even when an alt is closer to the Odyle cap", () => {
    const now = Date.parse("2026-10-14T08:00:00.000Z")
    const main = character({ id: "main", name: "Lunatiq", role: "main" })
    const alt = character({
      id: "alt",
      name: "Lunaciel",
      role: "alt",
      odyle: { amount: 560, readAt: "2026-10-14T08:00:00.000Z" },
    })
    expect(rosterOrder([alt, main], false, now).map((entry) => entry.id)).toEqual(["main", "alt"])
  })
})
