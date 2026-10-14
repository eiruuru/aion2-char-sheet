import type { RegionId } from "./types"
import { OFFICIAL_SERVERS, type OfficialServer } from "./servers"

export function serversFor(region: RegionId): OfficialServer[] {
  return OFFICIAL_SERVERS.filter((server) => server.region === region)
    .slice()
    .sort((a, b) => a.serverName.localeCompare(b.serverName) || a.raceId - b.raceId)
}

export function factionName(raceId: number): string {
  if (raceId === 1) return "Elyos"
  if (raceId === 2) return "Asmodian"
  return "Unknown"
}
