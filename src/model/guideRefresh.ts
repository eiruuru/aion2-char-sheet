import bundled from "./classPriorities.json"
import phrases from "./guidePhrases.json"
import {
  bossesSituation,
  type ClassSituation,
  type ClassSkill,
  type GuideMacro,
  type GuideRow,
  type GuideTip,
  type PriorityMode,
  type SkillSlot,
  type SkillTier,
} from "./classPriorities"

export const GUIDE_STORAGE_KEY = "aion2-guide-v2"
export const GUIDE_REFRESH_MS = 24 * 60 * 60 * 1000

const CLASS_SLUGS = ["gladiator", "templar", "assassin", "ranger", "chanter", "cleric", "sorcerer", "spiritmaster"]
const CYRILLIC = /[А-Яа-яЁё]/
const MODE_IDS: Record<string, PriorityMode> = {
  PvE: "pve",
  PvP: "pvp",
  "Массовое PvP": "mass",
}
const SLOT_IDS: Record<string, SkillSlot> = {
  "Активные": "active",
  "Пассивные": "passive",
  "Стигмы": "stigma",
}
const TIERS = new Set<SkillTier>(["S", "A", "B", "C", "?"])

export type GuideBook = Record<string, ClassSituation[]>

export type GuideLoad = {
  book: GuideBook
  failed: boolean
  fetchedAt: number | null
}

type GuideStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

type GuideCache = {
  fetchedAt: number
  book: GuideBook
}

const bundledBook = bundled.classes as GuideBook
const situationIds = phrases.situations as Record<string, string>
const EXTRA_PHRASES: Record<string, string> = {
  "Следующее улучшение": "Next upgrade",
  "Основная связка → специализация → подходящие стигмы": "Core combo, then specialization, then the stigmas that fit",
  "Проверяйте открытые уровни и слоты. После этого выбирайте бонусы Daevanion, колец и арканов под конкретную связку.": "Check the levels and slots you have open. Then pick Daevanion, ring, and arcana bonuses for that combo.",
  "Свойства и уровни основной связки": "Stats and levels on the core combo",
  "Сравнивайте фактические полезные свойства. Один item level не доказывает, что предмет лучше для роли.": "Compare the stats you actually use. A higher item level does not mean the item is better for the role.",
  "Ищите бонусы уровня этого умения на карте. Нужный порог зависит от уже имеющихся бонусов.": "Look for level bonuses to this skill on the board. The threshold depends on the bonuses you already have.",
  "Искать в первую очередь": "Look for this first",
  "Если свойство доступно.": "If that stat is available.",
  "Проверить на своём персонаже": "Check it on your character",
  "Активные": "Active",
  "Пассивные": "Passive",
  "Стигмы": "Stigma",
  "Умения": "Skills",
  "Голова": "Head",
}

const phraseMap = { ...(phrases.phrases as Record<string, string>), ...EXTRA_PHRASES }

const PET_FOCUS: Record<string, string> = {
  Cogni: "Power, then attack, crit, and HP",
  Fera: "Accuracy, agility, and mount speed",
  Natura: "Accuracy and crit through Precision, plus a pool of Od",
  Varian: "Constitution, then HP and evasion",
  Special: "Bonuses need a separate check",
}

type GuideCatalog = {
  descriptions: Record<string, string>
  icons: Record<string, string>
  pantheon: Record<string, { name: string; detail: string }>
  offers: { name: string; price: string }[]
  boards: { name: string; level: number; stats: string[]; grade: string }[]
  speciesStats: string[]
  pets: { name: string; focus: string }[]
}

const EMPTY_CATALOG: GuideCatalog = {
  descriptions: {},
  icons: {},
  pantheon: {},
  offers: [],
  boards: [],
  speciesStats: [],
  pets: [],
}

export function guideIsFresh(entry: { fetchedAt: number }, now: number): boolean {
  return now - entry.fetchedAt < GUIDE_REFRESH_MS
}

export function translatePhrase(value: string): string | null {
  if (!value) return value
  const normalized = value
    .replace(/Активные/g, "Active")
    .replace(/Пассивные/g, "Passive")
    .replace(/Стигмы/g, "Stigma")
    .replace(/Итоговая цель (\d+) · позже (\d+)/g, "Aim for $1 now, $2 later")
  if (!CYRILLIC.test(normalized)) return normalized
  if (phraseMap[normalized]) return phraseMap[normalized]
  if (phraseMap[value]) return phraseMap[value]
  if (value.endsWith(phrases.passive)) {
    const stem = value.slice(0, -phrases.passive.length)
    if (phraseMap[stem]) return phraseMap[stem] + phrases.passiveEn
  }
  return null
}

