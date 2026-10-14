import { formatWhen } from "./format"
import type { SkillPoint } from "./snapshot"

export const GUIDE_STORAGE_KEY = "aion2-guides-v1"
export const GUIDE_DAY_MS = 24 * 60 * 60 * 1000

const VAULT_ORIGIN = "https://aion2vault.com"
const VAULT_PAGES: Record<string, string> = {
  cleric: "/builds/cleric/pve/",
  gladiator: "/builds/gladiator/pve/",
  ranger: "/builds/ranger/pve/",
  templar: "/builds/templar/pve/",
  assassin: "/builds/assassin/pve/",
  sorcerer: "/builds/sorcerer/pve/",
  chanter: "/builds/chanter/pve/",
  spiritmaster: "/builds/spiritmaster/pve/",
}

const CLASS_ALIASES: Record<string, string> = {
  elementalist: "spiritmaster",
}

export type GuideSummary = {
  classKey: string
  title: string
  url: string
  stigmas: string[]
  skills: { name: string; target: number }[]
  fetchedAt: number
}

export type GuideLine = {
  id: string
  title: string
  detail: string
  href: string
  linkLabel: string
}

type GuideStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

type GuideCache = { entries: Record<string, GuideSummary> }

export function guideSource(className: string): { classKey: string; url: string; proxyPath: string } | null {
  const raw = className.trim().toLowerCase()
  const classKey = CLASS_ALIASES[raw] ?? raw
  const path = VAULT_PAGES[classKey]
  if (!path) return null
  return { classKey, url: `${VAULT_ORIGIN}${path}`, proxyPath: `/guide-vault${path}` }
}

export function guideIsFresh(entry: GuideSummary, now: number): boolean {
  return now - entry.fetchedAt < GUIDE_DAY_MS
}

export function readGuideCache(storage: GuideStore): GuideCache {
  try {
    const parsed = JSON.parse(storage.getItem(GUIDE_STORAGE_KEY) ?? "") as GuideCache
    if (!parsed || typeof parsed !== "object" || !parsed.entries) return { entries: {} }
    return parsed
  } catch {
    return { entries: {} }
  }
}

export function writeGuideEntry(storage: GuideStore, entry: GuideSummary): void {
  const cache = readGuideCache(storage)
  cache.entries[entry.classKey] = entry
  storage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(cache))
}

export function parseGuideHtml(html: string, knownNames: string[], url: string): Omit<GuideSummary, "classKey" | "fetchedAt"> | null {
  const tables = htmlTables(html)
  const stigmas = stigmaColumn(tables, knownNames) ?? stigmaSummary(tables, knownNames)
  if (!stigmas || stigmas.length < 2) return null
  return {
    title: pageTitle(html),
    url,
    stigmas,
    skills: skillTargets(tables, knownNames),
  }
}

export function guideLines(
  skills: SkillPoint[] | undefined,
  guide: GuideSummary | null,
  className: string,
): GuideLine[] {
  if (!skills?.length || !guide || guide.stigmas.length < 2) return []
  const lines: GuideLine[] = []
  const knowsEquip = skills.some((skill) => typeof skill.equipped === "boolean")
  const stigmas = skills.filter((skill) => skill.category === "Dp")
  if (knowsEquip && stigmas.length) {
    const equipped = stigmas.filter((skill) => skill.equipped)
    const extras = equipped.filter((skill) => !guide.stigmas.some((name) => sameName(name, skill.name)))
    const missing = guide.stigmas.filter((name) => !equipped.some((skill) => sameName(skill.name, name)))
    const link = { href: guide.url, linkLabel: guide.title }
    if (!extras.length && !missing.length && equipped.length) {
      lines.push({
        id: "guide-stigmas",
        title: "Stigmas match the guide",
        detail: `Equipped stigmas match the ${className} guide. Checked ${formatWhen(guide.fetchedAt)}.`,
        ...link,
      })
    } else if (!equipped.length) {
      lines.push({
        id: "guide-stigmas",
        title: "No stigma is equipped",
        detail: `The ${className} guide uses ${nameList(guide.stigmas)}.`,
        ...link,
      })
    } else if (extras.length) {
      lines.push({
        id: "guide-stigmas",
        title: extras.length === 1 ? `${extras[0].name} is not in the ${className} guide` : `${extras.length} stigmas are not in the ${className} guide`,
        detail: `${equippedPhrase(extras)} The guide uses ${nameList(guide.stigmas)}.`,
        ...link,
      })
    } else {
      lines.push({
        id: "guide-stigmas",
        title: missing.length === 1 ? `${missing[0]} is not equipped` : "Equipped stigmas differ from the guide",
        detail: `The ${className} guide uses ${nameList(guide.stigmas)}. Equipped now: ${equipped.map((skill) => `${skill.name} (${skill.level})`).join(", ")}.`,
        ...link,
      })
    }
  }
  const skillLine = skillGap(skills, guide)
  if (skillLine) {
    lines.push({
      id: "guide-skill",
      title: `${skillLine.name} is below the guide`,
      detail: `${skillLine.name} is ${skillLine.level}. The guide aims for ${skillLine.target}.`,
      href: guide.url,
      linkLabel: guide.title,
    })
  }
  return lines
}

