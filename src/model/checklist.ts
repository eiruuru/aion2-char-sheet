import { formatCountdown, formatDuration } from "./format"
import { upcomingBosses, dailyKey, inWeeklyBurnWindow, manilaReset, nextDailyReset, nextWeeklyReset, weeklyKey } from "./schedule"

export const HALLOWEEN_END = manilaReset(2026, 10, 4)
export const RIFT_STONE_END = manilaReset(2026, 9, 28)

const NEAR_RESET_MS = 6 * 60 * 60 * 1000
export const BOSS_SOON_MS = 2 * 60 * 60 * 1000
const GEAR_GATE = 1400
const ABYSS_GATE = 1000
const TRANSCENDENCE_GATE = 1600

export type Cadence = "daily" | "weekly" | "season"
export type TaskTag = "core" | "optional"
export type Priority = "critical" | "high" | "medium" | "low"

export const PRIORITY_RANK: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}
export type Urgency = "do-now" | "can-wait" | "before-wednesday" | "steady" | "done"
export type Assign =
  | "everyone"
  | "main"
  | "main-il-1600"
  | "field-bosses"
  | "raids"
  | "membership"
  | "alt-only"
  | "alt-first"

const CLIENT_ICON = "https://cdn-hosted.gaming.tools/aion2/images/ui/resource/texture/icon"
const DUNGEON_ICON = `${CLIENT_ICON}/ut_marker_dungeon.webp`
const MISSION_ICON = `${CLIENT_ICON}/ut_marker_mission.webp`
const SHOP_ICON = `${CLIENT_ICON}/ut_marker_shop.webp`
const RIFT_ICON = `${CLIENT_ICON}/ut_marker_rift.webp`
const BATTLE_ICON = `${CLIENT_ICON}/ut_marker_battlefield.webp`
const EXPLORE_ICON = `${CLIENT_ICON}/ut_marker_exploration_seal.webp`

type TaskDef = {
  id: string
  name: string
  cadence: Cadence
  scope: "character" | "server"
  tag: TaskTag
  priority: Priority
  /** Shown as a reminder, with no boxes to check. */
  note?: boolean
  notes: string
  cap: number
  memberCap?: number
  bank: number | null
  memberBank?: number
  refillMs: number | null
  accrue?: number
  stockBoxes?: boolean
  /** Season tasks clear with the weekly reset unless this is "event". */
  resets?: "weekly" | "event"
  /** Hidden at this Manila maintenance. Saved marks stay in the file. */
  endsAt?: number
  assign: Assign
  icon?: string
}