export function parseClassFile(raw: unknown, catalog: GuideCatalog = EMPTY_CATALOG): { name: string; situations: ClassSituation[] } | null {
  if (!raw || typeof raw !== "object") return null
  const record = raw as { name?: unknown; contexts?: unknown }
  if (typeof record.name !== "string" || !Array.isArray(record.contexts)) return null
  const situations: ClassSituation[] = []
  record.contexts.forEach((item, index) => {
    const situation = parseSituation(item, index, record.name as string, catalog)
    if (situation) situations.push(situation)
  })
  if (!situations.length) return null
  return { name: record.name, situations }
}

export function applyEnglish(next: ClassSituation[], previous: ClassSituation[] | null): ClassSituation[] {
  return next.map((entry) => {
    const prior = previous?.find((item) => item.mode === entry.mode && item.situation === entry.situation) ?? null
    return {
      ...entry,
      role: englishText(entry.role, prior?.role ?? ""),
      steps: englishText(entry.steps, prior?.steps ?? ""),
      swaps: englishText(entry.swaps, prior?.swaps ?? ""),
      risks: englishText(entry.risks, prior?.risks ?? ""),
      tip: englishText(entry.tip, prior?.tip ?? ""),
      skills: entry.skills.map((skill) => {
        const earlier = prior?.skills.find((item) => item.name === skill.name && item.slot === skill.slot)
        return {
          ...skill,
          why: englishText(skill.why, earlier?.why ?? ""),
          detail: englishText(skill.detail ?? "", earlier?.detail ?? ""),
          training: englishText(skill.training ?? "", earlier?.training ?? ""),
          description: skill.description || earlier?.description || "",
          icon: skill.icon || earlier?.icon || "",
        }
      }),
      arcana: englishRows(entry.arcana, prior?.arcana),
      pantheon: englishRows(entry.pantheon, prior?.pantheon),
      equipment: englishRows(entry.equipment, prior?.equipment),
      statRows: englishRows(entry.statRows, prior?.statRows),
      shops: englishRows(entry.shops, prior?.shops),
      progression: englishRows(entry.progression, prior?.progression),
      daevanion: englishRows(entry.daevanion, prior?.daevanion),
      pets: englishRows(entry.pets, prior?.pets),
      species: englishRows(entry.species, prior?.species),
      macros: (entry.macros ?? []).map((macro, index) => englishMacro(macro, prior?.macros?.[index])),
      tips: (entry.tips ?? []).map((tip, index) => englishTip(tip, prior?.tips?.[index])),
    }
  })
}

export async function downloadGuide(fetchImpl: typeof fetch = fetch): Promise<GuideBook> {
  return mergeBook(await fetchBook(fetchImpl), bundledBook)
}

export async function loadGuide(
  storage: GuideStore,
  now = Date.now(),
  fetchImpl: typeof fetch = fetch,
): Promise<GuideLoad> {
  const cached = readCache(storage)
  if (cached && guideIsFresh(cached, now)) {
    return { book: cached.book, failed: false, fetchedAt: cached.fetchedAt }
  }
  try {
    const downloaded = await fetchBook(fetchImpl)
    const book = mergeBook(downloaded, cached?.book ?? bundledBook)
    const entry: GuideCache = { fetchedAt: now, book }
    storage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(entry))
    return { book, failed: false, fetchedAt: now }
  } catch {
    return { book: cached?.book ?? bundledBook, failed: true, fetchedAt: cached?.fetchedAt ?? null }
  }
}

export function guideFor(book: GuideBook, className: string): ClassSituation[] | null {
  const trimmed = className.trim()
  if (!trimmed) return null
  const alias = trimmed.toLowerCase() === "elementalist" ? "Spiritmaster" : trimmed
  const match = Object.keys(book).find((name) => name.toLowerCase() === alias.toLowerCase())
  return match ? book[match] : null
}

function mergeBook(downloaded: GuideBook, previous: GuideBook): GuideBook {
  const book: GuideBook = { ...previous }
  for (const [name, situations] of Object.entries(downloaded)) {
    book[name] = applyEnglish(situations, previous[name] ?? null)
  }
  return book
}

async function fetchBook(fetchImpl: typeof fetch): Promise<GuideBook> {
  const catalog = await fetchCatalog(fetchImpl)
  const book: GuideBook = {}
  for (const slug of CLASS_SLUGS) {
    const response = await fetchImpl(`https://aion2-guide.com/data/classes/${slug}.json`, { cache: "no-store" })
    if (!response.ok) throw new Error(String(response.status))
    const parsed = parseClassFile(await response.json(), catalog)
    if (!parsed) throw new Error(slug)
    book[parsed.name] = parsed.situations
  }
  if (!bossesSituation(book.Gladiator ?? [])) throw new Error("gladiator")
  return book
}

