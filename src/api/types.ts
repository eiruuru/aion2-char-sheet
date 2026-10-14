export type RegionId = "nae" | "naw" | "eu" | "as" | "la"

export const REGIONS: { id: RegionId; label: string }[] = [
  { id: "nae", label: "NA East" },
  { id: "naw", label: "NA West" },
  { id: "eu", label: "Europe" },
  { id: "as", label: "Asia" },
  { id: "la", label: "Latin America" },
]

export type SearchHit = {
  characterId: string
  name: string
  race: number
  pcId: number
  level: number
  serverId: number
  serverName: string
  profileImageUrl: string
  region: string
}

export type CharacterProfile = {
  characterId: string
  characterLevel: number
  characterName: string
  className: string
  combatPower: number
  genderName: string
  pcId: number
  profileImage: string
  raceId: number
  raceName: string
  serverId: number
  serverName: string
  titleName: string
}

export type StatEntry = {
  type: string
  name: string
  value: number
  statSecondList: string[] | null
}

export type DaevanionBoard = {
  id: number
  name: string
  icon?: string
  open: number
  openNodeCount: number
  openPercent: number
  totalNodeCount: number
}

export type CharacterInfo = {
  profile: CharacterProfile
  stat: { statList: StatEntry[] }
  title: { ownedCount: number | null; totalCount: number | null }
  daevanion: { boardList: DaevanionBoard[] }
}

export type EquipmentItem = {
  enchantLevel: number
  exceedLevel: number
  grade: string
  icon: string
  id: number
  name: string
  slotPos: number
  slotPosName: string
}

export type ItemStatLine = {
  id?: string
  name?: string
  value?: string
  extra?: string
  exceed?: boolean
}

export type ItemStone = {
  id?: string
  icon?: string
  name?: string
  value?: string
  grade?: string
  desc?: string
  slotPos?: number
}

export type ItemSkillLine = {
  id?: number
  name?: string
  icon?: string
  level?: number
}

export type ItemSetBonus = {
  degree?: number
  descriptions?: string[]
}

export type EquipmentItemDetail = {
  id: number
  name: string
  grade: string
  gradeName?: string
  icon?: string
  level?: number
  enchantLevel?: number
  categoryName?: string
  classNames?: string[]
  equipLevel?: number
  magicStoneSlotCount?: number
  godStoneSlotCount?: number
  subStatCount?: number
  subSkillCountMax?: number
  mainStats?: ItemStatLine[]
  subStats?: ItemStatLine[]
  subSkills?: ItemSkillLine[]
  magicStoneStat?: ItemStone[]
  godStoneStat?: ItemStone[]
  soulBindRate?: string
  sources?: string[]
  tradable?: boolean
  tradablePersonal?: boolean
  storable?: boolean
  maxExceedEnchantLevel?: number
  set?: {
    name?: string
    equippedCount?: number
    items?: unknown[]
    bonuses?: ItemSetBonus[]
  }
}

export type PetSummary = {
  name?: string
  icon?: string
  id?: number
  level?: number
}

export type WingSummary = {
  name?: string
  icon?: string
  id?: number
  grade?: string
  enchantLevel?: number
}

export type SkillEntry = {
  acquired: number
  category: string
  equip: number
  icon: string
  id: number
  name: string
  needLevel: number
  skillLevel: number
}

export type EquipmentResponse = {
  equipment: { equipmentList: EquipmentItem[]; skinList: EquipmentItem[] }
  skill: { skillList: SkillEntry[] }
  petwing: {
    pet: PetSummary | null
    wing: WingSummary | null
    wingSkin?: WingSummary | null
  }
}

export type DaevanionNode = {
  boardId: number
  nodeId: number
  name: string
  open: number
  type: string
  grade: string
  effectList: { desc: string }[] | null
  row?: number
  col?: number
  icon?: string
}

export type DaevanionDetail = {
  nodeList: DaevanionNode[]
  openSkillEffectList: { desc: string }[]
  openStatEffectList: { desc: string }[]
}
