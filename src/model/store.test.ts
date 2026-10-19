import { describe, expect, it } from "vitest"
import { PETS, petByName, soulsToNext } from "./pets"
import { chooseCharacter, normalizeStore, type CharacterRecord, type StoreData } from "./store"

describe("last character", () => {
  const store = { version: 1, membership: false, characters: [], selectedId: "alt-b" } as StoreData

  it("keeps the saved character and opens the first one when that character is gone", () => {
    expect(normalizeStore(store).selectedId).toBe("alt-b")
    expect(chooseCharacter("alt-b", ["main-a", "alt-b"])).toBe("alt-b")
    expect(chooseCharacter("missing", ["main-a", "alt-b"])).toBe("main-a")
    expect(chooseCharacter(null, [])).toBeNull()
  })

  it("keeps a catalog pet's kills and seeds them from an older pet reading", () => {
    expect(PETS).toHaveLength(207)
    expect(PETS.every((pet) => pet.icon?.includes("/game/pets/"))).toBe(true)
    expect(soulsToNext(0)).toBe(5)
    expect(soulsToNext(1)).toBe(25)
    expect(soulsToNext(2)).toBe(75)
    expect(soulsToNext(3)).toBeNull()
    expect(petByName("Swift Lugi")?.id).toBe("swift-lugi")
    const record = {
      id: "as:1:aria",
      characterId: "aria",
      serverId: 1,
      serverName: "Siel",
      region: "as",
      name: "Aria",
      className: "Cleric",
      raceName: "Elyos",
      role: "main",
      addedAt: "2026-10-18T00:00:00.000Z",
      odyle: null,
      petProgress: { name: "Swift Lugi", level: 2, souls: 10, soulsToNext: 75, source: "manual", updatedAt: "2026-10-18T12:00:00.000Z" },
      resources: { crystals: null, kinah: null, abyss: null },
      latest: null,
      history: [],
    } as CharacterRecord
    const next = normalizeStore({ version: 1, membership: false, characters: [record] } as StoreData)
    expect(next.characters[0]?.trackingPetId).toBe("swift-lugi")
    expect(next.characters[0]?.petTracks?.["swift-lugi"]).toEqual({ level: 2, kills: 10 })
  })
})
