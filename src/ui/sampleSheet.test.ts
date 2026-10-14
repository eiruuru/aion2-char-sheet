import { describe, expect, it } from "vitest"
import type { CharacterRecord } from "../model/store"
import { SAMPLE_ID, charactersForTour, sampleCharacter, sampleProgress } from "./sampleSheet"

describe("tour sample sheet", () => {
  it("fills an empty roster only while the tour is open", () => {
    const saved: CharacterRecord[] = []
    expect(charactersForTour(saved, false)).toEqual([])
    const shown = charactersForTour(saved, true)
    expect(shown).toHaveLength(1)
    expect(shown[0]?.id).toBe(SAMPLE_ID)
    expect(shown[0]?.latest?.gear.length).toBeGreaterThan(0)
    expect(shown[0]?.odyle?.amount).toBe(480)
    expect(saved).toEqual([])
  })

  it("leaves a real roster in place", () => {
    const aria = sampleCharacter()
    const roster = [{ ...aria, id: "as:1501:real", name: "Lunatiq" }]
    expect(charactersForTour(roster, true)).toBe(roster)
  })

  it("keeps example checks on the sample id", () => {
    const progress = sampleProgress()
    expect(progress.counts[`qina|${SAMPLE_ID}`]).toBe(1)
    expect(progress.banks[`nightmare|${SAMPLE_ID}`]).toBe(6)
    expect(JSON.stringify(progress)).not.toContain("aion2-tracker-v1")
  })
})