const TASK_INPUT: Array<Omit<TaskDef, "priority"> & { priority?: Priority }> = [
  { id: "transcendence", name: "Transcendence", cadence: "daily", scope: "character", tag: "core", priority: "critical", cap: 1, bank: 14, refillMs: 12 * 60 * 60 * 1000, assign: "main-il-1600", notes: "One charge every 12 hours, holds 14. Main only, from gear score 1,600." },
  { id: "conquest", name: "Conquest Dungeons", cadence: "daily", scope: "character", tag: "core", priority: "critical", note: true, cap: 0, bank: null, refillMs: null, assign: "everyone", icon: DUNGEON_ICON, notes: "Run while Odyle remains. No daily clear." },
  { id: "nightmare", name: "Nightmare", cadence: "daily", scope: "character", tag: "core", priority: "high", cap: 2, bank: 14, refillMs: null, accrue: 2, stockBoxes: true, assign: "everyone", icon: DUNGEON_ICON, notes: "2 a day, holds 14. Spent only on a clear." },
  { id: "duty", name: "Duty Missions", cadence: "daily", scope: "server", tag: "core", priority: "high", cap: 5, bank: null, refillMs: null, assign: "main", icon: MISSION_ICON, notes: "5 payouts a day for the server. Shared by every character on that server." },
  { id: "field-bosses", name: "Field bosses", cadence: "daily", scope: "server", tag: "core", priority: "high", cap: 4, bank: null, refillMs: null, assign: "field-bosses", icon: EXPLORE_ICON, notes: "In order: Gartua, Lagta, Kashapa, Dartan. The lowest character under gear score 1,400 takes them." },
  { id: "shugo", name: "Shugo Festival", cadence: "daily", scope: "server", tag: "core", priority: "medium", cap: 3, bank: 12, memberBank: 21, refillMs: null, accrue: 3, stockBoxes: true, assign: "main", icon: SHOP_ICON, notes: "3 a day, shared. Holds 12, or 21 with membership." },
  { id: "dimension", name: "Dimensional Invasion", cadence: "daily", scope: "server", tag: "core", priority: "medium", cap: 1, bank: 7, refillMs: null, accrue: 1, stockBoxes: true, assign: "main", icon: DUNGEON_ICON, notes: "1 a day, holds 7. Shared by the server." },
  { id: "abyss-day", name: "Abyss Farming", cadence: "daily", scope: "character", tag: "core", priority: "medium", cap: 1, bank: null, refillMs: null, assign: "main", icon: EXPLORE_ICON, notes: "At least an hour in the Abyss." },
  { id: "rift", name: "Spacetime Rift", cadence: "daily", scope: "character", tag: "core", priority: "low", cap: 1, bank: null, refillMs: 3 * 60 * 60 * 1000, assign: "everyone", icon: RIFT_ICON, notes: "Verteron, Eltnen, Altgard, or Morheim. About a 3 hour cycle." },
  { id: "fissure-day", name: "Daily Dungeon", cadence: "daily", scope: "server", tag: "core", priority: "low", cap: 2, bank: null, refillMs: null, assign: "main", icon: DUNGEON_ICON, notes: "Unknown Fissure. 14 entries for the server this week. Instant clear tickets are in Substance Morph during the server transfer." },
  { id: "qina", name: "Open world Qina", cadence: "daily", scope: "character", tag: "core", priority: "low", cap: 1, bank: null, refillMs: null, assign: "everyone", icon: EXPLORE_ICON, notes: "1 million Qina. Mark 1 when that character is capped." },
  { id: "daeva-pass", name: "Pass EXP", cadence: "weekly", scope: "character", tag: "core", priority: "critical", cap: 1, bank: null, refillMs: null, assign: "everyone", icon: MISSION_ICON, notes: "Season cap 50,000 pass EXP. Mark 1 when capped. Main first." },
  { id: "season", name: "Season missions", cadence: "weekly", scope: "character", tag: "core", priority: "critical", cap: 1, bank: null, refillMs: null, assign: "everyone", icon: MISSION_ICON, notes: "Pays at the weekly reset. Spending 1 hour in the Abyss and defeating Nahma once also award Abyss Entry Stones." },
  { id: "odyle-craft-char", name: "Odyle crafting", cadence: "weekly", scope: "character", tag: "core", priority: "critical", cap: 4, bank: null, refillMs: null, assign: "everyone", notes: "4 crafts on this character, then 16 shared by the server." },
  { id: "odyle-buy-char", name: "Odyle purchase", cadence: "weekly", scope: "server", tag: "core", priority: "critical", cap: 20, bank: null, refillMs: null, assign: "membership", icon: SHOP_ICON, notes: "20 for the server. Membership only." },
  { id: "ascension", name: "Ascension Trial", cadence: "weekly", scope: "character", tag: "core", priority: "critical", cap: 3, bank: null, refillMs: null, assign: "everyone", icon: DUNGEON_ICON, notes: "3 entries. Does not carry past Wednesday." },
  { id: "shops", name: "Shop weekly limited items", cadence: "weekly", scope: "character", tag: "core", priority: "high", cap: 1, bank: null, refillMs: null, assign: "everyone", icon: SHOP_ICON, notes: "Wind Breeze, Nightmare shop, and the rest." },
  { id: "corridor", name: "Abyss Corridor", cadence: "weekly", scope: "character", tag: "core", priority: "high", cap: 3, bank: null, refillMs: null, assign: "everyone", icon: DUNGEON_ICON, notes: "3 a week, when the corridor is open." },
  { id: "subjugation", name: "Subjugation tickets", cadence: "weekly", scope: "character", tag: "core", priority: "high", cap: 3, bank: null, refillMs: null, assign: "everyone", icon: DUNGEON_ICON, notes: "3 tickets for 4-player dungeons." },
  { id: "abyss", name: "Abyss farming and missions", cadence: "weekly", scope: "character", tag: "core", priority: "medium", cap: 7, bank: null, refillMs: null, assign: "main", notes: "7 hours total across the Abyss. Main only, from gear score 1,000. Membership does not add hours." },
  { id: "raid-ludra", name: "Raid: Ludra", cadence: "weekly", scope: "character", tag: "core", priority: "medium", cap: 1, bank: null, refillMs: null, assign: "raids", icon: DUNGEON_ICON, notes: "Hidden until this raid is on global." },
  { id: "raid-corroded", name: "Raid: Corroded Facility", cadence: "weekly", scope: "character", tag: "core", priority: "medium", cap: 2, bank: null, refillMs: null, assign: "raids", icon: DUNGEON_ICON, notes: "Hidden until this raid is on global." },
  { id: "raid-chalice", name: "Raid: Chalice of Muspel", cadence: "weekly", scope: "character", tag: "core", priority: "medium", cap: 2, bank: null, refillMs: null, assign: "raids", icon: DUNGEON_ICON, notes: "Hidden until this raid is on global." },
  { id: "battlefield", name: "Battlefield wins", cadence: "weekly", scope: "character", tag: "core", priority: "low", cap: 3, bank: null, refillMs: null, assign: "everyone", icon: BATTLE_ICON, notes: "Victory reward 3 times." },
  { id: "command", name: "Command Missions", cadence: "weekly", scope: "server", tag: "core", priority: "low", cap: 12, bank: null, refillMs: null, assign: "main", icon: MISSION_ICON, notes: "Up to 12 from the capital merchant. Shared by the server." },
  { id: "fissure-week", name: "Daily Dungeon this week", cadence: "weekly", scope: "server", tag: "core", cap: 14, bank: null, refillMs: null, assign: "main", icon: DUNGEON_ICON, notes: "Unknown Fissure. 14 entries for the server. Does not carry past Wednesday." },
  { id: "odyle-craft-server", name: "Odyle craft, server", cadence: "weekly", scope: "server", tag: "core", cap: 16, bank: null, refillMs: null, assign: "main", notes: "16 for the server. Shown after each character's own 4." },
  { id: "season-abyss-hunt", name: "Halloween: Abyss hunt", cadence: "season", scope: "server", tag: "core", cap: 1, bank: null, refillMs: null, assign: "main", icon: EXPLORE_ICON, notes: "Hunt 10 monsters in the Abyss. Once per week per server. Through the Nov 4 maintenance." },
  { id: "season-transcendence", name: "Halloween: Transcendence", cadence: "season", scope: "character", tag: "core", cap: 1, bank: null, refillMs: null, assign: "everyone", icon: DUNGEON_ICON, notes: "Clear Transcendence once. Through the Nov 4 maintenance." },
  { id: "season-expedition", name: "Halloween: Expedition", cadence: "season", scope: "character", tag: "core", cap: 1, bank: null, refillMs: null, assign: "everyone", icon: DUNGEON_ICON, notes: "Clear Expedition Conquest once. Through the Nov 4 maintenance." },
  { id: "season-ascension", name: "Halloween: Ascension", cadence: "season", scope: "character", tag: "core", cap: 1, bank: null, refillMs: null, assign: "everyone", icon: DUNGEON_ICON, notes: "Clear Ascension Trial once. Through the Nov 4 maintenance." },
  { id: "season-nightmare", name: "Halloween: Nightmare", cadence: "season", scope: "character", tag: "core", cap: 1, bank: null, refillMs: null, assign: "everyone", icon: DUNGEON_ICON, notes: "Clear any Nightmare stage once. Through the Nov 4 maintenance." },
  { id: "season-login", name: "Halloween: Log in", cadence: "season", scope: "character", tag: "core", cap: 3, bank: null, refillMs: null, assign: "everyone", icon: MISSION_ICON, notes: "Log in 3 times. Through the Nov 4 maintenance." },
  { id: "season-gear", name: "Halloween: Unique gear", cadence: "season", scope: "character", tag: "core", cap: 1, bank: null, refillMs: null, assign: "everyone", icon: MISSION_ICON, notes: "Obtain 1 piece of Unique gear. Through the Nov 4 maintenance." },
  { id: "season-scrolls", name: "Halloween: Scrolls", cadence: "season", scope: "character", tag: "core", cap: 5, bank: null, refillMs: null, assign: "everyone", icon: MISSION_ICON, notes: "Use 5 scrolls. Through the Nov 4 maintenance." },
  { id: "season-dimension", name: "Halloween: Dimensional Invasion", cadence: "season", scope: "character", tag: "core", cap: 1, bank: null, refillMs: null, assign: "everyone", icon: DUNGEON_ICON, notes: "Participate once. Through the Nov 4 maintenance." },
  { id: "season-shugo", name: "Halloween: Shugo Festival", cadence: "season", scope: "character", tag: "core", cap: 1, bank: null, refillMs: null, assign: "everyone", icon: SHOP_ICON, notes: "Participate once. Through the Nov 4 maintenance." },
  { id: "season-shop-odyle", name: "Pumpkin shop: Odyle", cadence: "season", scope: "server", tag: "core", cap: 4, bank: null, refillMs: null, assign: "main", icon: SHOP_ICON, notes: "4 Odyle Energy (Bound) per server per week from the coin merchant." },
  { id: "season-shop-rift", name: "Pumpkin shop: Abyss stone", cadence: "season", scope: "server", tag: "core", cap: 2, bank: null, refillMs: null, assign: "main", icon: SHOP_ICON, notes: "2 Lower Abyss Rift Stones per server per week." },
  { id: "season-shop-fissure", name: "Pumpkin shop: Daily Dungeon ticket", cadence: "season", scope: "server", tag: "core", cap: 7, bank: null, refillMs: null, assign: "main", icon: SHOP_ICON, notes: "7 Instant Clear Tickets per server per week." },
  { id: "season-shop-nightmare", name: "Pumpkin shop: Nightmare ticket", cadence: "season", scope: "server", tag: "core", cap: 3, bank: null, refillMs: null, assign: "main", icon: SHOP_ICON, notes: "3 Nightmare challenge tickets per server per week." },
  { id: "season-shop-shugo", name: "Pumpkin shop: Shugo key", cadence: "season", scope: "server", tag: "core", cap: 3, bank: null, refillMs: null, assign: "main", icon: SHOP_ICON, notes: "3 Shugo Festival reward keys per server per week." },
  { id: "season-shop-chest", name: "Pumpkin shop: Halloween chest", cadence: "season", scope: "server", tag: "core", cap: 1, bank: null, refillMs: null, resets: "event", assign: "main", icon: SHOP_ICON, notes: "1 per server for the whole event. Does not reset on Wednesday." },
  { id: "season-candy-red", name: "Red Candy Key", cadence: "season", scope: "server", tag: "core", cap: 1, bank: null, refillMs: null, assign: "main", icon: SHOP_ICON, notes: "Craft once per week per server. Fragments come from Expedition and Transcendence." },
  { id: "season-candy-yellow", name: "Yellow Candy Key", cadence: "season", scope: "server", tag: "core", cap: 1, bank: null, refillMs: null, assign: "main", icon: SHOP_ICON, notes: "Craft once per week per server." },
  { id: "season-candy-blue", name: "Blue Candy Key", cadence: "season", scope: "server", tag: "core", cap: 1, bank: null, refillMs: null, assign: "main", icon: SHOP_ICON, notes: "Craft once per week per server." },
  { id: "season-rift-kina", name: "Conquerors rift stone", cadence: "season", scope: "character", tag: "core", cap: 7, bank: null, refillMs: null, assign: "everyone", icon: SHOP_ICON, notes: "7 Abyss Rift Stones per character per week, 50,000 Kina each. Through the Oct 28 maintenance." },
]