async function fetchCatalog(fetchImpl: typeof fetch): Promise<GuideCatalog> {
  const [commonRes, iconRes, growthRes, petRes] = await Promise.all([
    fetchImpl("https://aion2-guide.com/data/common.json", { cache: "no-store" }),
    fetchImpl("https://aion2-guide.com/data/icons.json", { cache: "no-store" }),
    fetchImpl("https://aion2-guide.com/data/growth-guides.json", { cache: "no-store" }),
    fetchImpl("https://aion2-guide.com/data/pets-guide.json", { cache: "no-store" }),
  ])
  if (!commonRes.ok || !iconRes.ok || !growthRes.ok || !petRes.ok) throw new Error("catalog")
  const common = await commonRes.json() as {
    catalog_skill_details?: Record<string, { description_en?: string }>
    pantheon?: { records?: { catalog_id?: string; name?: string; stats?: Record<string, number> }[] }
    offers?: { name?: string; prices?: { amount?: number; currency?: string }[] }[]
  }
  const growth = await growthRes.json() as {
    boards?: { name?: string; level?: number; stats?: string[]; grade?: string }[]
    families?: { name?: string; slots?: { options?: { stat?: string }[] }[] }[]
  }
  const petFile = await petRes.json() as { families?: { name?: string; focus?: string }[] }
  const descriptions: Record<string, string> = {}
  for (const [id, row] of Object.entries(common.catalog_skill_details ?? {})) {
    if (row?.description_en) descriptions[id] = row.description_en
  }
  const pantheon: GuideCatalog["pantheon"] = {}
  for (const row of common.pantheon?.records ?? []) {
    if (!row.catalog_id || !row.name) continue
    const detail = Object.entries(row.stats ?? {}).map(([stat, value]) => `${stat} ${value}`).join(", ")
    pantheon[row.catalog_id] = { name: row.name, detail }
  }
  const stats = new Set<string>()
  for (const family of growth.families ?? []) {
    for (const slot of family.slots ?? []) {
      for (const option of slot.options ?? []) if (option.stat) stats.add(option.stat)
    }
  }
  return {
    descriptions,
    icons: await iconRes.json() as Record<string, string>,
    pantheon,
    offers: (common.offers ?? []).map((offer) => ({
      name: offer.name ?? "",
      price: offer.prices?.[0] ? `${offer.prices[0].amount ?? ""} ${offer.prices[0].currency ?? ""}`.trim() : "",
    })),
    boards: (growth.boards ?? []).map((board) => ({
      name: board.name ?? "",
      level: board.level ?? 0,
      stats: board.stats ?? [],
      grade: board.grade ?? "",
    })),
    speciesStats: [...stats],
    pets: (petFile.families ?? []).map((family) => ({
      name: family.name ?? "",
      focus: PET_FOCUS[family.name ?? ""] ?? family.focus ?? "",
    })),
  }
}

function parseSituation(raw: unknown, index: number, className: string, catalog: GuideCatalog): ClassSituation | null {
  if (!raw || typeof raw !== "object") return null
  const record = raw as {
    mode?: unknown
    variant?: unknown
    build?: Record<string, unknown>
    skills?: unknown
    recommendations?: Record<string, unknown>
    pantheon?: Record<string, { tier?: string }>
    shop_ratings?: { ready?: number[] }
    macros?: unknown
    cases?: unknown
    wings?: { profile?: { id?: string } }
  }
  const mode = MODE_IDS[String(record.mode ?? "")]
  if (!mode) return null
  const variant = typeof record.variant === "string" ? record.variant : ""
  const build = record.build ?? {}
  const skills = Array.isArray(record.skills) ? record.skills.map((skill) => parseSkill(skill, catalog)).filter((skill): skill is ClassSkill => Boolean(skill)) : []
  const recommendations = record.recommendations ?? {}
  const roleId = record.wings?.profile?.id ?? ""
  return {
    mode,
    situation: situationIds[variant] ?? slugSituation(variant, index),
    role: text(build.role),
    core: stringList(build.core_skills),
    stigmas: stringList(build.stigmas),
    steps: text(build.steps),
    swaps: text(build.swaps),
    risks: text(build.risks),
    tip: text(build.tip),
    stats: stringList(build.stats),
    skills,
    arcana: recommendationRows(recommendations["Арканы"]),
    equipment: [...recommendationRows(recommendations["Оружие"]), ...recommendationRows(recommendations["Экипировка"])],
    statRows: recommendationRows(recommendations["Характеристики"]),
    progression: recommendationRows(recommendations["Прокачка"]),
    pantheon: pantheonRows(record.pantheon, catalog),
    shops: shopRows(record.shop_ratings?.ready, catalog),
    daevanion: catalog.boards.filter((board) => board.name).map((board) => ({
      title: board.name,
      tier: board.grade === "unique" ? "S" as const : "A" as const,
      why: board.stats.join(", "),
      detail: board.level ? `Level ${board.level}` : "",
    })),
    pets: catalog.pets.filter((pet) => pet.name).map((pet) => ({ title: pet.name, tier: "A" as const, why: pet.focus })),
    species: speciesRows(catalog.speciesStats, { mode: String(record.mode ?? ""), variant, roleId, className }),
    macros: macroRows(record.macros),
    tips: tipRows(record.cases),
  }
}

