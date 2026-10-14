import { describe, expect, it } from "vitest"
import {
  characterGoals,
  emptyProgress,
  listClock,
  rowsForCharacter,
  seasonNotice,
  sessionItems,
  setTaskBank,
  setTaskCount,
  type ChecklistCharacter,
} from "./checklist"
import { backupFileName, dailyKey, inWeeklyBurnWindow, weeklyKey } from "./schedule"

const WED_BEFORE = Date.parse("2026-10-14T06:59:00.000Z")
const WED_RESET = Date.parse("2026-10-14T07:00:00.000Z")
const TUE_BURN = Date.parse("2026-10-13T08:00:00.000Z")
const TUE_BEFORE_BURN = Date.parse("2026-10-13T06:59:00.000Z")
const FAR_FROM_RESET = Date.parse("2026-10-14T08:00:00.000Z")
const NEAR_DAILY_RESET = Date.parse("2026-10-15T02:00:00.000Z")

function character(patch: Partial<ChecklistCharacter> & Pick<ChecklistCharacter, "id" | "name" | "role">): ChecklistCharacter {
  return { level: 45, itemLevel: 2000, odyleNearCap: false, odyleKnown: true, region: "as", serverId: 1501, ...patch }
}

describe("Manila reset periods", () => {
  it("rolls the daily period at 15:00 Manila", () => {
    expect(dailyKey(WED_BEFORE)).toBe("2026-10-13")
    expect(dailyKey(WED_RESET)).toBe("2026-10-14")
  })

  it("rolls the weekly period on Wednesday at 15:00 Manila", () => {
    expect(weeklyKey(WED_BEFORE)).toBe("2026-10-07")
    expect(weeklyKey(WED_RESET)).toBe("2026-10-14")
  })

  it("opens the burn window on Tuesday at 15:00 Manila", () => {
    expect(inWeeklyBurnWindow(TUE_BEFORE_BURN)).toBe(false)
    expect(inWeeklyBurnWindow(TUE_BURN)).toBe(true)
    expect(inWeeklyBurnWindow(WED_RESET)).toBe(false)
  })

  it("dates the backup from the Manila calendar day", () => {
    expect(backupFileName(WED_BEFORE)).toBe("aion2-tracker-2026-10-14.json")
    expect(backupFileName(Date.parse("2026-10-13T15:59:00.000Z"))).toBe("aion2-tracker-2026-10-13.json")
  })
})