export const TASKS: TaskDef[] = TASK_INPUT.map((task) => ({
  priority: "medium",
  ...task,
  endsAt: task.cadence === "season" ? (task.id === "season-rift-kina" ? RIFT_STONE_END : HALLOWEEN_END) : undefined,
}))

export function seasonNotice(now: number): string {
  const lines: string[] = []
  if (now < HALLOWEEN_END) lines.push("Halloween runs through the Nov 4 maintenance.")
  if (now < RIFT_STONE_END) lines.push("Conquerors of the Abyss rift stones run through the Oct 28 maintenance.")
  lines.push("Weekly limits clear Wednesday 3:00 PM.")
  return lines.join(" ")
}

export function listClock(cadence: "daily" | "weekly", now: number): string {
  const resetAt = cadence === "daily" ? nextDailyReset(now) : nextWeeklyReset(now)
  const reset = cadence === "daily"
    ? `Resets in ${formatCountdown(resetAt - now)}`
    : `Wednesday reset in ${formatCountdown(resetAt - now)}`
  const boss = upcomingBosses(now)[0]
  if (!boss) return `${reset}.`
  return `${reset}. Next: ${boss.name} in ${formatCountdown(boss.at - now)}.`
}

export type ChecklistCharacter = {
  id: string
  name: string
  role: "main" | "alt"
  region: string
  serverId: number
  level: number | null
  itemLevel: number | null
  odyleNearCap: boolean
  odyleKnown: boolean
  portrait?: string
}

export type MarkOwner = string | null

export type ChecklistProgress = {
  dailyKey: string
  weeklyKey: string
  counts: Record<string, number>
  banks: Record<string, number>
  stamps: Record<string, string>
  marks: Record<string, MarkOwner[]>
}

export type BoxPart = {
  taskId: string
  cap: number
  owners: MarkOwner[]
  shared: boolean
}

export type ChecklistRow = {
  taskId: string
  name: string
  notes: string
  cadence: Cadence
  tag: TaskTag
  priority: Priority
  count: number
  cap: number
  bank: number | null
  bankCap: number | null
  urgency: Urgency
  reason: string
  timer: string | null
  mode: "edit" | "note"
  owner: string
  icon?: string
  shared: boolean
  stockBoxes: boolean
  parts: BoxPart[]
  bankFullAt: number | null
}

