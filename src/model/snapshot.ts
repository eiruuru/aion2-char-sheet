import type { CharacterInfo, DaevanionDetail, EquipmentItem, EquipmentResponse, PetSummary, WingSummary } from "../api/types"
import { estimateNodeCost } from "./costs"

const PORTRAIT_HOST = "https://profileimg.plaync.com"

export function portraitUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null
  if (value.startsWith("/")) return `${PORTRAIT_HOST}${value}`
  if (value.startsWith("https://") || value.startsWith("http://")) return value
  return null
}

function keptIcon(icon: string | undefined): string | undefined {
  const value = icon?.trim()
  return value ? value : undefined
}

export type GearPoint = {
  slot: string
  name: string
  enchant: number
  exceed?: number
  grade: string
  icon?: string
}

export type SkillPoint = {
  name: string
  category: string
  level: number
  acquired: boolean
  equipped?: boolean
  needLevel?: number
  icon?: string
}

export type CompanionPoint = {
  name: string
  icon?: string
  level?: number
  grade?: string
  enchant?: number
}

export type BoardNodePoint = {
  row: number
  col: number
  open: boolean
  type: string
  grade: string
  name: string
  effect: string
}

export type BoardEffect = {
  boardId: number
  boardName: string
  kind: "skill" | "stat"
  desc: string
}

export type BoardPoint = {
  id: number
  name: string
  open: boolean
  openNodeCount: number
  totalNodeCount: number
  openPercent: number
  icon?: string
  nodes?: BoardNodePoint[]
}

export type ClosedNode = {
  boardId: number
  boardName: string
  name: string
  effect: string
  grade: string
  type: string
  cost: number | null
}

export type Snapshot = {
  at: string
  level: number
  className: string
  raceName: string
  combatPower: number
  itemLevel: number | null
  titleName: string
  titlesOwned: number
  titlesTotal: number
  portrait?: string
  pet?: CompanionPoint
  wing?: CompanionPoint
  wingSkin?: CompanionPoint
  boards: BoardPoint[]
  effects?: BoardEffect[]
  gear: GearPoint[]
  skins?: GearPoint[]
  skills: SkillPoint[]
  closedNodes: ClosedNode[]
}

function effectText(effectList: { desc: string }[] | null | undefined): string {
  return effectList?.map((item) => item.desc).filter(Boolean).join(", ") ?? ""
}

function mapGear(item: EquipmentItem): GearPoint {
  return {
    slot: item.slotPosName,
    name: item.name,
    enchant: item.enchantLevel,
    exceed: item.exceedLevel,
    grade: item.grade,
    icon: keptIcon(item.icon),
  }
}

function mapPet(pet: PetSummary | null | undefined): CompanionPoint | undefined {
  if (!pet?.name) return undefined
  return { name: pet.name, icon: keptIcon(pet.icon), level: pet.level }
}

function mapWing(wing: WingSummary | null | undefined): CompanionPoint | undefined {
  if (!wing?.name) return undefined
  return {
    name: wing.name,
    icon: keptIcon(wing.icon),
    grade: wing.grade,
    enchant: wing.enchantLevel,
  }
}

function mapNodes(detail: DaevanionDetail | null | undefined): BoardNodePoint[] | undefined {
  if (!detail?.nodeList) return undefined
  const nodes: BoardNodePoint[] = []
  for (const node of detail.nodeList) {
    if (node.type === "None") continue
    if (typeof node.row !== "number" || typeof node.col !== "number") continue
    nodes.push({
      row: node.row,
      col: node.col,
      open: node.open === 1,
      type: node.type,
      grade: node.grade,
      name: node.name,
      effect: effectText(node.effectList),
    })
  }
  return nodes
}

export function historySnapshot(snapshot: Snapshot): Snapshot {
  if (!snapshot.boards.some((board) => board.nodes?.length)) return snapshot
  return {
    ...snapshot,
    boards: snapshot.boards.map((board) => (
      board.nodes
        ? {
            id: board.id,
            name: board.name,
            open: board.open,
            openNodeCount: board.openNodeCount,
            totalNodeCount: board.totalNodeCount,
            openPercent: board.openPercent,
            icon: board.icon,
          }
        : board
    )),
  }
}

export function buildSnapshot(
  info: CharacterInfo,
  equipment: EquipmentResponse,
  details: { boardId: number; boardName: string; detail: DaevanionDetail | null }[],
  at = new Date().toISOString(),
): Snapshot {
  const itemStat = info.stat.statList.find((stat) => stat.type === "ItemLevel")
  const closedNodes: ClosedNode[] = []
  const effects: BoardEffect[] = []
  const detailById = new Map(details.map((entry) => [entry.boardId, entry.detail]))
  for (const entry of details) {
    if (!entry.detail) continue
    for (const node of entry.detail.nodeList) {
      if (node.open !== 0) continue
      if (node.type !== "SkillLevel" && node.type !== "Stat") continue
      if (!node.name) continue
      closedNodes.push({
        boardId: entry.boardId,
        boardName: entry.boardName,
        name: node.name,
        effect: effectText(node.effectList),
        grade: node.grade,
        type: node.type,
        cost: estimateNodeCost(node.type, node.grade),
      })
    }
    for (const item of entry.detail.openSkillEffectList ?? []) {
      if (item?.desc) effects.push({ boardId: entry.boardId, boardName: entry.boardName, kind: "skill", desc: item.desc })
    }
    for (const item of entry.detail.openStatEffectList ?? []) {
      if (item?.desc) effects.push({ boardId: entry.boardId, boardName: entry.boardName, kind: "stat", desc: item.desc })
    }
  }

  const wing = mapWing(equipment.petwing?.wing)
  const wingSkin = mapWing(equipment.petwing?.wingSkin)

  return {
    at,
    level: info.profile.characterLevel,
    className: info.profile.className,
    raceName: info.profile.raceName,
    combatPower: info.profile.combatPower,
    itemLevel: itemStat ? itemStat.value : null,
    titleName: info.profile.titleName,
    titlesOwned: info.title.ownedCount ?? 0,
    titlesTotal: info.title.totalCount ?? 0,
    portrait: portraitUrl(info.profile.profileImage) ?? undefined,
    pet: mapPet(equipment.petwing?.pet),
    wing,
    wingSkin: wingSkin && wingSkin.name !== wing?.name ? wingSkin : undefined,
    boards: info.daevanion.boardList.map((board) => ({
      id: board.id,
      name: board.name,
      open: board.open === 1,
      openNodeCount: board.openNodeCount,
      totalNodeCount: board.totalNodeCount,
      openPercent: board.openPercent,
      icon: keptIcon(board.icon),
      nodes: detailById.has(board.id) ? mapNodes(detailById.get(board.id)) : undefined,
    })),
    effects,
    gear: equipment.equipment.equipmentList.map(mapGear),
    skins: (equipment.equipment.skinList ?? []).map(mapGear),
    skills: equipment.skill.skillList.map((skill) => ({
      name: skill.name,
      category: skill.category,
      level: skill.skillLevel,
      acquired: skill.acquired === 1,
      equipped: skill.equip === 1,
      needLevel: skill.needLevel,
      icon: keptIcon(skill.icon),
    })),
    closedNodes,
  }
}
