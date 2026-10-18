import { describe, expect, it } from "vitest"
import { applyLiveEvent } from "./liveSync"
import type { CharacterRecord, StoreData } from "./store"

function character(patch: Partial<CharacterRecord> = {}): CharacterRecord {
  return {
    id: "as:1501:aria",
    characterId: "aria",
    serverId: 1501,
    serverName: "Siel",
    region: "as",
    name: "Aria",
    className: "Cleric",
    raceName: "Elyos",
    role: "main",
    addedAt: "2026-10-18T00:00:00.000Z",
    odyle: null,
    resources: { crystals: null, kinah: null, abyss: null },
    latest: null,
    history: [],
    ...patch,
  }
}

function store(record: CharacterRecord): StoreData {
  return { version: 1, membership: true, characters: [record], selectedId: record.id }
}

describe("live sync events", () => {
  it("writes an Odyle reading and ignores an older packet", () => {
    const first = applyLiveEvent(store(character()), "as:1501:aria", {
      type: "odyle",
      amount: 650.8,
      at: "2026-10-18T12:00:00.000Z",
    })
    expect(first.characters[0]?.odyle).toEqual({ amount: 650, readAt: "2026-10-18T12:00:00.000Z" })
    const stale = applyLiveEvent(first, "as:1501:aria", {
      type: "odyle",
      amount: 10,
      at: "2026-10-18T11:00:00.000Z",
    })
    expect(stale.characters[0]?.odyle?.amount).toBe(650)
  })

  it("merges pet souls onto the selected character and keeps a newer reading", () => {
    const seeded = applyLiveEvent(store(character()), "as:1501:aria", {
      type: "pet",
      level: 3,
      souls: 12,
      soulsToNext: 40,
      name: "Swift Lupa",
      at: "2026-10-18T12:00:00.000Z",
    })
    const next = applyLiveEvent(seeded, "as:1501:aria", {
      type: "pet",
      souls: 13,
      at: "2026-10-18T12:05:00.000Z",
    })
    expect(next.characters[0]?.petProgress).toMatchObject({
      name: "Swift Lupa",
      level: 3,
      souls: 13,
      soulsToNext: 40,
      source: "live",
    })
    const stale = applyLiveEvent(next, "as:1501:aria", {
      type: "pet",
      souls: 1,
      at: "2026-10-18T12:01:00.000Z",
    })
    expect(stale.characters[0]?.petProgress?.souls).toBe(13)
  })

  it("adds every recent kill to the open pet on the matched character", () => {
    const base = store(character({ trackingPetId: "sparkie", petTracks: { sparkie: { level: 1, kills: 2 } } }))
    const next = applyLiveEvent(base, "as:1501:aria", {
      type: "kills",
      names: ["Krall Armed Soldier", "Krall Sentinel"],
      at: "2026-10-18T12:06:00.000Z",
    })
    expect(next.characters[0]?.petTracks?.sparkie).toEqual({ level: 1, kills: 4 })
    const missed = applyLiveEvent(store(character()), "as:1501:aria", {
      type: "kills",
      names: ["Sparkie"],
      at: "2026-10-18T12:06:00.000Z",
    })
    expect(missed.characters[0]?.petTracks).toBeUndefined()
  })

  it("does nothing when no character is selected", () => {
    const base = store(character())
    expect(applyLiveEvent(base, null, { type: "odyle", amount: 1, at: "2026-10-18T12:00:00.000Z" })).toBe(base)
  })
})
