import { describe, expect, it, vi } from "vitest"
import {
  GUIDE_DAY_MS,
  guideIsFresh,
  guideLines,
  guideSource,
  loadClassGuide,
  parseGuideHtml,
  type GuideSummary,
} from "./guides"
import type { SkillPoint } from "./snapshot"

const NAMES = [
  "Earth Punishment",
  "Prayer of Amplification",
  "Noble Aura",
  "Light of Protection",
  "Yustiel's Power",
  "Condemnation",
  "Judgment Thunder",
]

const PAGE = `
<title>Cleric PvE guide</title>
<table>
  <tr><th>Part</th><th>What to do</th></tr>
  <tr><td>Stigmas</td><td>Earth Punishment always, plus three that depend on the party</td></tr>
</table>
<table>
  <tr><th>Your party</th><th>Stigmas</th><th>Source</th></tr>
  <tr><td>No Chanter</td><td>Earth Punishment, Prayer of Amplification, Noble Aura, Light of Protection</td><td>Guide</td></tr>
</table>
<table>
  <tr><th>Skill</th><th>Job</th><th>Early</th><th>Level 45</th></tr>
  <tr><td>Condemnation</td><td>Main damage</td><td>12</td><td>20</td></tr>
  <tr><td>Judgment Thunder</td><td>Second damage</td><td>8</td><td>16</td></tr>
</table>
`

function skill(overrides: Partial<SkillPoint> & Pick<SkillPoint, "name">): SkillPoint {
  return { category: "Dp", level: 1, acquired: true, equipped: false, ...overrides }
}

function guide(overrides: Partial<GuideSummary> = {}): GuideSummary {
  return {
    classKey: "cleric",
    title: "Cleric PvE guide",
    url: "https://aion2vault.com/builds/cleric/pve/",
    stigmas: ["Earth Punishment", "Prayer of Amplification", "Noble Aura", "Light of Protection"],
    skills: [{ name: "Condemnation", target: 20 }, { name: "Judgment Thunder", target: 16 }],
    fetchedAt: Date.parse("2026-10-14T00:00:00Z"),
    ...overrides,
  }
}

describe("guide pages", () => {
  it("points Elementalist at the Spiritmaster article and skips a class with no page", () => {
    expect(guideSource("Elementalist")?.url).toBe("https://aion2vault.com/builds/spiritmaster/pve/")
    expect(guideSource("Brawler")).toBeNull()
  })

  it("reads the first stigma set and the level-45 skill targets from a guide table", () => {
    const parsed = parseGuideHtml(PAGE, NAMES, "https://aion2vault.com/builds/cleric/pve/")
    expect(parsed?.stigmas).toEqual(["Earth Punishment", "Prayer of Amplification", "Noble Aura", "Light of Protection"])
    expect(parsed?.skills).toEqual([
      { name: "Condemnation", target: 20 },
      { name: "Judgment Thunder", target: 16 },
    ])
    expect(parsed?.title).toBe("Cleric PvE guide")
  })

  it("keeps a comma-separated stigma row when the page has no stigma column", () => {
    const html = `<table><tr><td>Stigmas</td><td>Vaizel's Authority, Bow of Blessing, Supporting Fire, plus a fourth</td></tr></table>`
    const parsed = parseGuideHtml(html, ["Vaizel's Authority", "Bow of Blessing", "Supporting Fire", "Griffon Arrow"], "https://example.test/ranger")
    expect(parsed?.stigmas).toEqual(["Vaizel's Authority", "Bow of Blessing", "Supporting Fire"])
  })

  it("returns nothing when the stigma list cannot be read", () => {
    expect(parseGuideHtml("<p>No tables here.</p>", NAMES, "https://example.test")).toBeNull()
  })
})

describe("guide advice", () => {
  it("names an equipped stigma the guide does not use and links the article", () => {
    const skills = [
      skill({ name: "Yustiel's Power", level: 20, equipped: true }),
      skill({ name: "Earth Punishment", level: 10, equipped: true }),
      skill({ name: "Condemnation", category: "Active", level: 20, equipped: true }),
    ]
    const lines = guideLines(skills, guide(), "Cleric")
    expect(lines[0]).toMatchObject({
      title: "Yustiel's Power is not in the Cleric guide",
      href: "https://aion2vault.com/builds/cleric/pve/",
      linkLabel: "Cleric PvE guide",
    })
    expect(lines[0].detail).toContain("Yustiel's Power is equipped at 20.")
    expect(lines[0].detail).toContain("Earth Punishment, Prayer of Amplification, Noble Aura, and Light of Protection")
    expect(lines[0].detail).not.toContain("Main damage")
  })

  it("says the stigmas match and records the day they were checked", () => {
    const skills = guide().stigmas.map((name) => skill({ name, level: 10, equipped: true }))
    const lines = guideLines(skills, guide(), "Cleric")
    expect(lines).toHaveLength(1)
    expect(lines[0].title).toBe("Stigmas match the guide")
    expect(lines[0].detail).toContain("Checked")
  })

  it("adds one skill line for the largest gap", () => {
    const skills = [
      ...guide().stigmas.map((name) => skill({ name, equipped: true })),
      skill({ name: "Condemnation", category: "Active", level: 10, equipped: true }),
      skill({ name: "Judgment Thunder", category: "Active", level: 1, equipped: true }),
    ]
    const lines = guideLines(skills, guide(), "Cleric")
    expect(lines.map((line) => line.id)).toEqual(["guide-stigmas", "guide-skill"])
    expect(lines[1].detail).toBe("Judgment Thunder is 1. The guide aims for 16.")
  })

  it("stays quiet without stigma data or a guide", () => {
    expect(guideLines([], guide(), "Cleric")).toEqual([])
    expect(guideLines([skill({ name: "Bolt", category: "Active" })], guide(), "Cleric")).toEqual([])
    expect(guideLines([skill({ name: "Yustiel's Power", equipped: true })], null, "Cleric")).toEqual([])
  })
})

describe("guide cache", () => {
  it("refetches after 24 hours and keeps the previous summary when the new page cannot be read", async () => {
    const memory = new Map<string, string>()
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value) },
    }
    const now = Date.parse("2026-10-14T00:00:00Z")
    const fetchImpl = vi.fn(async () => new Response(PAGE, { status: 200 }))
    const first = await loadClassGuide("Cleric", NAMES, storage, now, fetchImpl)
    expect(first?.stigmas).toHaveLength(4)
    expect(guideIsFresh(first!, now + GUIDE_DAY_MS - 1)).toBe(true)
    await loadClassGuide("Cleric", NAMES, storage, now + 1000, fetchImpl)
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    fetchImpl.mockResolvedValueOnce(new Response("<p>changed</p>", { status: 200 }))
    const kept = await loadClassGuide("Cleric", NAMES, storage, now + GUIDE_DAY_MS, fetchImpl)
    expect(kept?.stigmas).toEqual(first?.stigmas)
    expect(guideIsFresh(kept!, now + GUIDE_DAY_MS)).toBe(false)
  })
})
