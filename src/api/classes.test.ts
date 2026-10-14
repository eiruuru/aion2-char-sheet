import { describe, expect, it } from "vitest"
import { classIconForName, classIconUrl, playClassesFrom } from "./classes"

describe("play classes", () => {
  it("maps a character pc id to the official class name and icon", () => {
    const classes = playClassesFrom([
      { id: 30, className: "CLERIC", classText: "Cleric" },
      { id: 45, className: "Fighter", classText: "Brawler" },
    ])
    expect(classes.get(30)).toEqual({
      name: "Cleric",
      icon: classIconUrl("CLERIC"),
    })
    expect(classes.get(45)?.name).toBe("Brawler")
    expect(classes.get(45)?.icon).toContain("class_icon_fighter.png")
  })

  it("uses the official icon file for classes whose display name differs", () => {
    expect(classIconForName("Cleric")).toContain("class_icon_cleric.png")
    expect(classIconForName("Spiritmaster")).toContain("class_icon_elementalist.png")
    expect(classIconForName("Brawler")).toContain("class_icon_fighter.png")
  })
})