export type SessionItem = {
  id: string
  band: "lost" | "today" | "week"
  taskName: string
  characterName: string | null
  portrait?: string
  title: string
  detail: string
  characterId: string | null
  icon?: string
  shared: boolean
  count: number
  cap: number
  priority: Priority
}

export function emptyProgress(now = Date.now()): ChecklistProgress {
  return { dailyKey: dailyKey(now), weeklyKey: weeklyKey(now), counts: {}, banks: {}, stamps: {}, marks: {} }
}

export function taskCap(task: TaskDef, membership: boolean): number {
  if (membership && task.memberCap != null) return task.memberCap
  return task.cap
}

export function taskBankCap(task: TaskDef, membership: boolean): number | null {
  if (task.bank == null && task.memberBank == null) return null
  if (membership && task.memberBank != null) return task.memberBank
  return task.bank
}

const DAY_MS = 24 * 60 * 60 * 1000

type BankProjection = {
  current: number | null
  nextAt: number | null
  gain: number
}

function bankGain(task: TaskDef): number {
  if (task.accrue != null) return task.accrue
  if (task.refillMs != null) return 1
  return 0
}

function dailyResetsAfter(stamp: number, now: number): number {
  let count = 0
  let cursor = nextDailyReset(stamp)
  while (cursor <= now && count < 366) {
    count += 1
    cursor += DAY_MS
  }
  return count
}

function projectBank(
  task: TaskDef,
  stored: number | null,
  stamp: string | undefined,
  bankCap: number,
  now: number,
): BankProjection {
  const gain = bankGain(task)
  if (stored == null) return { current: null, nextAt: task.accrue != null ? nextDailyReset(now) : null, gain }
  const held = clamp(stored, 0, bankCap)
  const stampMs = stamp ? Date.parse(stamp) : Number.NaN
  if (!Number.isFinite(stampMs) || gain === 0) return { current: held, nextAt: null, gain }
  let ticks = 0
  let nextAt: number | null = null
  if (task.refillMs != null) {
    const elapsed = Math.max(0, now - stampMs)
    ticks = Math.floor(elapsed / task.refillMs)
    nextAt = stampMs + (ticks + 1) * task.refillMs
  } else {
    ticks = dailyResetsAfter(stampMs, now)
    nextAt = nextDailyReset(now)
  }
  const current = clamp(held + ticks * gain, 0, bankCap)
  return { current, nextAt: current >= bankCap ? null : nextAt, gain }
}

function commitBank(
  task: TaskDef,
  stored: number,
  stamp: string | undefined,
  bankCap: number,
  now: number,
  spent: number,
): { amount: number; stamp: string } {
  const projection = projectBank(task, stored, stamp, bankCap, now)
  const current = projection.current ?? stored
  const amount = clamp(current - spent, 0, bankCap)
  if (task.refillMs != null && projection.nextAt != null && amount < bankCap) {
    return { amount, stamp: new Date(projection.nextAt - task.refillMs).toISOString() }
  }
  return { amount, stamp: new Date(now).toISOString() }
}

function progressKey(taskId: string, scopeId: string): string {
  return `${taskId}|${scopeId}`
}

function taskById(taskId: string): TaskDef {
  const task = TASKS.find((item) => item.id === taskId)
  if (!task) throw new Error(`Unknown task ${taskId}`)
  return task
}

export function taskScope(taskId: string): "character" | "server" {
  return taskById(taskId).scope
}

export function syncProgress(progress: ChecklistProgress, now: number): ChecklistProgress {
  const nextDaily = dailyKey(now)
  const nextWeekly = weeklyKey(now)
  const marks = progress.marks ?? {}
  if (progress.dailyKey === nextDaily && progress.weeklyKey === nextWeekly) {
    return progress.marks ? progress : { ...progress, marks }
  }
  const counts = { ...progress.counts }
  const nextMarks = { ...marks }
  for (const key of Object.keys(counts)) {
    const task = TASKS.find((item) => item.id === key.slice(0, key.indexOf("|")))
    if (!task) continue
    if (task.cadence === "daily" && progress.dailyKey !== nextDaily) {
      delete counts[key]
      delete nextMarks[key]
    }
    const weeklySeason = task.cadence === "season" && task.resets !== "event"
    if ((task.cadence === "weekly" || weeklySeason) && progress.weeklyKey !== nextWeekly) {
      delete counts[key]
      delete nextMarks[key]
    }
  }
  return { ...progress, dailyKey: nextDaily, weeklyKey: nextWeekly, counts, marks: nextMarks }
}

type ScopeCharacter = Pick<ChecklistCharacter, "id" | "region" | "serverId">

function scopeIdFor(task: TaskDef, character: ScopeCharacter): string {
  return task.scope === "server" ? `${character.region}:${character.serverId}` : character.id
}

export function migrateSharedKeys(
  progress: ChecklistProgress,
  characters: Pick<ChecklistCharacter, "region" | "serverId" | "role">[],
): ChecklistProgress {
  const weight = new Map<string, number>()
  for (const character of characters) {
    const key = `${character.region}:${character.serverId}`
    weight.set(key, (weight.get(key) ?? 0) + (character.role === "main" ? 100 : 1))
  }
  const target = [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!target) return progress.marks ? progress : { ...progress, marks: progress.marks ?? {} }
  const rewrite = <T,>(record: Record<string, T> | undefined): Record<string, T> => {
    const next = { ...(record ?? {}) }
    for (const key of Object.keys(next)) {
      if (!key.endsWith("|server")) continue
      const moved = `${key.slice(0, -"|server".length)}|${target}`
      if (next[moved] == null) next[moved] = next[key]
      delete next[key]
    }
    return next
  }
  return {
    ...progress,
    counts: rewrite(progress.counts),
    banks: rewrite(progress.banks),
    stamps: rewrite(progress.stamps),
    marks: rewrite(progress.marks),
  }
}

function endgame(character: ChecklistCharacter): boolean {
  return (character.level ?? 0) >= 45
}

const ABYSS_IDS = new Set(["abyss", "abyss-day"])

function belowGear(character: ChecklistCharacter): boolean {
  return (character.itemLevel ?? 0) < GEAR_GATE
}

