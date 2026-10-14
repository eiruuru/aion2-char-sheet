import { useState, type FormEvent } from "react"
import type { RegionId, SearchHit } from "../api/types"
import { REGIONS } from "../api/types"
import { searchCharacters } from "../api/client"
import { factionName, serversFor } from "../api/serverList"

export function AddCharacter({
  onAdd,
}: {
  onAdd: (hit: SearchHit, region: RegionId) => void
}) {
  const [region, setRegion] = useState<RegionId>("nae")
  const [serverId, setServerId] = useState<number | "">("")
  const [keyword, setKeyword] = useState("")
  const [hits, setHits] = useState<SearchHit[]>([])
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function onSearch(event: FormEvent) {
    event.preventDefault()
    if (keyword.trim().length < 1) return
    setBusy(true)
    setError("")
    try {
      const results = await searchCharacters({
        keyword,
        region,
        serverId: serverId === "" ? undefined : serverId,
      })
      setHits(results)
      if (!results.length) setError("No characters matched that name in this region.")
    } catch (caught) {
      setHits([])
      setError(caught instanceof Error ? caught.message : "Search failed")
    } finally {
      setBusy(false)
    }
  }

  const servers = serversFor(region)

  return (
    <form className="panel" onSubmit={onSearch}>
      <h2>Add a character</h2>
      <label>
        Region
        <select
          value={region}
          onChange={(event) => {
            setRegion(event.target.value as RegionId)
            setServerId("")
          }}
        >
          {REGIONS.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </label>
      <label>
        Server
        <select
          value={serverId}
          onChange={(event) => setServerId(event.target.value ? Number(event.target.value) : "")}
        >
          <option value="">All servers</option>
          {servers.map((server) => (
            <option key={server.serverId} value={server.serverId}>
              {server.serverName} · {factionName(server.raceId)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Name
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Character name" />
      </label>
      <button type="submit" disabled={busy || keyword.trim().length < 1}>
        {busy ? "Searching…" : "Search"}
      </button>
      {error ? <p className="error">{error}</p> : null}
      {hits.length ? (
        <ul className="hits">
          {hits.map((hit) => (
            <li key={`${hit.serverId}:${hit.characterId}`}>
              <button type="button" onClick={() => onAdd(hit, region)}>
                <strong>{hit.name}</strong>
                <span>Lv {hit.level} · {hit.serverName}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  )
}
