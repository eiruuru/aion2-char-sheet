import { playClassesFrom, type PcClassRow, type PlayClass } from "./classes"
import type {
  CharacterInfo,
  DaevanionDetail,
  EquipmentItemDetail,
  EquipmentResponse,
  RegionId,
  SearchHit,
} from "./types"

const SEARCH_BASE = "/nc-search/aion2global/search/v2/character"
const INFO_BASE = "/nc-aion/api/character/info"
const EQUIP_BASE = "/nc-aion/api/character/equipment"
const ITEM_BASE = "/nc-aion/api/character/equipment/item"
const BOARD_BASE = "/nc-aion/api/character/daevanion/detail"

export function normalizeCharacterId(id: string): string {
  try {
    return decodeURIComponent(id)
  } catch {
    return id
  }
}

export function plainName(name: string): string {
  return name.replace(/<[^>]+>/g, "").trim()
}

async function getJson<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue
    query.set(key, String(value))
  }
  const response = await fetch(`${path}?${query.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error(`Aion 2 request failed (${response.status})`)
  }
  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error("Aion 2 returned a page instead of character data")
  }
}

export const SEARCH_PAGE_SIZE = 10

export type SearchPage = {
  hits: SearchHit[]
  page: number
  total: number
  endPage: number
}

let playClasses: Promise<Map<number, PlayClass>> | null = null

export function loadPlayClasses(): Promise<Map<number, PlayClass>> {
  if (!playClasses) {
    playClasses = getJson<{ pcDataList?: PcClassRow[] }>("/nc-aion/api/gameinfo/pcdata", { lang: "en" })
      .then((data) => playClassesFrom(data.pcDataList ?? []))
      .catch((error) => {
        playClasses = null
        throw error
      })
  }
  return playClasses
}

export async function searchCharacters(input: {
  keyword: string
  region: RegionId
  serverId?: number
  page?: number
}): Promise<SearchPage> {
  const page = input.page ?? 1
  const data = await getJson<{ list?: SearchHit[]; pagination?: { page?: number; total?: number; endPage?: number } }>(SEARCH_BASE, {
    keyword: input.keyword.trim(),
    region: input.region,
    localeInfo: "en-US",
    serverId: input.serverId,
    page,
    size: SEARCH_PAGE_SIZE,
  })
  const hits = (data.list ?? []).map((hit) => ({
    ...hit,
    characterId: normalizeCharacterId(hit.characterId),
    name: plainName(hit.name),
    region: hit.region || input.region,
  }))
  return {
    hits,
    page: data.pagination?.page ?? page,
    total: data.pagination?.total ?? hits.length,
    endPage: Math.max(1, data.pagination?.endPage ?? 1),
  }
}

export async function fetchCharacterInfo(
  region: RegionId,
  serverId: number,
  characterId: string,
): Promise<CharacterInfo> {
  return getJson<CharacterInfo>(INFO_BASE, {
    lang: "en-US",
    region,
    serverId,
    characterId: normalizeCharacterId(characterId),
  })
}

export async function fetchEquipment(
  region: RegionId,
  serverId: number,
  characterId: string,
): Promise<EquipmentResponse> {
  return getJson<EquipmentResponse>(EQUIP_BASE, {
    lang: "en-US",
    region,
    serverId,
    characterId: normalizeCharacterId(characterId),
  })
}

export async function fetchEquipmentItem(
  region: RegionId,
  serverId: number,
  characterId: string,
  item: { id: number; enchant: number; slotPos: number },
): Promise<EquipmentItemDetail> {
  return getJson<EquipmentItemDetail>(ITEM_BASE, {
    id: item.id,
    enchantLevel: item.enchant,
    characterId: normalizeCharacterId(characterId),
    serverId,
    slotPos: item.slotPos,
    lang: "en-US",
    region,
  })
}

export async function fetchBoardDetail(
  region: RegionId,
  serverId: number,
  characterId: string,
  boardId: number,
): Promise<DaevanionDetail> {
  return getJson<DaevanionDetail>(BOARD_BASE, {
    lang: "en-US",
    region,
    serverId,
    characterId: normalizeCharacterId(characterId),
    boardId,
  })
}

export async function loadPublicProfile(region: RegionId, serverId: number, characterId: string) {
  const [info, equipment] = await Promise.all([
    fetchCharacterInfo(region, serverId, characterId),
    fetchEquipment(region, serverId, characterId),
  ])
  const openBoards = info.daevanion.boardList.filter((board) => board.open === 1)
  const details = await Promise.all(
    openBoards.map(async (board) => {
      try {
        const detail = await fetchBoardDetail(region, serverId, characterId, board.id)
        return { board, detail }
      } catch {
        return { board, detail: null }
      }
    }),
  )
  return { info, equipment, details }
}
