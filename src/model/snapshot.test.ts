import { describe, expect, it } from "vitest"
import type { CharacterInfo, EquipmentResponse } from "../api/types"
import { buildSnapshot, historySnapshot, portraitUrl } from "./snapshot"

function info(profileImage: string, boardIcon = ""): CharacterInfo {
  return {
    profile: {
      characterId: "abc",
      characterLevel: 45,
      characterName: "Nairen",
      className: "Chanter",
      combatPower: 1000,
      genderName: "",
      pcId: 1,
      profileImage,
      raceId: 1,
      raceName: "Elyos",
      serverId: 1101,
      serverName: "Siel",
      titleName: "",
    },
    stat: { statList: [{ type: "ItemLevel", name: "Item level", value: 1700, statSecondList: null }] },
    title: { ownedCount: 1, totalCount: 10 },
    daevanion: {
      boardList: [{
        id: 81,
        name: "Nezekan",
        icon: boardIcon,
        open: 1,
        openNodeCount: 1,
        openPercent: 1,
        totalNodeCount: 88,
      }],
    },
  }
}

function equipment(icon: string): EquipmentResponse {
  return {
    equipment: {
      equipmentList: [{
        enchantLevel: 4,
        exceedLevel: 0,
        grade: "Unique",
        icon,
        id: 1,
        name: "Staff",
        slotPos: 1,
        slotPosName: "MainHand",
      }],
      skinList: [],
    },
    skill: {
      skillList: [{
        acquired: 1,
        category: "Active",
        equip: 1,
        icon,
        id: 2,
        name: "Onslaught",
        needLevel: 1,
        skillLevel: 10,
      }],
    },
    petwing: { pet: null, wing: null },
  }
}

describe("snapshot icons", () => {
  it("keeps gear, skill, board, and portrait URLs", () => {
    const icon = "https://assets.playnccdn.com/static-aion2-gamedata/resources/ICON_RA_SKILL_001.png"
    const snapshot = buildSnapshot(info("https://profileimg.plaync.com/portrait", icon), equipment(icon), [])
    expect(snapshot.portrait).toBe("https://profileimg.plaync.com/portrait")
    expect(snapshot.gear[0].icon).toBe(icon)
    expect(snapshot.gear[0].id).toBe(1)
    expect(snapshot.gear[0].slotPos).toBe(1)
    expect(snapshot.skills[0].icon).toBe(icon)
    expect(snapshot.boards[0].icon).toBe(icon)
  })

  it("builds when the profile has no icons", () => {
    const snapshot = buildSnapshot(info(""), equipment(""), [])
    expect(snapshot.portrait).toBeUndefined()
    expect(snapshot.gear[0].icon).toBeUndefined()
    expect(snapshot.skills[0].icon).toBeUndefined()
    expect(snapshot.boards[0].icon).toBeUndefined()
    expect(snapshot.gear[0].name).toBe("Staff")
  })

  it("maps companions, cosmetics, equipped skills, and board nodes", () => {
    const icon = "https://assets.playnccdn.com/static-aion2-gamedata/resources/ICON_RA_SKILL_001.png"
    const loaded = equipment(icon)
    loaded.equipment.skinList = [{
      ...loaded.equipment.equipmentList[0],
      name: "Star Prophet (Boots)",
      slotPosName: "Boots",
      enchantLevel: 0,
    }]
    loaded.petwing = {
      pet: { name: "Swift Lugi", level: 3, icon: "https://assets.example/pet.png" },
      wing: { name: "Dark Veil Wings", grade: "Unique", icon: "https://assets.example/wing.png" },
      wingSkin: { name: "Dark Veil Wings", grade: "Unique", icon: "https://assets.example/wing.png" },
    }
    loaded.skill.skillList[0].equip = 1
    loaded.skill.skillList[0].needLevel = 22
    const snapshot = buildSnapshot(info(""), loaded, [{
      boardId: 81,
      boardName: "Nezekan",
      detail: {
        nodeList: [
          { boardId: 81, nodeId: 1, name: "", open: 0, type: "None", grade: "None", effectList: [], row: 1, col: 1 },
          { boardId: 81, nodeId: 2, name: "Max MP", open: 1, type: "Stat", grade: "Common", effectList: [{ desc: "MP +50" }], row: 2, col: 3 },
        ],
        openSkillEffectList: [{ desc: "Bolt +1" }],
        openStatEffectList: [{ desc: "HP +1000" }],
      },
    }])
    expect(snapshot.pet).toMatchObject({ name: "Swift Lugi", level: 3 })
    expect(snapshot.wing?.name).toBe("Dark Veil Wings")
    expect(snapshot.wingSkin).toBeUndefined()
    expect(snapshot.skins?.[0]).toMatchObject({ name: "Star Prophet (Boots)", slot: "Boots" })
    expect(snapshot.skills[0]).toMatchObject({ equipped: true, needLevel: 22 })
    expect(snapshot.boards[0].nodes).toEqual([
      { row: 2, col: 3, open: true, type: "Stat", grade: "Common", name: "Max MP", effect: "MP +50" },
    ])
    expect(snapshot.effects).toEqual([
      { boardId: 81, boardName: "Nezekan", kind: "skill", desc: "Bolt +1" },
      { boardId: 81, boardName: "Nezekan", kind: "stat", desc: "HP +1000" },
    ])
    expect(historySnapshot(snapshot).boards[0].nodes).toBeUndefined()
    expect(snapshot.boards[0].nodes).toHaveLength(1)
  })

  it("prefixes a relative portrait path", () => {
    expect(portraitUrl("/game_profile_images/aion2global/images?charKey=1")).toBe(
      "https://profileimg.plaync.com/game_profile_images/aion2global/images?charKey=1",
    )
  })
})
