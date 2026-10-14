import { describe, expect, it } from "vitest"
import {
  emptyProgress,
  rowsForCharacter,
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

  it("keeps gearing content on a character under 1400", () => {
    const rows = rowsForCharacter(gearing, [main, gearing], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
    expect(rows.find((row) => row.taskId === "odyle-cubes")?.name).toBe("Krao Cave cubes")
    expect(rows.some((row) => row.taskId === "krao")).toBe(true)
    expect(rows.some((row) => row.taskId === "field-bosses")).toBe(true)
    expect(rows.some((row) => row.taskId.startsWith("raid-"))).toBe(false)
    expect(rows.some((row) => row.taskId === "growth-graveyard")).toBe(true)
  })

  it("switches a 1400 character to raids and drops the gearing list", () => {
    const rows = rowsForCharacter(ready, [main, ready], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
    expect(rows.some((row) => row.taskId === "raid-ludra")).toBe(true)
    expect(rows.find((row) => row.taskId === "odyle-cubes")?.name).toBe("Conquest cubes")
    expect(rows.some((row) => row.taskId === "krao" || row.taskId === "urugugu" || row.taskId === "field-bosses" || row.taskId === "growth-graveyard")).toBe(false)
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
    expect(member.some((row) => row.taskId === "odyle-buy-server")).toBe(false)
    expect(member.find((row) => row.taskId === "shugo")?.bankCap).toBe(21)
  })

  it("names Krao cubes for a gearing alt and Conquest cubes for the main", () => {
    const alt = rowsForCharacter(gearing, [main, gearing], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
    expect(alt.find((row) => row.taskId === "odyle-cubes")?.name).toBe("Krao Cave cubes")
    const owner = rowsForCharacter(main, [main, gearing], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
    expect(owner.find((row) => row.taskId === "odyle-cubes")?.name).toBe("Conquest cubes")
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

  it("spends Odyle cubes when the pool is near the cap", () => {
    const waiting = rowsForCharacter(main, [main], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
      .find((row) => row.taskId === "odyle-cubes")
    expect(waiting?.urgency).toBe("can-wait")
    const near = character({ ...main, odyleNearCap: true })
    const spending = rowsForCharacter(near, [near], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
      .find((row) => row.taskId === "odyle-cubes")
    expect(spending?.urgency).toBe("do-now")
  })

  it("flags an open daily that does not bank inside 6 hours of reset", () => {
    const early = rowsForCharacter(main, [main], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
      .find((row) => row.taskId === "supply-daily")
    expect(early?.urgency).toBe("steady")
    const late = rowsForCharacter(main, [main], emptyProgress(NEAR_DAILY_RESET), false, NEAR_DAILY_RESET)
      .find((row) => row.taskId === "supply-daily")
    expect(late?.urgency).toBe("do-now")
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
    expect(row?.timer).toBe("Bank is full, so the refill is paused.")
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

  it("adds a Conquest charge every 8 hours and keeps that clock when one is spent", () => {
    const saved = setTaskBank(emptyProgress(FAR_FROM_RESET), "conquest-charges", main, 10, false, FAR_FROM_RESET)
    const later = FAR_FROM_RESET + 8 * 60 * 60 * 1000
    expect(rowsForCharacter(main, [main], saved, false, later).find((row) => row.taskId === "conquest-charges")?.bank).toBe(11)
    const halfway = FAR_FROM_RESET + 4 * 60 * 60 * 1000
    const spent = setTaskCount(saved, "conquest-charges", main, 1, false, halfway)
    const afterTick = halfway + 4 * 60 * 60 * 1000
    const row = rowsForCharacter(main, [main], spent, false, afterTick).find((item) => item.taskId === "conquest-charges")
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
  it("puts overflow first and leaves banked tasks off the list", () => {
    const main = character({ id: "main", name: "Nairen", role: "main", odyleNearCap: true })
    const items = sessionItems([main], emptyProgress(FAR_FROM_RESET), false, FAR_FROM_RESET)
    expect(items[0]?.band).toBe("lost")
    expect(items[0]?.title).toContain("Conquest cubes")
    expect(items.some((item) => item.title.includes("Nightmare"))).toBe(false)
    expect(items.some((item) => item.title.includes("Supply Request"))).toBe(true)
    expect(items.some((item) => item.band === "week")).toBe(false)
  })

  it("keeps Wednesday leftovers as tasks with the character who still needs them", () => {
    const main = character({ id: "main", name: "Nairen", role: "main", itemLevel: 1700 })
    const gearing = character({ id: "alt", name: "Clarion", role: "alt", itemLevel: 1000 })
    const items = sessionItems([main, gearing], emptyProgress(TUE_BURN), false, TUE_BURN)
    const week = items.filter((item) => item.band === "week")
    expect(week.some((item) => item.taskName === "Krao Cave" && item.characterId === "alt")).toBe(true)
    expect(week.some((item) => item.taskName === "Krao Cave" && item.characterId === "main")).toBe(false)
    expect(week.some((item) => item.characterId === "alt" && item.taskName.startsWith("Raid"))).toBe(false)
  })
})