function fieldBossOwner(roster: ChecklistCharacter[]): ChecklistCharacter | null {
  const under = roster
    .filter((character) => endgame(character) && belowGear(character))
    .sort((a, b) => (a.itemLevel ?? 0) - (b.itemLevel ?? 0) || a.name.localeCompare(b.name))
  if (under.length) return under[0]
  return roster.find((character) => character.role === "main" && endgame(character)) ?? null
}

export function placement(
  task: TaskDef,
  character: ChecklistCharacter,
  roster: ChecklistCharacter[],
  membership: boolean,
): "edit" | "hidden" {
  if (!endgame(character)) return "hidden"
  if (task.assign === "membership" && !membership) return "hidden"
  if (task.assign === "main-il-1600") {
    return character.role === "main" && (character.itemLevel ?? 0) >= TRANSCENDENCE_GATE ? "edit" : "hidden"
  }
  if (task.assign === "field-bosses") {
    return fieldBossOwner(roster)?.id === character.id ? "edit" : "hidden"
  }
  if (ABYSS_IDS.has(task.id)) {
    return character.role === "main" && (character.itemLevel ?? 0) >= ABYSS_GATE ? "edit" : "hidden"
  }
  if (task.id === "odyle-craft-server" || task.id === "fissure-week" || task.assign === "raids") return "hidden"
  if (task.scope === "server") return "edit"
  if (task.assign === "main") {
    return character.role === "main" ? "edit" : "hidden"
  }
  return "edit"
}

export function rowUrgency(
  task: TaskDef,
  count: number,
  cap: number,
  bank: number | null,
  bankCap: number | null,
  _character: ChecklistCharacter,
  now: number,
): { urgency: Urgency; reason: string } {
  if (bankCap != null && bank != null && bank >= bankCap) {
    return { urgency: "do-now", reason: `Total entries are full at ${bankCap}. Another charge would be lost.` }
  }
  if (count >= cap) return { urgency: "done", reason: "Done for this reset." }
  if (bankCap != null) {
    const held = bank == null ? "not set" : `${bank}/${bankCap}`
    return { urgency: "can-wait", reason: `Total entries ${held}. It holds ${bankCap}, so this can wait until it is full.` }
  }
  if (task.cadence === "weekly" && task.tag === "core" && inWeeklyBurnWindow(now)) {
    return { urgency: "before-wednesday", reason: "This weekly does not carry over. Finish it before Wednesday 3:00 PM." }
  }
  if (task.cadence === "daily" && task.tag === "core") {
    const left = nextDailyReset(now) - now
    if (left <= NEAR_RESET_MS) {
      return { urgency: "do-now", reason: `Daily reset is in ${formatDuration(left)}. This one does not carry over.` }
    }
  }
  return { urgency: "steady", reason: "" }
}

function timerText(task: TaskDef, progress: ChecklistProgress, scope: string, projection: BankProjection | null, bankCap: number | null, now: number): string | null {
  if (bankCap != null && projection && projection.gain > 0) {
    if (projection.current != null && projection.current >= bankCap) return "Total entries are full, so the refill is paused."
    if (projection.nextAt == null) return null
    return `Next +${projection.gain} in ${formatCountdown(projection.nextAt - now)}.`
  }
  if (task.refillMs == null) return null
  const stamp = progress.stamps[progressKey(task.id, scope)]
  if (!stamp) return `Refills about every ${formatDuration(task.refillMs)}.`
  const next = Date.parse(stamp) + task.refillMs
  if (!Number.isFinite(next) || next <= now) return "A refill is due since your last update."
  return `Next charge in about ${formatDuration(next - now)}, counted from your last update.`
}

export function rowsForCharacter(
  character: ChecklistCharacter,
  roster: ChecklistCharacter[],
  progress: ChecklistProgress,
  membership: boolean,
  now: number,
): ChecklistRow[] {
  const current = syncProgress(progress, now)
  return TASKS.flatMap((task): ChecklistRow[] => {
    if (task.endsAt != null && now >= task.endsAt) return []
    const mode = placement(task, character, roster, membership)
    if (mode === "hidden") return []
    if (task.note) {
      return [{
        taskId: task.id,
        name: task.name,
        notes: task.notes,
        cadence: task.cadence,
        tag: task.tag,
        priority: task.priority,
        count: 0,
        cap: 0,
        bank: null,
        bankCap: null,
        urgency: "steady",
        reason: task.notes,
        timer: null,
        mode: "note",
        owner: "",
        icon: task.icon,
        shared: false,
        stockBoxes: false,
        parts: [],
        bankFullAt: null,
      }]
    }
    const bankCap = taskBankCap(task, membership)
    const bankKey = progressKey(task.id, scopeIdFor(task, character))
    const storedBank = bankCap == null || current.banks[bankKey] == null ? null : current.banks[bankKey]
    const projection = bankCap == null ? null : projectBank(task, storedBank, current.stamps[bankKey], bankCap, now)
    const bank = projection?.current ?? null
    const parts = task.stockBoxes
      ? [{ taskId: task.id, cap: bank ?? 0, owners: [], shared: task.scope === "server" }]
      : task.id === "fissure-day"
        ? [boxPart(taskById("fissure-week"), character, current, membership)]
        : partsFor(task, character, current, membership)
    const count = parts.reduce((sum, part) => sum + part.owners.length, 0)
    const cap = parts.reduce((sum, part) => sum + part.cap, 0)
    const urgency = combinedUrgency(parts, character, bank, bankCap, now)
    return [{
      taskId: task.id,
      name: task.name,
      notes: task.notes,
      cadence: task.cadence,
      tag: task.tag,
      priority: task.priority,
      count,
      cap,
      bank,
      bankCap,
      urgency: urgency.urgency,
      reason: urgency.reason,
      timer: timerText(task, current, scopeIdFor(task, character), projection, bankCap, now),
      mode,
      owner: "",
      icon: task.icon,
      shared: parts.length === 1 && parts[0].shared,
      stockBoxes: task.stockBoxes === true,
      parts,
      bankFullAt: bankFullAt(task, projection, bankCap, now),
    }]
  })
}

