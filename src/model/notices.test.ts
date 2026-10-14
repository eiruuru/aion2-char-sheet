import { describe, expect, it } from "vitest"
import { BOSS_SOON_MS, rosterMark, type SessionItem } from "./checklist"
import { dueNotices, pendingNotices, rememberNotices } from "./notices"
import type { BossTimer } from "./schedule"

const NOW = Date.parse("2026-10-15T04:00:00.000Z")

function item(overrides: Partial<SessionItem> & Pick<SessionItem, "id" | "taskName">): SessionItem {
  return {
    band: "today",
    characterName: "Nairen",
    title: overrides.taskName,
    detail: "Still open.",
    characterId: "main",
    shared: false,
    count: 0,
    cap: 1,
    ...overrides,
  }
}

function memory() {
  const saved = new Map<string, string>()
  return {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => { saved.set(key, value) },
  }
}

describe("notices", () => {
  const full = item({ id: "main:nightmare", taskName: "Nightmare", band: "lost", detail: "Another charge would be lost." })
  const daily = item({ id: "main:qina", taskName: "Open world Qina" })
  const boss: BossTimer = { id: "nahma", name: "Guardian Lord Nahma", at: NOW + 30 * 60 * 1000 }

  it("notifies once for a full bank and a boss inside two hours", () => {
    const notices = dueNotices([full, daily], [boss, { id: "later", name: "Abyss Executors", at: NOW + BOSS_SOON_MS + 1 }], NOW)
    expect(notices.map((notice) => notice.title)).toEqual(["Nightmare", "Guardian Lord Nahma"])
    expect(notices[1].body).toMatch(/^Spawns in /)
    const store = memory()
    expect(pendingNotices(notices, store)).toHaveLength(2)
    rememberNotices(notices, store)
    expect(pendingNotices(notices, store)).toHaveLength(0)
    const nextDay = dueNotices([full], [], Date.parse("2026-10-16T04:00:00.000Z"))
    expect(pendingNotices(nextDay, store)).toHaveLength(1)
    const nextSpawn = dueNotices([], [{ ...boss, at: boss.at + 7 * 24 * 60 * 60 * 1000 }], boss.at + 7 * 24 * 60 * 60 * 1000 - 60 * 1000)
    expect(pendingNotices(nextSpawn, store)).toHaveLength(1)
  })
})

describe("roster marks", () => {
  it("counts open work and marks a full bank or a close boss", () => {
    const items = [
      item({ id: "main:qina", taskName: "Open world Qina" }),
      item({ id: "alt:field-bosses", taskName: "Field bosses", characterId: "alt", characterName: "Lumen" }),
      item({ id: "alt:nightmare", taskName: "Nightmare", characterId: "alt", characterName: "Lumen", band: "lost" }),
      item({ id: "nahma", taskName: "Guardian Lord Nahma", characterId: null, characterName: null, band: "lost" }),
    ]
    expect(rosterMark(items, "main")).toEqual({ count: 1, urgent: false })
    expect(rosterMark(items, "alt")).toEqual({ count: 2, urgent: true })
    const quiet = items.filter((entry) => entry.id !== "nahma" && entry.id !== "alt:nightmare")
    expect(rosterMark(quiet, "alt")).toEqual({ count: 1, urgent: false })
    expect(rosterMark([...quiet, items[3]], "alt").urgent).toBe(true)
  })
})
