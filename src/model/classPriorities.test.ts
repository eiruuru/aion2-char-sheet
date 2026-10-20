import { describe, expect, it } from "vitest"
import { bossesSituation, classPriorities } from "./classPriorities"

const CLASSES = ["Gladiator", "Templar", "Assassin", "Ranger", "Chanter", "Cleric", "Sorcerer", "Spiritmaster"]

describe("class priorities", () => {
  it("has a PvE bosses plan with core skills and an S-tier skill for every class", () => {
    for (const name of CLASSES) {
      const list = classPriorities(name)
      expect(list, name).toBeTruthy()
      const bosses = bossesSituation(list ?? [])
      expect(bosses?.core.length, name).toBeGreaterThan(0)
      expect(bosses?.skills.some((skill) => skill.tier === "S"), name).toBe(true)
    }
  })

  it("matches a class name without caring about case", () => {
    expect(classPriorities("cleric")?.[0]?.situation).toBe("bosses")
    expect(classPriorities("Elementalist")?.[0]?.core.length).toBeGreaterThan(0)
    expect(classPriorities("")).toBeNull()
  })
})
