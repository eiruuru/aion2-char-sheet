export const VIDEO_STORAGE_KEY = "aion2-videos-v1"
export const VIDEO_REFRESH_MS = 12 * 60 * 60 * 1000
const VIDEO_LIMIT = 8

const CLASS_ALIASES: Record<string, string> = {
  elementalist: "Spiritmaster",
}

const HANGUL = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/
const TRADITIONAL = /[臺灣麵體廣麼這還對開關電發經與為從點戰鬥龍獸裝備門東車書長國]/
const OTHER_CLIENT = /\b(kr|korea|taiwan)\b|한국|대만|台灣|臺灣|韓服|台服/i
const GLOBAL_TITLE = /\b(global|na|eu)\b/i

export type VideoHit = {
  id: string
  title: string
  channel: string
  thumbnail: string
}

export type VideoList = {
  query: string
  fetchedAt: number
  videos: VideoHit[]
}

export type VideoLoad = {
  videos: VideoHit[]
  failed: boolean
  fetchedAt: number | null
}

type VideoStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

type VideoCache = { lists: Record<string, VideoList> }

export function classSearchName(className: string): string {
  const trimmed = className.trim()
  return CLASS_ALIASES[trimmed.toLowerCase()] ?? trimmed
}

export function videoQuery(kind: "class" | "general", className: string): string {
  if (kind === "general") return "Aion 2 global guide"
  return `Aion 2 ${classSearchName(className)} guide`
}

export function videoSearchPath(query: string): string {
  const params = new URLSearchParams({ search_query: query, hl: "en", gl: "US" })
  return `/youtube/results?${params.toString()}`
}

export function videosAreFresh(entry: { fetchedAt: number }, now: number): boolean {
  return now - entry.fetchedAt < VIDEO_REFRESH_MS
}

export function rejectsGlobal(title: string): boolean {
  return HANGUL.test(title) || TRADITIONAL.test(title) || OTHER_CLIENT.test(title)
}

export function prefersGlobal(title: string): boolean {
  return GLOBAL_TITLE.test(title)
}

export function selectVideos(hits: VideoHit[]): VideoHit[] {
  const kept: VideoHit[] = []
  const seen = new Set<string>()
  for (const hit of hits) {
    if (!hit.id || seen.has(hit.id) || rejectsGlobal(hit.title)) continue
    seen.add(hit.id)
    kept.push(hit)
  }
  return kept
    .map((video, index) => ({ video, index, preferred: prefersGlobal(video.title) ? 0 : 1 }))
    .sort((a, b) => a.preferred - b.preferred || a.index - b.index)
    .slice(0, VIDEO_LIMIT)
    .map((item) => item.video)
}

export function parseSearchHtml(html: string): VideoHit[] {
  const data = extractInitialData(html)
  if (!data) return []
  const hits: VideoHit[] = []
  walk(data, hits)
  return hits
}

export async function loadVideos(
  kind: "class" | "general",
  className: string,
  storage: VideoStore,
  now = Date.now(),
  force = false,
  fetchImpl: typeof fetch = fetch,
): Promise<VideoLoad> {
  const query = videoQuery(kind, className)
  const key = kind === "general" ? "general" : `class:${classSearchName(className).toLowerCase()}`
  const cached = readCache(storage).lists[key] ?? null
  const sameQuery = cached?.query === query
  if (!force && sameQuery && cached && videosAreFresh(cached, now)) {
    return { videos: cached.videos, failed: false, fetchedAt: cached.fetchedAt }
  }
  try {
    const response = await fetchImpl(videoSearchPath(query), { headers: { Accept: "text/html" }, cache: "no-store" })
    if (!response.ok) return failed(cached)
    const parsed = selectVideos(parseSearchHtml(await response.text()))
    if (!parsed.length) return failed(cached)
    const entry: VideoList = { query, fetchedAt: now, videos: parsed }
    writeList(storage, key, entry)
    return { videos: parsed, failed: false, fetchedAt: now }
  } catch {
    return failed(cached)
  }
}

function failed(cached: VideoList | null): VideoLoad {
  return { videos: cached?.videos ?? [], failed: true, fetchedAt: cached?.fetchedAt ?? null }
}

function readCache(storage: VideoStore): VideoCache {
  try {
    const parsed = JSON.parse(storage.getItem(VIDEO_STORAGE_KEY) ?? "") as VideoCache
    if (!parsed || typeof parsed !== "object" || !parsed.lists) return { lists: {} }
    return parsed
  } catch {
    return { lists: {} }
  }
}

function writeList(storage: VideoStore, key: string, entry: VideoList): void {
  const cache = readCache(storage)
  cache.lists[key] = entry
  storage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(cache))
}

function extractInitialData(html: string): unknown {
  const marker = html.indexOf("ytInitialData")
  if (marker < 0) return null
  const start = html.indexOf("{", marker)
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let index = start; index < html.length; index += 1) {
    const char = html[index]
    if (inString) {
      if (escape) escape = false
      else if (char === "\\") escape = true
      else if (char === "\"") inString = false
      continue
    }
    if (char === "\"") inString = true
    else if (char === "{") depth += 1
    else if (char === "}") {
      depth -= 1
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, index + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function walk(node: unknown, hits: VideoHit[]): void {
  if (!node || typeof node !== "object") return
  if (Array.isArray(node)) {
    for (const item of node) walk(item, hits)
    return
  }
  const record = node as Record<string, unknown>
  if (record.videoRenderer && typeof record.videoRenderer === "object") {
    const hit = fromRenderer(record.videoRenderer as Record<string, unknown>)
    if (hit) hits.push(hit)
  }
  for (const value of Object.values(record)) walk(value, hits)
}

function fromRenderer(renderer: Record<string, unknown>): VideoHit | null {
  const id = typeof renderer.videoId === "string" ? renderer.videoId : ""
  const title = textOf(renderer.title)
  const channel = textOf(renderer.ownerText)
  if (!id || !title) return null
  return {
    id,
    title,
    channel,
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  }
}

function textOf(value: unknown): string {
  if (!value || typeof value !== "object") return ""
  const record = value as { simpleText?: unknown; runs?: { text?: unknown }[] }
  if (typeof record.simpleText === "string") return record.simpleText
  const run = record.runs?.find((item) => typeof item?.text === "string")
  return typeof run?.text === "string" ? run.text : ""
}
