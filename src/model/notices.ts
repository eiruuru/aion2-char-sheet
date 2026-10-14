import { BOSS_SOON_MS, type SessionItem } from "./checklist"
import { formatCountdown } from "./format"
import { dailyKey, type BossTimer } from "./schedule"

export const NOTICE_STORAGE_KEY = "aion2-notices-v1"

export type DueNotice = {
  key: string
  title: string
  body: string
}

type NoticeStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function dueNotices(items: SessionItem[], bosses: BossTimer[], now: number): DueNotice[] {
  const day = dailyKey(now)
  const notices: DueNotice[] = []
  for (const item of items) {
    if (item.band !== "lost" || item.characterId == null) continue
    notices.push({
      key: `${item.id}|${day}`,
      title: item.taskName,
      body: [item.characterName, item.detail].filter(Boolean).join(". "),
    })
  }
  for (const boss of bosses) {
    const left = boss.at - now
    if (left <= 0 || left > BOSS_SOON_MS) continue
    notices.push({
      key: `${boss.id}|${boss.at}`,
      title: boss.name,
      body: `Spawns in ${formatCountdown(left)}.`,
    })
  }
  return notices
}

export function pendingNotices(notices: DueNotice[], storage: NoticeStore): DueNotice[] {
  const seen = readSeen(storage)
  return notices.filter((notice) => !seen.has(notice.key))
}

export function rememberNotices(notices: DueNotice[], storage: NoticeStore): void {
  const seen = readSeen(storage)
  for (const notice of notices) seen.add(notice.key)
  storage.setItem(NOTICE_STORAGE_KEY, JSON.stringify([...seen].slice(-200)))
}

function readSeen(storage: NoticeStore): Set<string> {
  try {
    const parsed = JSON.parse(storage.getItem(NOTICE_STORAGE_KEY) ?? "")
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((item) => typeof item === "string"))
  } catch {
    return new Set()
  }
}
