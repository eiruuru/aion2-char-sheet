import { describe, expect, it } from "vitest"
import { applyEnglish, guideIsFresh, loadGuide, parseClassFile, GUIDE_REFRESH_MS, GUIDE_STORAGE_KEY, type GuideBook } from "./guideRefresh"
import type { ClassSituation } from "./classPriorities"

const memory = () => {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value) },
  }
}

const previous: ClassSituation = {
  mode: "pve",
  situation: "bosses",
  role: "Group tank",
  core: ["Judgment"],
  stigmas: ["Shield"],
  steps: "Hold the boss.",
  swaps: "Swap the shield.",
  risks: "Do not dump every defense.",
  tip: "Agree who covers the next hit.",
  stats: ["HP"],
  skills: [{ name: "Judgment", slot: "active", tier: "S", why: "Check the activation condition first." }],
}

describe("guide refresh", () => {
  it("turns a class file into skills, stigmas, and tactics", () => {
    const parsed = parseClassFile({
      name: "Templar",
      contexts: [{
        mode: "PvE",
        variant: "Боссы / группа",
        build: {
          role: "Танк группы",
          core_skills: ["Judgment"],
          stigmas: ["Shield"],
          steps: "Сначала закрепите внимание босса.",
          swaps: "",
          risks: "",
          tip: "",
          stats: ["HP"],
        },
        skills: [
          { title: "Judgment", slot: "Активные", tier: "S", why: "Проверьте условие активации и порог специализации, прежде чем строить повторяющийся цикл.", game_id: "1", icon_key: "skills-1", target: "Активные · CD 5s", training: { target: 16, later: 20, note: "Keep the condition." } },
          { title: "Not a pet", slot: "Питомцы", tier: "S", why: "skip" },
        ],
        recommendations: { "Арканы": [{ title: "Judgment", tier: "S", why: "Look for level bonuses.", target: "Aim for 16 now, 20 later" }] },
      }],
    }, {
      descriptions: { "1": "Deals damage to a target." },
      icons: { "skills-1": "icon.png" },
      pantheon: {},
      offers: [],
      boards: [{ name: "Nezekan", level: 12, stats: ["Combat Speed"], grade: "unique" }],
      speciesStats: ["Attack Bonus"],
      pets: [{ name: "Cogni", focus: "Power, then attack, crit, and HP" }],
    })
    expect(parsed?.name).toBe("Templar")
    expect(parsed?.situations[0]?.situation).toBe("bosses")
    expect(parsed?.situations[0]?.skills).toHaveLength(1)
    expect(parsed?.situations[0]?.skills[0]?.description).toBe("Deals damage to a target.")
    expect(parsed?.situations[0]?.skills[0]?.icon).toBe("icon.png")
    expect(parsed?.situations[0]?.arcana?.[0]?.title).toBe("Judgment")
    expect(parsed?.situations[0]?.daevanion?.[0]?.title).toBe("Nezekan")
    const english = applyEnglish(parsed?.situations ?? [], [previous])
    expect(english[0]?.skills[0]?.detail).toBe("Active · CD 5s")
    expect(english[0]?.role).toBe("Group tank")
    expect(english[0]?.skills[0]?.why).toContain("activation")
  })

  it("keeps the previous English line when a new sentence is not translated", () => {
    const next: ClassSituation[] = [{
      ...previous,
      role: "Новая роль без перевода",
      skills: [{ name: "Judgment", slot: "active", tier: "A", why: "Совсем новая фраза" }],
    }]
    const english = applyEnglish(next, [previous])
    expect(english[0]?.role).toBe("Group tank")
    expect(english[0]?.skills[0]?.tier).toBe("A")
    expect(english[0]?.skills[0]?.why).toBe("Check the activation condition first.")
  })

  it("uses a fresh cache and keeps the last copy when the download fails", async () => {
    const store = memory()
    const book: GuideBook = { Templar: [previous] }
    store.setItem(GUIDE_STORAGE_KEY, JSON.stringify({ fetchedAt: 1_000, book }))
    const fresh = await loadGuide(store, 1_000 + GUIDE_REFRESH_MS - 1, async () => { throw new Error("offline") })
    expect(fresh.failed).toBe(false)
    expect(fresh.book.Templar[0]?.role).toBe("Group tank")

    const stale = await loadGuide(store, 1_000 + GUIDE_REFRESH_MS, async () => new Response("nope", { status: 503 }))
    expect(stale.failed).toBe(true)
    expect(stale.book.Templar[0]?.core).toEqual(["Judgment"])
    expect(guideIsFresh({ fetchedAt: 1_000 }, 1_000 + GUIDE_REFRESH_MS)).toBe(false)
  })
})