function partsFor(
  task: TaskDef,
  character: ChecklistCharacter,
  progress: ChecklistProgress,
  membership: boolean,
): BoxPart[] {
  const parts = [boxPart(task, character, progress, membership)]
  const paired = task.id === "odyle-craft-char" ? taskById("odyle-craft-server") : null
  if (paired && (paired.assign !== "membership" || membership)) parts.push(boxPart(paired, character, progress, membership))
  return parts
}

function boxPart(
  task: TaskDef,
  character: ChecklistCharacter,
  progress: ChecklistProgress,
  membership: boolean,
): BoxPart {
  const key = progressKey(task.id, scopeIdFor(task, character))
  const count = progress.counts[key] ?? 0
  const marks = progress.marks?.[key]
  const owners = task.scope === "server"
    ? (marks && marks.length ? marks : Array.from({ length: count }, () => null)).slice(0, taskCap(task, membership))
    : Array.from({ length: Math.min(count, taskCap(task, membership)) }, () => character.id)
  return { taskId: task.id, cap: taskCap(task, membership), owners, shared: task.scope === "server" }
}

function combinedUrgency(
  parts: BoxPart[],
  character: ChecklistCharacter,
  bank: number | null,
  bankCap: number | null,
  now: number,
): { urgency: Urgency; reason: string } {
  const task = taskById(parts[0].taskId)
  if (task.stockBoxes) return rowUrgency(task, 0, task.cap, bank, bankCap, character, now)
  const open = parts.filter((part) => part.owners.length < part.cap)
  if (!open.length) {
    const weeklyDungeon = parts[0].taskId === "fissure-week"
    return { urgency: "done", reason: weeklyDungeon ? "Done for this week." : "Done for this reset." }
  }
  return rowUrgency(taskById(open[0].taskId), open[0].owners.length, open[0].cap, bank, bankCap, character, now)
}

export function setTaskCount(
  progress: ChecklistProgress,
  taskId: string,
  character: ScopeCharacter,
  value: number,
  membership: boolean,
  now: number,
): ChecklistProgress {
  const task = taskById(taskId)
  const current = syncProgress(progress, now)
  const cap = taskCap(task, membership)
  const previousMarks = ownersFor(current, task, character, cap)
  const next = clamp(value, 0, cap)
  const nextMarks = next >= previousMarks.length
    ? [...previousMarks, ...Array.from({ length: next - previousMarks.length }, () => character.id)]
    : previousMarks.slice(0, next)
  return writeOwners(current, task, character, nextMarks, membership, now)
}

export function setTaskMarks(
  progress: ChecklistProgress,
  taskId: string,
  character: ScopeCharacter,
  owners: MarkOwner[],
  membership: boolean,
  now: number,
): ChecklistProgress {
  const task = taskById(taskId)
  const current = syncProgress(progress, now)
  const cap = taskCap(task, membership)
  return writeOwners(current, task, character, owners.slice(0, cap), membership, now)
}

function ownersFor(progress: ChecklistProgress, task: TaskDef, character: ScopeCharacter, cap: number): MarkOwner[] {
  const key = progressKey(task.id, scopeIdFor(task, character))
  const count = Math.min(progress.counts[key] ?? 0, cap)
  const marks = progress.marks?.[key]
  if (task.scope === "server") return (marks ?? Array.from({ length: count }, () => null)).slice(0, count)
  return Array.from({ length: count }, () => character.id)
}

function writeOwners(
  progress: ChecklistProgress,
  task: TaskDef,
  character: ScopeCharacter,
  owners: MarkOwner[],
  membership: boolean,
  now: number,
): ChecklistProgress {
  const key = progressKey(task.id, scopeIdFor(task, character))
  const cap = taskCap(task, membership)
  const previous = ownersFor(progress, task, character, cap)
  let nextOwners = owners.slice(0, cap)
  let banks = progress.banks
  let stamps = progress.stamps
  const bankCap = taskBankCap(task, membership)
  if (bankCap != null && progress.banks[key] != null) {
    const projection = projectBank(task, progress.banks[key], progress.stamps[key], bankCap, now)
    const held = projection.current ?? 0
    const wanted = nextOwners.length - previous.length
    if (wanted > held) nextOwners = nextOwners.slice(0, previous.length + held)
    const spent = nextOwners.length - previous.length
    const committed = commitBank(task, progress.banks[key], progress.stamps[key], bankCap, now, spent)
    banks = { ...progress.banks, [key]: committed.amount }
    stamps = { ...progress.stamps, [key]: committed.stamp }
  } else if (task.refillMs != null && bankCap == null) {
    stamps = { ...progress.stamps, [key]: new Date(now).toISOString() }
  }
  const counts = { ...progress.counts, [key]: nextOwners.length }
  const marks = { ...(progress.marks ?? {}) }
  if (task.scope === "server") marks[key] = nextOwners
  if (task.id === "fissure-day") applyFissureWeek(counts, marks, scopeIdFor(task, character), previous, nextOwners)
  return { ...progress, counts, marks, banks, stamps }
}

export function applyBoxChange(
  progress: ChecklistProgress,
  taskId: string,
  character: ScopeCharacter,
  owners: MarkOwner[],
  membership: boolean,
  now: number,
): ChecklistProgress {
  const task = taskById(taskId)
  if (task.scope === "server") return setTaskMarks(progress, taskId, character, owners, membership, now)
  return setTaskCount(progress, taskId, character, owners.length, membership, now)
}

function applyFissureWeek(
  counts: Record<string, number>,
  marks: Record<string, MarkOwner[]>,
  scope: string,
  previous: MarkOwner[],
  next: MarkOwner[],
) {
  const weekKey = progressKey("fissure-week", scope)
  const week = [...(marks[weekKey] ?? Array.from({ length: counts[weekKey] ?? 0 }, () => null))]
  const removed = [...previous]
  for (const owner of next) {
    const index = removed.findIndex((item) => item === owner)
    if (index >= 0) removed.splice(index, 1)
  }
  const added = [...next]
  for (const owner of previous) {
    const index = added.findIndex((item) => item === owner)
    if (index >= 0) added.splice(index, 1)
  }
  for (const owner of removed) {
    const index = week.findIndex((item) => item === owner)
    if (index >= 0) week.splice(index, 1)
  }
  week.push(...added)
  const capped = week.slice(0, 14)
  marks[weekKey] = capped
  counts[weekKey] = capped.length
}

