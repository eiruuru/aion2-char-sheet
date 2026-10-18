import type { CharacterRecord } from "./store"
import type { BoardPoint } from "./snapshot"
import { compareOdyle, odyleCap, projectOdyle } from "./odyle"

export const BOARD_META = [
  { id: 81, name: "Nezekan", unlock: 12 },
  { id: 82, name: "Zikel", unlock: 20 },
  { id: 83, name: "Vaizel", unlock: 30 },
  { id: 84, name: "Triniel", unlock: 40 },
  { id: 86, name: "Azphel", unlock: 45 },
] as const

export function boardRank(board: Pick<BoardPoint, "id" | "name">): number {
  const index = BOARD_META.findIndex((meta) => meta.id === board.id || meta.name === board.name)
  return index === -1 ? BOARD_META.length : index
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