function parseSkill(raw: unknown, catalog: GuideCatalog): ClassSkill | null {
  if (!raw || typeof raw !== "object") return null
  const record = raw as {
    title?: unknown
    slot?: unknown
    tier?: unknown
    why?: unknown
    target?: unknown
    game_id?: unknown
    icon_key?: unknown
    training?: { target?: number; later?: number; note?: string }
  }
  const slot = SLOT_IDS[String(record.slot ?? "")]
  if (!slot || typeof record.title !== "string" || !record.title) return null
  const tier = TIERS.has(record.tier as SkillTier) ? record.tier as SkillTier : "?"
  const gameId = text(record.game_id)
  const iconKey = text(record.icon_key)
  const train = record.training
  const note = translatePhrase(text(train?.note))
  const training = [train?.target ? `Aim for ${train.target} now` : "", train?.later ? `${train.later} later` : "", note && !CYRILLIC.test(note) ? note : ""].filter(Boolean).join(", ")
  return {
    name: record.title,
    slot,
    tier,
    why: text(record.why),
    detail: text(record.target),
    description: catalog.descriptions[gameId] ?? "",
    icon: catalog.icons[iconKey] ?? "",
    training,
  }
}

function recommendationRows(raw: unknown): GuideRow[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const row = item as { title?: string; tier?: string; why?: string; target?: string; slot?: string }
    return {
      title: text(row.title),
      tier: tierOf(row.tier),
      why: text(row.why),
      detail: text(row.target),
      slot: text(row.slot),
    }
  }).filter((row) => row.title)
}

function pantheonRows(raw: Record<string, { tier?: string }> | undefined, catalog: GuideCatalog): GuideRow[] {
  if (!raw) return []
  return Object.entries(raw).map(([id, row]) => {
    const known = catalog.pantheon[id]
    return {
      title: known?.name || id,
      tier: tierOf(row.tier),
      why: "",
      detail: known?.detail || "",
    }
  }).filter((row) => row.tier === "S" || row.tier === "A" || row.tier === "B")
}

function shopRows(ready: number[] | undefined, catalog: GuideCatalog): GuideRow[] {
  if (!ready?.length) return []
  return ready.map((score, index) => ({ score, offer: catalog.offers[index] }))
    .filter((item) => item.score >= 4 && item.offer?.name)
    .sort((left, right) => right.score - left.score)
    .slice(0, 16)
    .map((item) => ({
      title: item.offer.name,
      tier: item.score >= 6 ? "S" as const : item.score >= 5 ? "A" as const : "B" as const,
      why: "",
      detail: item.offer.price,
    }))
}

function speciesRows(stats: string[], ctx: { mode: string; variant: string; roleId: string; className: string }): GuideRow[] {
  const role = /-heal-/.test(ctx.roleId) ? "heal" : /-tank-/.test(ctx.roleId) ? "tank" : /-support-/.test(ctx.roleId) ? "support" : "dps"
  const pvp = ctx.mode !== "PvE"
  const mass = ctx.mode === "Массовое PvP"
  const boss = !/Фарм/.test(ctx.variant)
  const rows: GuideRow[] = []
  for (const stat of stats) {
    const tier = speciesGrade(stat, { role, pvp, mass, boss, className: ctx.className })
    if (tier === "S" || tier === "A") rows.push({ title: stat, tier, why: "" })
  }
  return rows
}

