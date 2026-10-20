import data from "./classPriorities.json"
import localIcons from "./guideIconManifest.json"

export type PriorityMode = "pve" | "pvp" | "mass"
export type SkillSlot = "active" | "passive" | "stigma"
export type SkillTier = "S" | "A" | "B" | "C" | "?"

export type ClassSkill = {
  name: string
  slot: SkillSlot
  tier: SkillTier
  why: string
  icon?: string
  detail?: string
  description?: string
  training?: string
}

export type GuideRow = {
  title: string
  tier: SkillTier
  why: string
  detail?: string
  slot?: string
  icon?: string
  description?: string
}

export type GuideMacro = {
  title: string
  chain: string
}

export type GuideTip = {
  title: string
  action: string
  condition: string
}

export type ClassSituation = {
  mode: PriorityMode
  situation: string
  role: string
  core: string[]
  stigmas: string[]
  steps: string
  swaps: string
  risks: string
  tip: string
  stats: string[]
  skills: ClassSkill[]
  arcana?: GuideRow[]
  pantheon?: GuideRow[]
  equipment?: GuideRow[]
  statRows?: GuideRow[]
  shops?: GuideRow[]
  progression?: GuideRow[]
  daevanion?: GuideRow[]
  pets?: GuideRow[]
  species?: GuideRow[]
  macros?: GuideMacro[]
  tips?: GuideTip[]
}

export const PRIORITY_SOURCE = "Priorities adapted from aion2-guide.com."

export const GUIDE_ICON = "/guide-icons/"
export const GUIDE_ICON_REMOTE = "https://aion2-guide.com/assets/icons/"
export const VAULT_SOURCE = "Skills, stigmas, macros, and combat tips adapted from aion2vault.com."

const localIconNames = new Set(localIcons)

export function guideIconSrc(file: string): string {
  if (!file) return ""
  return localIconNames.has(file) ? `${GUIDE_ICON}${file}` : `${GUIDE_ICON_REMOTE}${file}`
}

export const MODE_LABELS: { id: PriorityMode; label: string }[] = [
  { id: "pve", label: "PvE" },
  { id: "pvp", label: "PvP" },
  { id: "mass", label: "Mass PvP" },
]

export const SITUATION_LABELS: Record<string, string> = {
  bosses: "Bosses / group",
  farm: "Farm / open area",
  early: "Early growth",
  ulfhednar: "Group damage · Ulfhednar",
  small: "Solo / small group",
  burst: "Aggressive window",
  group: "Group fight",
  backline: "Backline cover",
  "group-damage": "Group damage",
  nobs: "Block and buffs · NoBS",
  "small-control": "Small-group control",
  initiator: "Group initiator",
  "vault-sustain": "Survivability · Vault",
  j0ei: "j0ei · via Vault",
  flank: "Finishing from the flank",
  freshy: "FRESHY cycle",
  "anti-dive": "Against a dive",
  "one-target": "Group's single target",
  heal: "Healing / support",
  "block-talk": "Block · player notes",
  focused: "Under focus",
  "cover-pressure": "Pressure while covering",
  ulvier: "Condemnation · Ulvier",
  "small-support": "Small-group support",
  "no-res": "Support without resurrection",
  hellfire: "Hellfire · EUTOPIA",
  "control-out": "Control and escape",
  lane: "Holding a lane",
  "init-rb": "Destructive Attack · init.rb",
  "anti-magic": "Against magic pressure",
  "survive-focus": "Surviving focus",
}

export const SLOT_LABELS: Record<SkillSlot, string> = {
  active: "Active",
  passive: "Passive",
  stigma: "Stigma",
}

const ALIASES: Record<string, string> = {
  elementalist: "Spiritmaster",
}

const classes = data.classes as Record<string, ClassSituation[]>

export function situationLabel(id: string): string {
  return SITUATION_LABELS[id] ?? id
}

export function classPriorities(className: string): ClassSituation[] | null {
  const trimmed = className.trim()
  if (!trimmed) return null
  const alias = ALIASES[trimmed.toLowerCase()]
  const match = Object.keys(classes).find((name) => name.toLowerCase() === (alias ?? trimmed).toLowerCase())
  return match ? classes[match] : null
}

export function bossesSituation(list: ClassSituation[]): ClassSituation | null {
  return list.find((entry) => entry.mode === "pve" && entry.situation === "bosses") ?? null
}
