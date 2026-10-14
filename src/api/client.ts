import type {
  CharacterInfo,
  DaevanionDetail,
  EquipmentResponse,
  RegionId,
  SearchHit,
} from "./types"

const SEARCH_BASE = "/nc-search/aion2global/search/v2/character"
const INFO_BASE = "/nc-aion/api/character/info"
const EQUIP_BASE = "/nc-aion/api/character/equipment"
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

export async function searchCharacters(input: {
  keyword: string
  region: RegionId
  serverId?: number
}): Promise<SearchHit[]> {
  const data = await getJson<{ list: SearchHit[] }>(SEARCH_BASE, {
    keyword: input.keyword.trim(),
    region: input.region,
    localeInfo: "en-US",
    serverId: input.serverId,
    page: 1,
    size: 20,
    sort: "level",
  })
  return (data.list ?? []).map((hit) => ({
    ...hit,
    characterId: normalizeCharacterId(hit.characterId),
    name: plainName(hit.name),
    region: hit.region || input.region,
  }))
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
