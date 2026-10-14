import { emptyProgress, type ChecklistProgress } from "../model/checklist"
import type { CharacterRecord } from "../model/store"
import type { BoardNodePoint, GearPoint, Snapshot } from "../model/snapshot"

export const SAMPLE_ID = "sample:preview"

const PORTRAIT = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a2c16"/><stop offset="1" stop-color="#120c08"/></linearGradient></defs><rect width="128" height="128" fill="url(#g)"/><circle cx="64" cy="46" r="18" fill="#e7c8a2"/><path d="M30 118c4-32 18-46 34-46s30 14 34 46" fill="#c45c12"/><path d="M46 44c4-10 32-10 36 0" fill="none" stroke="#1a0c04" stroke-width="3"/></svg>`)}`

export function charactersForTour(characters: CharacterRecord[], touring: boolean): CharacterRecord[] {
  if (!touring || characters.length > 0) return characters
  return [sampleCharacter()]
}

export function sampleCharacter(now = Date.now()): CharacterRecord {
  const latest = sampleSnapshot(now)
  return {
    id: SAMPLE_ID,
    characterId: "preview",
    serverId: 1501,
    serverName: "Siel",
    region: "as",
    name: "Aria",
    className: "Cleric",
    raceName: "Elyos",
    role: "main",
    addedAt: new Date(now).toISOString(),
    odyle: { amount: 480, readAt: new Date(now).toISOString() },
    resources: { crystals: null, kinah: null, abyss: null },
    latest,
    history: [86000, 87200, 86420].map((combatPower, index) => ({
      ...latest,
      at: new Date(now - (3 - index) * 24 * 60 * 60 * 1000).toISOString(),
      combatPower,
      boards: latest.boards.map(({ nodes: _nodes, ...board }) => board),
    })),
  }
}

export function sampleProgress(now = Date.now()): ChecklistProgress {
  const progress = emptyProgress(now)
  const server = "as:1501"
  progress.counts[`qina|${SAMPLE_ID}`] = 1
  progress.counts[`duty|${server}`] = 2
  progress.marks[`duty|${server}`] = [SAMPLE_ID, SAMPLE_ID]
  progress.banks[`nightmare|${SAMPLE_ID}`] = 6
  progress.stamps[`nightmare|${SAMPLE_ID}`] = new Date(now).toISOString()
  return progress
}

function sampleSnapshot(now: number): Snapshot {
  const gear: GearPoint[] = [
    piece("MainHand", "Aulamus Mace", 15, "Unique", 1),
    piece("SubHand", "Vakron Guard", 10, "Legend", 2),
    piece("Torso", "Nuakum Breastplate", 10, "Unique", 3),
    piece("Pants", "Nuakum Greaves", 10, "Unique", 4),
    piece("Helmet", "Nuakum Helm", 10, "Legend", 5),
    piece("Shoulder", "Nuakum Pauldrons", 9, "Legend", 6),
    piece("Gloves", "Nuakum Gloves", 10, "Unique", 7),
    piece("Boots", "Nuakum Boots", 8, "Legend", 8),
    piece("Cape", "Nuakum Cloak", 10, "Epic", 9),
    piece("Belt", "Noble Belt", 7, "Rare", 10),
    piece("Necklace", "Aulamus Necklace", 10, "Unique", 11),
    piece("Ring1", "Gartua Ring", 10, "Legend", 12),
    piece("Ring2", "Aulamus Ring", 6, "Rare", 13),
    piece("Arcana1", "Chalice of Vigor", 1, "Epic", 14),
    piece("Arcana2", "Parchment of Magic", 0, "Legend", 15),
  ]
  const nodes = sampleNodes()
  const openCount = nodes.filter((node) => node.open).length
  return {
    at: new Date(now).toISOString(),
    level: 45,
    className: "Cleric",
    raceName: "Elyos",
    combatPower: 86420,
    itemLevel: 2140,
    titleName: "Dawn",
    titlesOwned: 48,
    titlesTotal: 297,
    portrait: PORTRAIT,
    pet: { name: "Swift Lupa", level: 3 },
    wing: { name: "Dark Veil", grade: "Unique" },
    boards: [{
      id: 82,
      name: "Zikel",
      open: true,
      openNodeCount: openCount,
      totalNodeCount: nodes.length,
      openPercent: Math.round((openCount / nodes.length) * 100),
      nodes,
    }],
    effects: [
      { boardId: 82, boardName: "Zikel", kind: "skill", desc: "Healing Hand +1" },
      { boardId: 82, boardName: "Zikel", kind: "skill", desc: "Bolt +1" },
      { boardId: 82, boardName: "Zikel", kind: "stat", desc: "Attack 120" },
      { boardId: 82, boardName: "Zikel", kind: "stat", desc: "HP 800" },
    ],
    gear,
    skins: [piece("Cape", "Festival Cloak", 0, "Special", 20)],
    skills: [
      { name: "Bolt", category: "Active", level: 15, acquired: true, equipped: true, needLevel: 14 },
      { name: "Healing Hand", category: "Active", level: 12, acquired: true, equipped: true, needLevel: 10 },
      { name: "Smite", category: "Active", level: 8, acquired: true, equipped: false, needLevel: 1 },
      { name: "Blessing", category: "Dp", level: 4, acquired: true, equipped: true, needLevel: 20 },
      { name: "Cleanse", category: "Dp", level: 1, acquired: true, equipped: false, needLevel: 16 },
    ],
    closedNodes: [{
      boardId: 82,
      boardName: "Zikel",
      name: "Skill node",
      effect: "Healing Hand",
      grade: "Rare",
      type: "SkillLevel",
      cost: 40,
    }],
  }
}

function piece(slot: string, name: string, enchant: number, grade: string, slotPos: number): GearPoint {
  return { slot, name, enchant, grade, id: 9000 + slotPos, slotPos }
}

function sampleNodes(): BoardNodePoint[] {
  const nodes: BoardNodePoint[] = []
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const open = row < 2 || col < 2
      nodes.push({
        row,
        col,
        open,
        type: open ? "Stat" : "SkillLevel",
        grade: open ? "Rare" : "Legend",
        name: open ? "Stat" : "Skill",
        effect: open ? "Attack" : "Healing Hand",
      })
    }
  }
  return nodes
}
