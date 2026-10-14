import type { CharacterRecord } from "./store"
import type { BoardPoint, ClosedNode, Snapshot } from "./snapshot"
import { compareOdyle, odyleCap, projectOdyle } from "./odyle"
import { formatNumber } from "./format"

export const BOARD_META = [
  { id: 81, name: "Nezekan", unlock: 12 },
  { id: 82, name: "Zikel", unlock: 20 },
  { id: 83, name: "Vaizel", unlock: 30 },
  { id: 84, name: "Triniel", unlock: 40 },
  { id: 86, name: "Azphel", unlock: 45 },
] as const

const WEAPON_ARMOR = ["MainHand", "SubHand", "Helmet", "Shoulder", "Torso", "Pants", "Gloves", "Boots", "Cape"]

export type Suggestion = {
  id: string
  title: string
  detail: string
}

export function boardRank(board: Pick<BoardPoint, "id" | "name">): number {
  const index = BOARD_META.findIndex((meta) => meta.id === board.id || meta.name === board.name)
  return index === -1 ? BOARD_META.length : index
}

export function priorityBoard(snapshot: Snapshot): BoardPoint | null {
  const open = snapshot.boards.filter((board) => board.open && board.totalNodeCount > board.openNodeCount)
  open.sort((a, b) => a.openPercent - b.openPercent || boardRank(a) - boardRank(b))
  return open[0] ?? null
}

export function nextLockedBoard(snapshot: Snapshot): { name: string; unlock: number } | null {
  for (const meta of BOARD_META) {
    const board = snapshot.boards.find((item) => item.id === meta.id || item.name === meta.name)
    if ((!board || !board.open) && snapshot.level < meta.unlock) return { name: meta.name, unlock: meta.unlock }
  }
  return null
}

function cheapest(nodes: ClosedNode[]): ClosedNode | null {
  const priced = nodes.filter((node) => node.cost != null)
  priced.sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0) || a.name.localeCompare(b.name))
  return priced[0] ?? null
}

function daevanionSuggestion(character: CharacterRecord): Suggestion | null {
  const snapshot = character.latest
  if (!snapshot) return null
  const board = priorityBoard(snapshot)
  if (!board) {
    const locked = nextLockedBoard(snapshot)
    if (!locked) return null
    const levels = locked.unlock - snapshot.level
    return {
      id: "daevanion-locked",
      title: `${locked.name} opens at level ${locked.unlock}`,
      detail: `${character.name} is level ${snapshot.level}, ${levels} ${levels === 1 ? "level" : "levels"} away.`,
    }
  }
  const nodes = snapshot.closedNodes.filter((node) => node.boardId === board.id || node.boardName === board.name)
  const skills = nodes.filter((node) => node.type === "SkillLevel")
  const next = cheapest(skills) ?? cheapest(nodes)
  const names = skills
    .map((node) => node.effect || node.name)
    .filter(Boolean)
    .slice(0, 4)
  const skillNote = names.length
    ? `Closed skill nodes include ${names.join(", ")}.`
    : "Closed skill nodes did not load for this board."
  const costNote = next?.cost != null ? ` The next node is about ${next.cost} crystals (${next.effect || next.name}).` : ""
  return {
    id: "daevanion",
    title: `Finish ${board.name} next`,
    detail: `${board.name} is the least complete open board at ${board.openNodeCount}/${board.totalNodeCount}. ${skillNote}${costNote}`.trim(),
  }
}

function gearSuggestion(character: CharacterRecord): Suggestion | null {
  const snapshot = character.latest
  if (!snapshot) return null
  const pieces = snapshot.gear.filter((item) => WEAPON_ARMOR.includes(item.slot))
  if (!pieces.length) return null
  const lowest = Math.min(...pieces.map((item) => item.enchant))
  const target = pieces
    .filter((item) => item.enchant === lowest)
    .sort((a, b) => WEAPON_ARMOR.indexOf(a.slot) - WEAPON_ARMOR.indexOf(b.slot))[0]
  if (!target) return null
  return {
    id: "gear",
    title: `Enchant ${slotLabel(target.slot)} next`,
    detail: `${target.name} is +${target.enchant}, the lowest weapon or armor enchant.`,
  }
}