describe("assignment", () => {
  const main = character({ id: "main", name: "Nairen", role: "main", itemLevel: 1700 })
  const gearing = character({ id: "alt", name: "Clarion", role: "alt", itemLevel: 1000 })
  const ready = character({ id: "ready", name: "Ready", role: "alt", itemLevel: 1500 })
  const leveling = character({ id: "low", name: "Low", role: "alt", level: 40, itemLevel: 12 })

  it("gives a character under 45 no endgame rows", () => {
    expect(rowsForCharacter(leveling, [main, leveling], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)).toEqual([])
  })

  it("gives server pools to every level 45 character on that server", () => {
    const rows = rowsForCharacter(main, [main, gearing], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
    expect(rows.find((row) => row.taskId === "duty")?.mode).toBe("edit")
    const altRows = rowsForCharacter(gearing, [main, gearing], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
    expect(altRows.find((row) => row.taskId === "duty")?.shared).toBe(true)
    expect(altRows.some((row) => row.taskId === "fissure-week" || row.taskId === "command")).toBe(true)
    const saved = setTaskCount(emptyProgress(FAR_FROM_RESET), "duty", gearing, 2, false, FAR_FROM_RESET)
    const mainDuty = rowsForCharacter(main, [main, gearing], saved, false, FAR_FROM_RESET).find((row) => row.taskId === "duty")
    expect(mainDuty?.count).toBe(2)
    expect(mainDuty?.parts[0].owners).toEqual(["alt", "alt"])
  })

  it("keeps field bosses on a character under 1400 and hides the global raids", () => {
    const rows = rowsForCharacter(gearing, [main, gearing], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
    expect(rows.some((row) => row.taskId === "field-bosses")).toBe(true)
    expect(rows.some((row) => row.taskId.startsWith("raid-"))).toBe(false)
    expect(rows.some((row) => row.taskId === "krao" || row.taskId === "growth-graveyard" || row.taskId === "growth-fafnite")).toBe(false)
  })

  it("hides the global raids once a character reaches 1400", () => {
    const rows = rowsForCharacter(ready, [main, ready], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
    expect(rows.some((row) => row.taskId.startsWith("raid-"))).toBe(false)
    expect(rows.some((row) => row.taskId === "field-bosses")).toBe(false)
  })

  it("gives field bosses to the lowest character under 1400, then back to the main", () => {
    const gearingRows = rowsForCharacter(gearing, [main, gearing], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
    expect(gearingRows.some((row) => row.taskId === "field-bosses")).toBe(true)
    expect(rowsForCharacter(main, [main, gearing], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
      .some((row) => row.taskId === "field-bosses")).toBe(false)
    expect(rowsForCharacter(main, [main, ready], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
      .some((row) => row.taskId === "field-bosses")).toBe(true)
  })

  it("keeps Transcendence on the main once item level is 1600", () => {
    const lowMain = character({ id: "main", name: "Nairen", role: "main", itemLevel: 1500 })
    expect(rowsForCharacter(lowMain, [lowMain], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
      .some((row) => row.taskId === "transcendence")).toBe(false)
    expect(rowsForCharacter(main, [main, gearing], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
      .some((row) => row.taskId === "transcendence")).toBe(true)
    expect(rowsForCharacter(gearing, [main, gearing], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
      .some((row) => row.taskId === "transcendence")).toBe(false)
  })

  it("hides Wind Breeze buys unless membership is on, and raises the Shugo bank to 21", () => {
    const rows = rowsForCharacter(main, [main], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
    expect(rows.some((row) => row.taskId === "odyle-buy-char")).toBe(false)
    expect(rows.find((row) => row.taskId === "shugo")?.bankCap).toBe(12)
    const member = rowsForCharacter(main, [main], emptyProgress(FAR_FROM_RESET), true, FAR_FROM_RESET)
    expect(member.find((row) => row.taskId === "odyle-buy-char")?.cap).toBe(20)
    expect(member.find((row) => row.taskId === "odyle-buy-char")?.parts.map((part) => part.cap)).toEqual([20])
    expect(member.some((row) => row.taskId === "odyle-buy-server")).toBe(false)
    expect(member.find((row) => row.taskId === "shugo")?.bankCap).toBe(21)
  })

  it("keeps Abyss at 7 hours for a main at gear score 1000 and lists the seasonal event separately", () => {
    const under = character({ id: "main", name: "Nairen", role: "main", itemLevel: 999 })
    expect(rowsForCharacter(under, [under], emptyProgress(FAR_FROM_RESET), true, FAR_FROM_RESET)
      .some((row) => row.taskId === "abyss")).toBe(false)
    const atGate = character({ id: "main", name: "Nairen", role: "main", itemLevel: 1000 })
    const member = rowsForCharacter(atGate, [atGate], emptyProgress(FAR_FROM_RESET), true, FAR_FROM_RESET)
    const abyss = member.filter((row) => row.taskId === "abyss")
    expect(abyss).toHaveLength(1)
    expect(abyss[0].name).toBe("Abyss farming and missions")
    expect(abyss[0].cap).toBe(7)
    expect(abyss[0].cadence).toBe("weekly")
    const season = member.filter((row) => row.cadence === "season")
    expect(season.map((row) => row.taskId)).toContain("season-rift-kina")
    expect(season.find((row) => row.taskId === "season-rift-kina")?.cap).toBe(7)
    expect(season.find((row) => row.taskId === "season-shop-chest")?.cap).toBe(1)
    expect(member.filter((row) => row.cadence === "weekly").some((row) => row.taskId.startsWith("season-"))).toBe(false)
  })

  it("hides a seasonal task after its maintenance and keeps the saved mark", () => {
    const main = character({ id: "main", name: "Nairen", role: "main", itemLevel: 1700 })
    const before = Date.parse("2026-10-28T06:59:00.000Z")
    const riftEnd = Date.parse("2026-10-28T07:00:00.000Z")
    const halloweenEnd = Date.parse("2026-11-04T07:00:00.000Z")
    const progress = setTaskCount(emptyProgress(before), "season-rift-kina", main, 3, false, before)
    expect(rowsForCharacter(main, [main], progress, false, before).some((row) => row.taskId === "season-rift-kina")).toBe(true)
    const afterRift = rowsForCharacter(main, [main], progress, false, riftEnd)
    expect(afterRift.some((row) => row.taskId === "season-rift-kina")).toBe(false)
    expect(afterRift.some((row) => row.taskId === "season-abyss-hunt")).toBe(true)
    expect(progress.counts[`season-rift-kina|${main.id}`]).toBe(3)
    expect(rowsForCharacter(main, [main], progress, false, halloweenEnd).some((row) => row.cadence === "season")).toBe(false)
    expect(seasonNotice(before)).toContain("Oct 28")
    expect(seasonNotice(riftEnd)).not.toContain("Oct 28")
    expect(seasonNotice(halloweenEnd)).toBe("Weekly limits clear Wednesday 3:00 PM.")
    expect(listClock("daily", FAR_FROM_RESET)).toMatch(/^Resets in .+ Next: /)
    expect(listClock("weekly", FAR_FROM_RESET)).toMatch(/^Wednesday reset in /)
  })
})

describe("urgency", () => {
  const main = character({ id: "main", name: "Nairen", role: "main", itemLevel: 1700 })

  it("waits on Nightmare until the bank is full", () => {
    let progress = setTaskBank(emptyProgress(FAR_FROM_RESET), "nightmare", main, 10, false, FAR_FROM_RESET)
    let row = rowsForCharacter(main, [main], progress, false, FAR_FROM_RESET).find((item) => item.taskId === "nightmare")
    expect(row?.urgency).toBe("can-wait")
    progress = setTaskBank(progress, "nightmare", main, 14, false, FAR_FROM_RESET)
    row = rowsForCharacter(main, [main], progress, false, FAR_FROM_RESET).find((item) => item.taskId === "nightmare")
    expect(row?.urgency).toBe("do-now")
  })

  it("flags an open daily that does not carry over inside 6 hours of reset", () => {
    const early = rowsForCharacter(main, [main], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
      .find((row) => row.taskId === "qina")
    expect(early?.urgency).toBe("steady")
    const late = rowsForCharacter(main, [main], emptyProgress(NEAR_DAILY_RESET), false, NEAR_DAILY_RESET)
      .find((row) => row.taskId === "qina")
    expect(late?.urgency).toBe("do-now")
  })

  it("sorts dailies from critical to low and keeps Conquest as a note", () => {
    const dailies = rowsForCharacter(main, [main], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
      .filter((row) => row.cadence === "daily")
    expect(dailies.map((row) => row.taskId)).toEqual([
      "transcendence",
      "conquest",
      "nightmare",
      "duty",
      "field-bosses",
      "shugo",
      "dimension",
      "rift",
      "fissure-day",
      "qina",
    ])
    expect(dailies.find((row) => row.taskId === "conquest")?.mode).toBe("note")
    expect(dailies.find((row) => row.taskId === "dimension")?.name).toBe("Dimensional Invasion")
    expect(dailies.some((row) => row.taskId === "supply-daily" || row.taskId === "attendance")).toBe(false)
  })

  it("shows Odyle craft as 4 personal boxes plus 16 shared boxes", () => {
    const row = rowsForCharacter(main, [main], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
      .find((item) => item.taskId === "odyle-craft-char")
    expect(row?.cap).toBe(20)
    expect(row?.parts.map((part) => part.cap)).toEqual([4, 16])
    expect(row?.parts[1].shared).toBe(true)
    expect(rowsForCharacter(main, [main], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
      .some((item) => item.taskId === "odyle-craft-server")).toBe(false)
  })

  it("flags unfinished weeklies during the Tuesday burn window", () => {
    const row = rowsForCharacter(main, [main], emptyProgress(TUE_BURN), false, TUE_BURN)
      .find((item) => item.taskId === "ascension")
    expect(row?.urgency).toBe("before-wednesday")
  })
})

describe("progress", () => {
  it("drops yesterday's daily count when the period rolls", () => {
    const main = character({ id: "main", name: "Nairen", role: "main" })
    const saved = setTaskCount(emptyProgress(WED_RESET), "duty", main, 3, false, WED_RESET)
    const nextDay = Date.parse("2026-10-15T07:00:00.000Z")
    const row = rowsForCharacter(main, [main], saved, false, nextDay).find((item) => item.taskId === "duty")
    expect(row?.count).toBe(0)
  })

  it("clears weekly seasonal limits on Wednesday and keeps the event chest", () => {
    const main = character({ id: "main", name: "Nairen", role: "main" })
    let saved = setTaskCount(emptyProgress(FAR_FROM_RESET), "season-shop-odyle", main, 4, false, FAR_FROM_RESET)
    saved = setTaskCount(saved, "season-shop-chest", main, 1, false, FAR_FROM_RESET)
    const nextWeek = Date.parse("2026-10-21T07:00:00.000Z")
    const rows = rowsForCharacter(main, [main], saved, false, nextWeek)
    expect(rows.find((item) => item.taskId === "season-shop-odyle")?.count).toBe(0)
    expect(rows.find((item) => item.taskId === "season-shop-chest")?.count).toBe(1)
  })

  it("shows Daily Dungeon as 14 weekly boxes and completes it when the week is full", () => {
    const main = character({ id: "main", name: "Nairen", role: "main" })
    const saved = setTaskCount(emptyProgress(FAR_FROM_RESET), "fissure-day", main, 2, false, FAR_FROM_RESET)
    const rows = rowsForCharacter(main, [main], saved, false, FAR_FROM_RESET)
    const dungeon = rows.find((item) => item.taskId === "fissure-day")
    expect(rows.some((item) => item.taskId === "fissure-week")).toBe(false)
    expect(dungeon?.name).toBe("Daily Dungeon")
    expect(dungeon?.cap).toBe(14)
    expect(dungeon?.count).toBe(2)
    expect(dungeon?.parts[0].owners).toEqual(["main", "main"])
    const full = setTaskCount(saved, "fissure-week", main, 14, false, FAR_FROM_RESET)
    const done = rowsForCharacter(main, [main], full, false, FAR_FROM_RESET).find((item) => item.taskId === "fissure-day")
    expect(done?.count).toBe(14)
    expect(done?.urgency).toBe("done")
    expect(done?.reason).toBe("Done for this week.")
  })
})

describe("banks", () => {
  const main = character({ id: "main", name: "Nairen", role: "main", itemLevel: 1700 })
  const nextReset = Date.parse("2026-10-15T07:00:00.000Z")

  it("adds Nightmare entries at each daily reset, up to 14", () => {
    const saved = setTaskBank(emptyProgress(FAR_FROM_RESET), "nightmare", main, 10, false, FAR_FROM_RESET)
    const grown = rowsForCharacter(main, [main], saved, false, nextReset).find((row) => row.taskId === "nightmare")
    expect(grown?.bank).toBe(12)
    expect(grown?.parts[0].cap).toBe(12)
    expect(grown?.parts[0].owners).toHaveLength(0)
    const later = Date.parse("2026-10-17T07:00:00.000Z")
    const full = rowsForCharacter(main, [main], saved, false, later).find((row) => row.taskId === "nightmare")
    expect(full?.bank).toBe(14)
    expect(full?.urgency).toBe("do-now")
  })

  it("adds Shugo keys at each daily reset and stops at the membership cap", () => {
    const saved = setTaskBank(emptyProgress(FAR_FROM_RESET), "shugo", main, 18, true, FAR_FROM_RESET)
    const row = rowsForCharacter(main, [main], saved, true, nextReset).find((item) => item.taskId === "shugo")
    expect(row?.bank).toBe(21)
    expect(row?.parts[0].cap).toBe(21)
    expect(row?.parts[0].owners).toHaveLength(0)
    expect(row?.timer).toBe("Total entries are full, so the refill is paused.")
  })

  it("spends a banked charge when a box is ticked, and puts it back when cleared", () => {
    let progress = setTaskBank(emptyProgress(FAR_FROM_RESET), "dimension", main, 4, false, FAR_FROM_RESET)
    progress = setTaskCount(progress, "dimension", main, 1, false, FAR_FROM_RESET)
    let row = rowsForCharacter(main, [main], progress, false, FAR_FROM_RESET).find((item) => item.taskId === "dimension")
    expect(row?.bank).toBe(3)
    expect(row?.parts[0].cap).toBe(3)
    progress = setTaskCount(progress, "dimension", main, 0, false, FAR_FROM_RESET)
    row = rowsForCharacter(main, [main], progress, false, FAR_FROM_RESET).find((item) => item.taskId === "dimension")
    expect(row?.bank).toBe(4)
    expect(row?.parts[0].cap).toBe(4)
  })

  it("refuses a tick when the bank is empty", () => {
    const saved = setTaskBank(emptyProgress(FAR_FROM_RESET), "dimension", main, 0, false, FAR_FROM_RESET)
    const spent = setTaskCount(saved, "dimension", main, 1, false, FAR_FROM_RESET)
    const row = rowsForCharacter(main, [main], spent, false, FAR_FROM_RESET).find((item) => item.taskId === "dimension")
    expect(row?.count).toBe(0)
    expect(row?.bank).toBe(0)
  })

  it("adds a Transcendence charge every 12 hours and keeps that clock when one is spent", () => {
    const saved = setTaskBank(emptyProgress(FAR_FROM_RESET), "transcendence", main, 10, false, FAR_FROM_RESET)
    const later = FAR_FROM_RESET + 12 * 60 * 60 * 1000
    expect(rowsForCharacter(main, [main], saved, false, later).find((row) => row.taskId === "transcendence")?.bank).toBe(11)
    const halfway = FAR_FROM_RESET + 6 * 60 * 60 * 1000
    const spent = setTaskCount(saved, "transcendence", main, 1, false, halfway)
    const afterTick = halfway + 6 * 60 * 60 * 1000
    const row = rowsForCharacter(main, [main], spent, false, afterTick).find((item) => item.taskId === "transcendence")
    expect(row?.bank).toBe(10)
    expect(row?.count).toBe(1)
  })

  it("gives Nightmare, Shugo, and Dimension one box per banked entry", () => {
    const nightmare = setTaskBank(emptyProgress(FAR_FROM_RESET), "nightmare", main, 10, false, FAR_FROM_RESET)
    const nightmareRow = rowsForCharacter(main, [main], nightmare, false, FAR_FROM_RESET).find((item) => item.taskId === "nightmare")
    expect(nightmareRow?.parts[0].cap).toBe(10)
    const shugo = setTaskBank(nightmare, "shugo", main, 10, false, FAR_FROM_RESET)
    const shugoRow = rowsForCharacter(main, [main], shugo, false, FAR_FROM_RESET).find((item) => item.taskId === "shugo")
    expect(shugoRow?.parts[0].cap).toBe(10)
    const dimension = rowsForCharacter(main, [main], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET).find((item) => item.taskId === "dimension")
    expect(dimension?.parts[0].cap).toBe(0)
    expect(dimension?.timer).toMatch(/^Next \+1 in /)
    const held = setTaskBank(emptyProgress(FAR_FROM_RESET), "dimension", main, 4, false, FAR_FROM_RESET)
    const heldRow = rowsForCharacter(main, [main], held, false, FAR_FROM_RESET).find((item) => item.taskId === "dimension")
    expect(heldRow?.parts[0].cap).toBe(4)
    expect(heldRow?.timer).toMatch(/^Next \+1 in /)
  })

  it("subtracts one Nightmare entry for each checkmark", () => {
    const saved = setTaskBank(emptyProgress(FAR_FROM_RESET), "nightmare", main, 5, false, FAR_FROM_RESET)
    const spent = setTaskCount(saved, "nightmare", main, 1, false, FAR_FROM_RESET)
    const next = rowsForCharacter(main, [main], spent, false, FAR_FROM_RESET).find((item) => item.taskId === "nightmare")
    expect(next?.bank).toBe(4)
    expect(next?.parts[0].cap).toBe(4)
  })
})

describe("today list", () => {
  it("puts a full bank first and leaves an unset bank off the overflow list", () => {
    const main = character({ id: "main", name: "Nairen", role: "main" })
    const full = setTaskBank(emptyProgress(FAR_FROM_RESET), "nightmare", main, 14, false, FAR_FROM_RESET)
    const items = sessionItems([main], full, false, FAR_FROM_RESET)
    expect(items[0]?.band).toBe("lost")
    expect(items[0]?.title).toContain("Nightmare")
    const unset = sessionItems([main], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
    expect(unset.some((item) => item.band === "lost" && item.title.includes("Nightmare"))).toBe(false)
    expect(unset.some((item) => item.title.includes("Open world Qina"))).toBe(true)
  })

  it("keeps field bosses with the gearing character", () => {
    const main = character({ id: "main", name: "Nairen", role: "main", itemLevel: 1700 })
    const gearing = character({ id: "alt", name: "Clarion", role: "alt", itemLevel: 1000 })
    const items = sessionItems([main, gearing], emptyProgress(TUE_BURN), false, TUE_BURN)
    expect(items.some((item) => item.taskName === "Field bosses" && item.characterId === "alt")).toBe(true)
    expect(items.some((item) => item.taskName === "Field bosses" && item.characterId === "main")).toBe(false)
    expect(items.some((item) => item.taskName.startsWith("Raid"))).toBe(false)
  })
})

describe("goals", () => {
  const main = character({ id: "main", name: "Nairen", role: "main", itemLevel: 1700 })
  const names = (lines: { title: string }[]) => lines.map((line) => line.title)

  it("keeps unfinished dailies on Today and weeklies for later when Wednesday is days away", () => {
    const rows = rowsForCharacter(main, [main], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
    const goals = characterGoals(rows, FAR_FROM_RESET, null)
    expect(names(goals.today)).toContain("Open world Qina")
    expect(names(goals.today)).not.toContain("Ascension Trial")
    expect(names(goals.later)).toContain("Ascension Trial")
    expect(names(goals.later)).toContain("Shop weekly limited items")
    const duty = names(goals.today).indexOf("Duty Missions")
    const qina = names(goals.today).indexOf("Open world Qina")
    expect(duty).toBeGreaterThanOrEqual(0)
    expect(qina).toBeGreaterThan(duty)
  })

  it("moves a weekly onto Today inside two days of Wednesday", () => {
    const rows = rowsForCharacter(main, [main], emptyProgress(TUE_BURN), false, TUE_BURN)
    const goals = characterGoals(rows, TUE_BURN, null)
    expect(names(goals.today)).toContain("Ascension Trial")
  })

  it("hides a token task with an empty bank and keeps one whose bank was never set", () => {
    const emptyBank = setTaskBank(emptyProgress(FAR_FROM_RESET), "nightmare", main, 0, false, FAR_FROM_RESET)
    const hidden = characterGoals(rowsForCharacter(main, [main], emptyBank, false, FAR_FROM_RESET), FAR_FROM_RESET, null)
    expect(names([...hidden.today, ...hidden.later])).not.toContain("Nightmare")
    const unset = characterGoals(rowsForCharacter(main, [main], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET), FAR_FROM_RESET, null)
    expect(names([...unset.today, ...unset.later])).toContain("Nightmare")
  })

  it("puts Odyle on Today when it caps inside 24 hours and leaves it off when the cap is days away", () => {
    const soon = characterGoals([], FAR_FROM_RESET, { full: false, aboveCap: false, fullAt: FAR_FROM_RESET + 24 * 60 * 60 * 1000 })
    expect(names(soon.today)).toContain("Odyle energy")
    const later = characterGoals([], FAR_FROM_RESET, { full: false, aboveCap: false, fullAt: FAR_FROM_RESET + 5 * 24 * 60 * 60 * 1000 })
    expect(names([...later.today, ...later.later])).not.toContain("Odyle energy")
  })
})