export function setTaskBank(
  progress: ChecklistProgress,
  taskId: string,
  character: ScopeCharacter,
  value: number,
  membership: boolean,
  now: number,
): ChecklistProgress {
  const task = taskById(taskId)
  const bankCap = taskBankCap(task, membership)
  if (bankCap == null) return syncProgress(progress, now)
  const current = syncProgress(progress, now)
  const key = progressKey(taskId, scopeIdFor(task, character))
  const banks = { ...current.banks, [key]: clamp(value, 0, bankCap) }
  const stamps = { ...current.stamps, [key]: new Date(now).toISOString() }
  return { ...current, banks, stamps }
}

export function sessionItems(
  roster: ChecklistCharacter[],
  progress: ChecklistProgress,
  membership: boolean,
  now: number,
): SessionItem[] {
  const lost: SessionItem[] = []
  const soon: SessionItem[] = []
  const today: SessionItem[] = []
  const week: SessionItem[] = []
  for (const character of roster) {
    if ((character.level ?? 0) < 45) continue
    for (const row of rowsForCharacter(character, roster, progress, membership, now)) {
      if (row.mode !== "edit" || row.urgency === "done") continue
      const overflowing = row.urgency === "do-now" && row.bankCap != null
      if (overflowing) {
        lost.push(sessionLine(character, row, "lost"))
        continue
      }
      if (row.cadence === "daily" && row.tag === "core" && row.bankCap == null) {
        const line = sessionLine(character, row, "today")
        if (row.urgency === "do-now") soon.push(line)
        else if (row.urgency !== "can-wait") today.push(line)
        continue
      }
      if (row.cadence === "weekly" && row.tag === "core" && row.bankCap == null && row.urgency === "before-wednesday") {
        week.push(sessionLine(character, row, "week"))
      }
    }
  }
  for (const boss of upcomingBosses(now)) {
    const left = boss.at - now
    if (left > BOSS_SOON_MS) continue
    lost.push({
      id: boss.id,
      band: "lost",
      taskName: boss.name,
      characterName: null,
      title: boss.name,
      detail: `Spawns in ${formatDuration(left)}.`,
      characterId: null,
      shared: false,
      count: 0,
      cap: 0,
      priority: "critical",
    })
  }
  return [...lost, ...soon, ...today, ...week]
}

export type RosterGoal = {
  id: string
  taskName: string
  meta: string
  detail: string
  due: string
  characterId: string | null
  urgent: boolean
  priority: Priority
}

export function rosterGoals(items: SessionItem[], selectedId: string | null, odyle: OdyleGoal | null, now: number): RosterGoal[] {
  const chosen = new Map<string, SessionItem>()
  const order: string[] = []
  for (const item of items) {
    const key = item.characterId == null ? item.id : item.shared ? `shared:${item.taskName}` : item.id
    const current = chosen.get(key)
    if (!current) {
      chosen.set(key, item)
      order.push(key)
      continue
    }
    if (selectedId && item.characterId === selectedId) chosen.set(key, item)
  }
  const lines = order.map((key) => rosterGoal(chosen.get(key)!, now))
  const odyleLine = odyleGoalLine(selectedId, odyle, now)
  const goals = odyleLine ? [...lines, odyleLine] : lines
  return goals.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
}

function rosterGoal(item: SessionItem, now: number): RosterGoal {
  const boss = item.characterId == null
  return {
    id: boss ? item.id : item.shared ? `shared:${item.taskName}` : item.id,
    taskName: item.taskName,
    meta: goalMeta(item),
    detail: boss ? "" : shortDetail(item.detail),
    due: dueLabel(item, now),
    characterId: item.characterId,
    urgent: item.band === "lost",
    priority: item.priority,
  }
}

function goalMeta(item: SessionItem): string {
  if (item.characterId == null) return ""
  const count = item.cap > 0 ? `${item.count}/${item.cap}` : ""
  return [item.characterName, count].filter(Boolean).join(" · ")
}

function dueLabel(item: SessionItem, now: number): string {
  if (item.characterId == null) {
    const boss = upcomingBosses(now).find((boss) => boss.id === item.id || boss.name === item.taskName)
    return boss ? `Spawns in ${shortLeft(boss.at - now)}` : ""
  }
  if (item.band === "lost") return "Due now"
  const at = item.band === "week" ? nextWeeklyReset(now) : nextDailyReset(now)
  return `Due in ${shortLeft(at - now)}`
}

function shortDetail(text: string): string {
  return text.trim().split(/(?<=\.)\s/)[0] ?? ""
}

function odyleGoalLine(selectedId: string | null, odyle: OdyleGoal | null, now: number): RosterGoal | null {
  if (!selectedId || !odyle) return null
  const soon = odyle.fullAt != null && odyle.fullAt - now <= TWO_DAYS_MS
  if (!odyle.full && !odyle.aboveCap && !soon) return null
  const due = odyle.aboveCap ? "Above the cap" : odyle.full ? "At the cap" : `Caps in ${shortLeft(odyle.fullAt! - now)}`
  return {
    id: "odyle",
    taskName: "Odyle",
    meta: "",
    detail: odyle.full || odyle.aboveCap ? "Regen is paused." : "Spend it before regen stops.",
    due,
    characterId: selectedId,
    urgent: odyle.full || odyle.aboveCap,
    priority: "critical",
  }
}

function shortLeft(ms: number): string {
  return formatDuration(ms).replace(/ 0[hm]$/, "")
}

export function rosterMark(
  items: SessionItem[],
  characterId: string,
  selectedId: string | null = null,
  odyle: OdyleGoal | null = null,
  now = Date.now(),
): { count: number; urgent: boolean } {
  const mine = rosterGoals(items, selectedId, odyle, now).filter((goal) => goal.characterId === characterId)
  const bossSoon = items.some((item) => item.characterId == null && item.band === "lost")
  const urgent = mine.some((goal) => goal.urgent) || (bossSoon && mine.some((goal) => goal.taskName === "Field bosses"))
  return { count: mine.length, urgent }
}