function skillSuggestion(snapshot: Snapshot): Suggestion | null {
  const active = snapshot.skills.filter((skill) => skill.category === "Active" && skill.acquired)
  if (!active.length) return null
  const highest = Math.max(...active.map((skill) => skill.level))
  const behind = active
    .filter((skill) => skill.level < highest)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  if (!behind.length) return null
  const gap = highest - behind[0].level
  const names = behind.filter((skill) => skill.level === behind[0].level).slice(0, 3).map((skill) => skill.name)
  return {
    id: "skills",
    title: `Raise ${names[0]}`,
    detail: `${names.join(", ")} ${names.length === 1 ? "is" : "are"} ${gap} ${gap === 1 ? "level" : "levels"} behind your highest active skill (${highest}).`,
  }
}

export function altNotes(character: CharacterRecord, roster: CharacterRecord[]): Suggestion[] {
  if (character.role !== "alt" || !character.latest) return []
  const main = roster.find((entry) => entry.role === "main" && entry.latest)
  const notes: Suggestion[] = []
  const locked = nextLockedBoard(character.latest)
  if (locked) {
    const away = locked.unlock - character.latest.level
    if (away > 0 && away <= 2) {
      notes.push({
        id: "alt-unlock",
        title: `${character.name} is close to ${locked.name}`,
        detail: `${locked.name} opens at level ${locked.unlock}. This alt is level ${character.latest.level}.`,
      })
    }
  }
  if (main?.latest) {
    for (const board of character.latest.boards) {
      if (!board.open) continue
      const mainBoard = main.latest.boards.find((item) => item.id === board.id || item.name === board.name)
      if (!mainBoard?.open) continue
      const gap = mainBoard.openPercent - board.openPercent
      if (gap >= 15) {
        notes.push({
          id: `alt-board-${board.id}`,
          title: `${character.name} is behind on ${board.name}`,
          detail: `${board.name} is ${gap} points behind the main (${board.openPercent}% vs ${mainBoard.openPercent}%).`,
        })
        break
      }
    }
  }
  return notes
}

function odyleSuggestion(character: CharacterRecord, membership: boolean, now: number): Suggestion | null {
  if (!character.odyle) return null
  const projection = projectOdyle(character.odyle, odyleCap(membership), now)
  const near = projection.full || projection.aboveCap || projection.ticksUntilFull <= 1
  if (!near) return null
  const place = "Run Conquest Dungeons"
  const lost = projection.lost > 0 ? ` About ${formatNumber(projection.lost)} regen has already been lost.` : ""
  return {
    id: "odyle",
    title: projection.aboveCap ? "Odyle is above the passive cap" : projection.full ? "Odyle is capping" : "Odyle caps within 3 hours",
    detail: `${place} on ${character.name} before regen stops. ${formatNumber(projection.current)} / ${formatNumber(projection.cap)}.${lost}`,
  }
}

export function characterSuggestions(
  character: CharacterRecord,
  roster: CharacterRecord[],
  membership: boolean,
  now = Date.now(),
): Suggestion[] {
  if (!character.latest) {
    return [{
      id: "refresh",
      title: "Refresh this character",
      detail: "The public profile has not loaded yet, so gear and board suggestions are waiting.",
    }]
  }
  return [
    odyleSuggestion(character, membership, now),
    daevanionSuggestion(character),
    gearSuggestion(character),
    skillSuggestion(character.latest),
    ...altNotes(character, roster),
  ].filter((item): item is Suggestion => item != null)
}

export function rosterOrder(characters: CharacterRecord[], membership: boolean, now = Date.now()): CharacterRecord[] {
  const cap = odyleCap(membership)
  return characters.slice().sort((a, b) => {
    if (a.role !== b.role) return a.role === "main" ? -1 : 1
    const byOdyle = compareOdyle(
      a.odyle ? projectOdyle(a.odyle, cap, now) : null,
      b.odyle ? projectOdyle(b.odyle, cap, now) : null,
    )
    if (byOdyle !== 0) return byOdyle
    return a.name.localeCompare(b.name)
  })
}

export function slotLabel(slot: string): string {
  return slot
    .replace(/([A-Z])/g, " $1")
    .replace(/(\d+)/, " $1")
    .trim()
}