export async function loadClassGuide(
  className: string,
  knownNames: string[],
  storage: GuideStore,
  now = Date.now(),
  fetchImpl: typeof fetch = fetch,
): Promise<GuideSummary | null> {
  const source = guideSource(className)
  if (!source) return null
  const current = readGuideCache(storage).entries[source.classKey] ?? null
  if (current && guideIsFresh(current, now)) return current
  try {
    const response = await fetchImpl(source.proxyPath, { headers: { Accept: "text/html" }, cache: "no-store" })
    if (!response.ok) return current
    const parsed = parseGuideHtml(await response.text(), knownNames, source.url)
    if (!parsed) return current
    const entry: GuideSummary = { ...parsed, classKey: source.classKey, fetchedAt: now }
    writeGuideEntry(storage, entry)
    return entry
  } catch {
    return current
  }
}

function skillGap(skills: SkillPoint[], guide: GuideSummary): { name: string; level: number; target: number } | null {
  let best: { name: string; level: number; target: number; gap: number } | null = null
  for (const item of guide.skills) {
    const skill = skills.find((candidate) => candidate.acquired && sameName(candidate.name, item.name))
    if (!skill) continue
    const gap = item.target - skill.level
    if (gap <= 0) continue
    if (!best || gap > best.gap) best = { name: skill.name, level: skill.level, target: item.target, gap }
  }
  return best
}

function equippedPhrase(skills: SkillPoint[]): string {
  if (skills.length === 1) return `${skills[0].name} is equipped at ${skills[0].level}.`
  const last = skills[skills.length - 1]
  const rest = skills.slice(0, -1).map((skill) => `${skill.name} at ${skill.level}`)
  return `${rest.join(", ")} and ${last.name} at ${last.level} are equipped.`
}

function nameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ""
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`
}

function sameName(a: string, b: string): boolean {
  return normalize(a) === normalize(b)
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim()
}

function pageTitle(html: string): string {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i)
  return match ? decodeText(match[1]) : "Class guide"
}

function stigmaColumn(tables: string[][][], knownNames: string[]): string[] | null {
  for (const table of tables) {
    const col = (table[0] ?? []).findIndex((cell) => cell.toLowerCase() === "stigmas")
    if (col < 0) continue
    const names = namesIn(table[1]?.[col] ?? "", knownNames)
    if (names.length >= 3) return names.slice(0, 4)
  }
  return null
}

function stigmaSummary(tables: string[][][], knownNames: string[]): string[] | null {
  for (const table of tables) {
    for (const row of table) {
      if (row[0]?.toLowerCase() !== "stigmas") continue
      let best: string[] = []
      for (const cell of row.slice(1)) {
        const names = namesIn(cell.split(/\bplus\b/i)[0], knownNames)
        if (names.length > best.length) best = names
      }
      if (best.length >= 2) return best.slice(0, 4)
    }
  }
  return null
}

function skillTargets(tables: string[][][], knownNames: string[]): { name: string; target: number }[] {
  const targets: { name: string; target: number }[] = []
  for (const table of tables) {
    if (table[0]?.[0]?.toLowerCase() !== "skill") continue
    for (const row of table.slice(1)) {
      const name = namesIn(row[0] ?? "", knownNames)[0]
      if (!name || !sameName(name, row[0] ?? "")) continue
      let target: number | null = null
      for (const cell of row.slice(1)) {
        const match = cell.match(/^(\d{1,2})\b/)
        if (match) target = Number(match[1])
      }
      if (target == null || target <= 0 || target > 20) continue
      if (!targets.some((item) => sameName(item.name, name))) targets.push({ name, target })
    }
  }
  return targets
}

function namesIn(text: string, knownNames: string[]): string[] {
  let hay = ` ${normalize(text)} `
  const found: { index: number; name: string }[] = []
  const ordered = [...knownNames].sort((a, b) => normalize(b).length - normalize(a).length)
  for (const name of ordered) {
    const needle = normalize(name)
    if (needle.length < 3) continue
    const index = hay.indexOf(needle)
    if (index < 0) continue
    found.push({ index, name })
    hay = `${hay.slice(0, index)}${" ".repeat(needle.length)}${hay.slice(index + needle.length)}`
  }
  found.sort((a, b) => a.index - b.index)
  return found.map((item) => item.name)
}

function htmlTables(html: string): string[][][] {
  const blocks = html.match(/<table[\s\S]*?<\/table>/gi) ?? []
  return blocks.map((block) => {
    const rows = block.match(/<tr[\s\S]*?<\/tr>/gi) ?? []
    return rows
      .map((row) => (row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map(decodeText))
      .filter((row) => row.some(Boolean))
  })
}

function decodeText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&#8217;|&rsquo;|’/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}
