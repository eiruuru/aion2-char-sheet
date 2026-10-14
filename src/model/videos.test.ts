import { describe, expect, it } from "vitest"
import {
  VIDEO_REFRESH_MS,
  classSearchName,
  loadVideos,
  parseSearchHtml,
  prefersGlobal,
  rejectsGlobal,
  selectVideos,
  videoQuery,
  videosAreFresh,
  type VideoHit,
} from "./videos"

const PAGE = `
<script>
ytInitialData = ${JSON.stringify({
  contents: {
    sectionListRenderer: {
      contents: [
        { videoRenderer: renderer("kr1", "아이온2 클레릭 공략", "KR Channel") },
        { videoRenderer: renderer("tw1", "Aion 2 台灣 牧師攻略", "TW Channel") },
        { videoRenderer: renderer("late", "Aion 2 Cleric rotation", "Late Channel") },
        { videoRenderer: renderer("na1", "Aion 2 Cleric guide NA", "NA Channel") },
        { videoRenderer: renderer("named", "Aion 2 Cleric guide Korea server", "Named Channel") },
      ],
    },
  },
})};
</script>
`

function renderer(id: string, title: string, channel: string) {
  return {
    videoId: id,
    title: { runs: [{ text: title }] },
    ownerText: { runs: [{ text: channel }] },
  }
}

function memory() {
  const saved = new Map<string, string>()
  return {
    saved,
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => { saved.set(key, value) },
  }
}

describe("video search", () => {
  it("searches the class guide and uses the Spiritmaster alias", () => {
    expect(videoQuery("class", "Cleric")).toBe("Aion 2 Cleric guide")
    expect(classSearchName("Elementalist")).toBe("Spiritmaster")
    expect(videoQuery("class", "Elementalist")).toBe("Aion 2 Spiritmaster guide")
    expect(videoQuery("general", "Cleric")).toBe("Aion 2 global guide")
  })

  it("keeps Global videos and lists a Global, NA, or EU title first", () => {
    expect(rejectsGlobal("아이온2 클레릭 공략")).toBe(true)
    expect(rejectsGlobal("Aion 2 台灣 牧師攻略")).toBe(true)
    expect(rejectsGlobal("Aion 2 Cleric guide Korea server")).toBe(true)
    expect(rejectsGlobal("Aion 2 Cleric guide")).toBe(false)
    expect(prefersGlobal("Aion 2 Cleric guide NA")).toBe(true)
    const hits = selectVideos(parseSearchHtml(PAGE))
    expect(hits.map((hit) => hit.id)).toEqual(["na1", "late"])
    expect(hits[0].channel).toBe("NA Channel")
    expect(hits[0].thumbnail).toBe("https://i.ytimg.com/vi/na1/hqdefault.jpg")
  })

  it("reuses a list for 12 hours and keeps it when a check fails", async () => {
    const now = Date.parse("2026-10-15T00:00:00.000Z")
    const store = memory()
    const hit: VideoHit = { id: "ok", title: "Aion 2 global guide", channel: "Guides", thumbnail: "https://i.ytimg.com/vi/ok/hqdefault.jpg" }
    const html = `<script>ytInitialData = ${JSON.stringify({ videoRenderer: renderer(hit.id, hit.title, hit.channel) })};</script>`
    const first = await loadVideos("general", "", store, now, false, async () => new Response(html, { status: 200 }))
    expect(first.failed).toBe(false)
    expect(first.videos.map((video) => video.id)).toEqual(["ok"])
    expect(videosAreFresh({ fetchedAt: now }, now + VIDEO_REFRESH_MS - 1)).toBe(true)
    expect(videosAreFresh({ fetchedAt: now }, now + VIDEO_REFRESH_MS)).toBe(false)
    let calls = 0
    const cached = await loadVideos("general", "", store, now + 1000, false, async () => {
      calls += 1
      return new Response("", { status: 500 })
    })
    expect(calls).toBe(0)
    expect(cached.videos).toEqual(first.videos)
    const failed = await loadVideos("general", "", store, now + VIDEO_REFRESH_MS, false, async () => new Response("nope", { status: 503 }))
    expect(failed.failed).toBe(true)
    expect(failed.videos.map((video) => video.id)).toEqual(["ok"])
  })
})