function speciesGrade(stat: string, ctx: { role: string; pvp: boolean; mass: boolean; boss: boolean; className: string }): SkillTier {
  const { role, pvp, mass, boss, className } = ctx
  if (/^(Cogni|Fera|Natura|Varian) /.test(stat)) return "C"
  if (/Boss|PvE/.test(stat) && pvp) return "C"
  if (stat === "Boss Attack" && !boss) return "C"
  if (role === "heal" || role === "tank") {
    if (["HP increase", "Damage Tolerance", "PvE Damage Tolerance", "Endurance"].includes(stat)) return "S"
    if (stat === "Status Effect Resist") return pvp ? "S" : "A"
    if (["HP", "Defense Bonus", "Critical Hit Resist"].includes(stat)) return "A"
    if (stat === "Block") return role === "tank" ? "S" : "B"
    if (stat === "MP") return role === "heal" ? "A" : "C"
    if (["Attack Bonus", "Accuracy Bonus"].includes(stat)) return role === "tank" ? "B" : "C"
    return "C"
  }
  if (["Damage Boost", "PvE Damage Boost", "Weapon Damage Boost", "Attack Bonus"].includes(stat)) return role === "support" ? "A" : "S"
  if (stat === "Accuracy Bonus") return pvp ? "S" : "A"
  if (stat === "Status Effect Resist") return pvp ? "S" : "B"
  if (stat === "Status Effect Chance") return pvp && ["Sorcerer", "Spiritmaster", "Templar"].includes(className) ? "S" : pvp ? "A" : "C"
  if (["Damage Tolerance", "HP increase"].includes(stat)) return mass || role === "support" ? "S" : pvp ? "A" : "B"
  if (["Critical Hit", "Critical Damage Boost", "Boss Attack"].includes(stat)) return "A"
  if (stat === "Back Attack") return className === "Assassin" ? "A" : "B"
  if (["HP", "PvE Attack", "Critical Hit Resist", "PvE Damage Tolerance", "Endurance"].includes(stat)) return pvp || role === "support" ? "A" : "B"
  return "B"
}

function macroRows(raw: unknown): GuideMacro[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const macro = item as { title?: string; chains?: { name?: string }[][] }
    const chain = (macro.chains ?? []).map((step) => step.map((part) => part.name).filter(Boolean).join(" → ")).filter(Boolean).join(" / ")
    return { title: text(macro.title), chain }
  }).filter((macro) => macro.title || macro.chain)
}

function tipRows(raw: unknown): GuideTip[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const tip = item as { title?: string; action?: string; condition?: string }
    return { title: text(tip.title), action: text(tip.action), condition: text(tip.condition) }
  }).filter((tip) => tip.title || tip.action)
}

function englishRows(rows: GuideRow[] | undefined, previous: GuideRow[] | undefined): GuideRow[] {
  return (rows ?? []).map((row) => {
    const prior = previous?.find((item) => item.title === row.title) ?? previous?.find((item) => item.title === englishText(row.title, ""))
    return {
      ...row,
      title: englishText(row.title, prior?.title || row.title),
      why: englishText(row.why, prior?.why ?? ""),
      detail: englishText(row.detail ?? "", prior?.detail ?? ""),
      slot: englishText(row.slot ?? "", prior?.slot ?? ""),
    }
  })
}

function englishMacro(macro: GuideMacro, previous: GuideMacro | undefined): GuideMacro {
  return { title: englishText(macro.title, previous?.title || macro.title), chain: macro.chain }
}

function englishTip(tip: GuideTip, previous: GuideTip | undefined): GuideTip {
  return {
    title: englishText(tip.title, previous?.title || tip.title),
    action: englishText(tip.action, previous?.action || tip.action),
    condition: englishText(tip.condition, previous?.condition || tip.condition),
  }
}

function tierOf(value: unknown): SkillTier {
  return TIERS.has(value as SkillTier) ? value as SkillTier : "?"
}

function englishText(value: string, previous: string): string {
  const translated = translatePhrase(value)
  if (translated != null && !CYRILLIC.test(translated)) return translated
  if (previous && !CYRILLIC.test(previous)) return previous
  return value
}

function slugSituation(variant: string, index: number): string {
  const translated = translatePhrase(variant)
  const source = translated && !CYRILLIC.test(translated) ? translated : variant
  const slug = source.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  return slug || `extra-${index}`
}

function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : []
}

function readCache(storage: GuideStore): GuideCache | null {
  try {
    const parsed = JSON.parse(storage.getItem(GUIDE_STORAGE_KEY) ?? "") as GuideCache
    if (!parsed || typeof parsed.fetchedAt !== "number" || !parsed.book) return null
    return parsed
  } catch {
    return null
  }
}
