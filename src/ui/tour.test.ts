import { describe, expect, it } from "vitest"
import {
  ONBOARDING_KEY,
  holeRect,
  placeCard,
  clearOnboardingSeen,
  readOnboardingSeen,
  shouldOpenOnboarding,
  visibleSteps,
  writeOnboardingSeen,
  type Rect,
} from "./tour"

const view = { width: 1280, height: 860 }
const card = { width: 300, height: 180 }

function box(top: number, left: number, width: number, height: number): Rect {
  return { top, left, right: left + width, bottom: top + height, width, height }
}

describe("onboarding steps", () => {
  it("keeps the finished flag outside the roster store", () => {
    expect(ONBOARDING_KEY).not.toBe("aion2-tracker-v1")
    const saved = new Map<string, string>()
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => { saved.set(key, value) },
      removeItem: (key: string) => { saved.delete(key) },
    }
    expect(readOnboardingSeen(storage)).toBe(false)
    writeOnboardingSeen(storage)
    expect(saved.get(ONBOARDING_KEY)).toBe("done")
    expect(saved.has("aion2-tracker-v1")).toBe(false)
    expect(readOnboardingSeen(storage)).toBe(true)
    clearOnboardingSeen(storage)
    expect(saved.has(ONBOARDING_KEY)).toBe(false)
    expect(saved.has("aion2-tracker-v1")).toBe(false)
    expect(readOnboardingSeen(storage)).toBe(false)
  })

  it("stays closed when a roster is already saved", () => {
    expect(shouldOpenOnboarding(2, false)).toBe(false)
    expect(shouldOpenOnboarding(0, false)).toBe(true)
    expect(shouldOpenOnboarding(0, true)).toBe(false)
  })

  it("shows the sheet steps when a character is selected", () => {
    const steps = visibleSteps({ hasCharacter: true, desktop: true })
    expect(steps.map((step) => step.id)).toEqual(["welcome", "roster", "tools", "profile", "tasks", "build", "guide", "goals"])
    expect(steps[0]?.target).toBeUndefined()
    expect(steps.find((step) => step.id === "roster")?.body).not.toContain("after someone is added")
    expect(steps.find((step) => step.id === "tools")?.body).toContain("pin")
  })

  it("shows the full sheet for an unsaved example", () => {
    const steps = visibleSteps({ hasCharacter: false, desktop: false, preview: true })
    expect(steps.map((step) => step.id)).toEqual(["welcome", "roster", "tools", "profile", "tasks", "build", "guide", "goals"])
    expect(steps.find((step) => step.id === "roster")?.body).toContain("not saved")
  })

  it("skips the character sheet when the roster is empty", () => {
    const steps = visibleSteps({ hasCharacter: false, desktop: false })
    expect(steps.map((step) => step.id)).toEqual(["welcome", "roster", "tools", "goals"])
    expect(steps.find((step) => step.id === "roster")?.body).toContain("The sheet appears after someone is added.")
    expect(steps.find((step) => step.id === "tools")?.body).not.toContain("pin")
  })
})

describe("onboarding placement", () => {
  it("centers the welcome card", () => {
    expect(placeCard(null, card, view)).toEqual({ top: 340, left: 490 })
  })

  it("sits beside a target and flips to the open side", () => {
    expect(placeCard(box(80, 40, 400, 64), card, view).left).toBe(452)
    expect(placeCard(box(80, 900, 340, 500), card, view).left).toBe(588)
  })

  it("moves above a target that fills the bottom of the window", () => {
    const placed = placeCard(box(700, 40, 1200, 140), card, view)
    expect(placed.top).toBe(508)
    expect(placed.left).toBe(40)
  })

  it("pads the spotlight and keeps it inside the window", () => {
    expect(holeRect(box(20, 10, 100, 40), view)).toEqual({
      top: 14,
      left: 4,
      right: 116,
      bottom: 66,
      width: 112,
      height: 52,
    })
  })
})
