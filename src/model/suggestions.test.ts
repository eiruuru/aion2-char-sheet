import { describe, expect, it } from "vitest"
import type { CharacterRecord } from "./store"
import type { Snapshot } from "./snapshot"
import { characterSuggestions, priorityBoard, rosterOrder } from "./suggestions"

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
      { id: 82, name: "Zikel", open: true, openNodeCount: 70, totalNodeCount: 88, openPercent: 80 },
      { id: 83, name: "Vaizel", open: true, openNodeCount: 88, totalNodeCount: 88, openPercent: 100 },
      { id: 84, name: "Triniel", open: true, openNodeCount: 10, totalNodeCount: 116, openPercent: 9 },
      { id: 86, name: "Azphel", open: true, openNodeCount: 20, totalNodeCount: 152, openPercent: 13 },
    ],
    gear: [
      { slot: "MainHand", name: "Staff", enchant: 10, grade: "Unique" },
      { slot: "Torso", name: "Coat", enchant: 8, grade: "Unique" },
      { slot: "Pants", name: "Greaves", enchant: 4, grade: "Rare" },
    ],
    skills: [
      { name: "Onslaught", category: "Active", level: 10, acquired: true },
      { name: "Crush", category: "Active", level: 14, acquired: true },
    ],
    closedNodes: [
      { boardId: 84, boardName: "Triniel", name: "Skill Level Up - Wave", effect: "Wave +1", grade: "Legend", type: "SkillLevel", cost: 3 },
      { boardId: 84, boardName: "Triniel", name: "Attack", effect: "Attack Bonus +3", grade: "Common", type: "Stat", cost: 1 },
    ],
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
  it("picks the least complete open board and prices the cheapest skill node", () => {
    const record = character({ resources: { crystals: 2, kinah: null, abyss: null } })
    expect(priorityBoard(record.latest!)?.name).toBe("Triniel")
    const suggestion = characterSuggestions(record, [record], false).find((item) => item.id === "daevanion")
    expect(suggestion?.title).toContain("Triniel")
    expect(suggestion?.detail).toContain("Wave +1")
    expect(suggestion?.detail).toContain("about 3 crystals")
    expect(suggestion?.detail).not.toContain("short")
  })

  it("points at the lowest weapon or armor enchant", () => {
    const suggestion = characterSuggestions(character(), [character()], false).find((item) => item.id === "gear")
    expect(suggestion?.title).toContain("Pants")
    expect(suggestion?.detail).toContain("+4")
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

  it("flags an alt close to the next board and behind the main", () => {
    const main = character()
    const alt = character({
      id: "nae:1102:def",
      name: "Bram",
      role: "alt",
      latest: snapshot({
        level: 28,
        boards: [
          { id: 81, name: "Nezekan", open: true, openNodeCount: 10, totalNodeCount: 88, openPercent: 11 },
          { id: 82, name: "Zikel", open: true, openNodeCount: 8, totalNodeCount: 88, openPercent: 9 },
          { id: 83, name: "Vaizel", open: false, openNodeCount: 0, totalNodeCount: 88, openPercent: 0 },
          { id: 84, name: "Triniel", open: false, openNodeCount: 0, totalNodeCount: 116, openPercent: 0 },
          { id: 86, name: "Azphel", open: false, openNodeCount: 0, totalNodeCount: 152, openPercent: 0 },
        ],
      }),
    })
    const notes = characterSuggestions(alt, [main, alt], false).map((item) => item.id)
    expect(notes).toContain("alt-unlock")
    expect(notes).toContain("alt-board-81")
  })
})