function sessionLine(character: ChecklistCharacter, row: ChecklistRow, band: SessionItem["band"]): SessionItem {
  return {
    id: `${character.id}:${row.taskId}`,
    band,
    taskName: row.name,
    characterName: character.name,
    portrait: character.portrait,
    title: `${character.name}: ${row.name}`,
    detail: row.reason || row.notes,
    characterId: character.id,
    icon: row.icon,
    shared: row.shared,
    count: row.stockBoxes ? row.bank ?? 0 : row.count,
    cap: row.stockBoxes ? row.bankCap ?? row.cap : row.cap,
    priority: row.priority,
  }
}

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

export type GoalKind = "dungeons" | "world" | "missions" | "keys" | "odyle"

export const GOAL_KINDS: { id: GoalKind; label: string }[] = [
  { id: "dungeons", label: "Dungeons" },
  { id: "world", label: "World" },
  { id: "missions", label: "Missions" },
  { id: "keys", label: "Keys and charges" },
  { id: "odyle", label: "Odyle" },
]

const GOAL_KIND_BY_TASK: Record<string, GoalKind> = {
  nightmare: "dungeons",
  "fissure-day": "dungeons",
  "fissure-week": "dungeons",
  ascension: "dungeons",
  corridor: "dungeons",
  subjugation: "dungeons",
  "raid-ludra": "dungeons",
  "raid-corroded": "dungeons",
  "raid-chalice": "dungeons",
  krao: "dungeons",
  urugugu: "dungeons",
  "growth-graveyard": "dungeons",
  "growth-fafnite": "dungeons",
  abyss: "dungeons",
  qina: "world",
  "field-bosses": "world",
  rift: "world",
  battlefield: "world",
  "supply-daily": "missions",
  "supply-weekly": "missions",
  duty: "missions",
  attendance: "missions",
  command: "missions",
  season: "missions",
  "daeva-pass": "missions",
  dimension: "keys",
  shugo: "keys",
  transcendence: "keys",
  "odyle-craft-char": "odyle",
  "odyle-craft-server": "odyle",
  "odyle-buy-char": "odyle",
}

export type GoalLine = {
  id: string
  title: string
  detail: string
  kind: GoalKind
  priority: Priority
  icon?: string
}

export type OdyleGoal = {
  full: boolean
  aboveCap: boolean
  fullAt: number | null
}

export function characterGoals(rows: ChecklistRow[], now: number, odyle: OdyleGoal | null): { today: GoalLine[]; later: GoalLine[] } {
  const today: GoalLine[] = []
  const later: GoalLine[] = []
  if (odyle && (odyle.full || odyle.aboveCap || (odyle.fullAt != null && odyle.fullAt - now <= TWO_DAYS_MS))) {
    today.push({
      id: "odyle",
      title: "Odyle energy",
      detail: odyleDetail(odyle, now),
      kind: "odyle",
      priority: "critical",
    })
  }
  const soon = upcomingBosses(now).filter((boss) => boss.at - now <= BOSS_SOON_MS)
  for (const row of rows) {
    if (row.mode !== "edit" || row.cadence === "season" || !goalShown(row)) continue
    const due = goalUrgent(row, now)
    const line = goalLine(row, soon, now)
    if (due) today.push(line)
    else later.push(line)
  }
  today.sort(byGoalPriority)
  later.sort(byGoalPriority)
  return { today, later }
}

function byGoalPriority(a: GoalLine, b: GoalLine): number {
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
}

function goalShown(row: ChecklistRow): boolean {
  const banked = row.bank != null && row.bank > 0
  const unset = row.bankCap != null && row.bank == null
  if (row.stockBoxes) return banked || unset
  return row.count < row.cap || banked
}

function goalUrgent(row: ChecklistRow, now: number): boolean {
  if (row.bank != null && row.bankCap != null && row.bank >= row.bankCap) return true
  if (row.bankFullAt != null && row.bankFullAt - now <= TWO_DAYS_MS) return true
  if (row.urgency === "do-now") return true
  if (row.bankCap == null && row.cadence === "daily" && row.count < row.cap) return true
  if (row.bankCap == null && row.cadence === "weekly" && row.count < row.cap && nextWeeklyReset(now) - now <= TWO_DAYS_MS) return true
  return false
}

function goalLine(row: ChecklistRow, soon: { name: string; at: number }[], now: number): GoalLine {
  const status: string[] = []
  if (row.stockBoxes) {
    status.push(row.bank == null || row.bankCap == null ? "Total entries not set" : `Total entries ${row.bank}/${row.bankCap}`)
  } else {
    if (row.cap > 0) status.push(`${row.count}/${row.cap}`)
    if (row.bankCap != null) status.push(row.bank == null ? "Total entries not set" : `Total entries ${row.bank}/${row.bankCap}`)
  }
  if (row.timer) status.push(row.timer)
  if (row.taskId === "field-bosses") {
    for (const boss of soon) status.push(`${boss.name} spawns in ${formatCountdown(boss.at - now)}`)
  }
  return {
    id: row.taskId,
    title: row.name,
    detail: [row.notes, status.join(" · ")].filter(Boolean).join(" "),
    kind: GOAL_KIND_BY_TASK[row.taskId] ?? "missions",
    priority: row.priority,
    icon: row.icon,
  }
}

function odyleDetail(odyle: OdyleGoal, now: number): string {
  if (odyle.aboveCap) return "Above the passive cap. Regen is paused."
  if (odyle.full) return "At the cap. Regen is paused."
  if (odyle.fullAt != null) return `Caps in ${formatCountdown(odyle.fullAt - now)}.`
  return "Spend it before regen stops."
}

function bankFullAt(task: TaskDef, projection: BankProjection | null, bankCap: number | null, now: number): number | null {
  if (bankCap == null || !projection || projection.current == null || projection.gain <= 0) return null
  if (projection.current >= bankCap) return now
  if (projection.nextAt == null) return null
  const ticks = Math.ceil((bankCap - projection.current) / projection.gain)
  const interval = task.refillMs ?? DAY_MS
  return projection.nextAt + (ticks - 1) * interval
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)))
}
