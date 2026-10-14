import { describe, expect, it } from "vitest"
import { chooseCharacter, normalizeStore, type StoreData } from "./store"

describe("last character", () => {
  const store = { version: 1, membership: false, characters: [], selectedId: "alt-b" } as StoreData

  it("keeps the saved character and opens the first one when that character is gone", () => {
    expect(normalizeStore(store).selectedId).toBe("alt-b")
    expect(chooseCharacter("alt-b", ["main-a", "alt-b"])).toBe("alt-b")
    expect(chooseCharacter("missing", ["main-a", "alt-b"])).toBe("main-a")
    expect(chooseCharacter(null, [])).toBeNull()
  })
})
