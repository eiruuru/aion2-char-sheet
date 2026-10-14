import { useEffect, useRef, useState, type FormEvent } from "react"
import type { RegionId, SearchHit } from "../api/types"
import { REGIONS } from "../api/types"
import { loadPlayClasses, searchCharacters } from "../api/client"
import type { PlayClass } from "../api/classes"
import { factionName, serversFor } from "../api/serverList"

export function AddCharacter({
  onAdd,
  focusToken,
}: {
  onAdd: (hit: SearchHit, region: RegionId) => void
  focusToken: number
}) {
  const nameRef = useRef<HTMLInputElement>(null)
  const hitsRef = useRef<HTMLUListElement>(null)
  const [region, setRegion] = useState<RegionId>("nae")
  const [serverId, setServerId] = useState<number | "">("")
  const [keyword, setKeyword] = useState("")
  const [hits, setHits] = useState<SearchHit[]>([])
  const [page, setPage] = useState(1)
  const [endPage, setEndPage] = useState(1)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [classes, setClasses] = useState<Map<number, PlayClass>>(() => new Map())

  useEffect(() => {
    nameRef.current?.focus()
  }, [focusToken])

  useEffect(() => {
    let live = true
    loadPlayClasses().then((loaded) => {
      if (live) setClasses(loaded)
    }).catch(() => {})
    return () => {
      live = false
    }
  }, [])

  async function runSearch(nextPage: number) {
    if (keyword.trim().length < 1) return
    setBusy(true)
    setError("")
    try {
      const results = await searchCharacters({
        keyword,
        region,
        serverId: serverId === "" ? undefined : serverId,
        page: nextPage,
      })
      setHits(results.hits)
      setPage(results.page)
      setEndPage(results.endPage)
      if (hitsRef.current) hitsRef.current.scrollTop = 0
      if (!results.hits.length) setError("No characters matched that name in this region.")
    } catch (caught) {
      setHits([])
      setPage(1)
      setEndPage(1)
      setError(caught instanceof Error ? caught.message : "Search failed")
    } finally {
      setBusy(false)
    }
  }

  function onSearch(event: FormEvent) {
    event.preventDefault()
    void runSearch(1)
  }

  const servers = serversFor(region)

  return (
    <form className="panel add-card" onSubmit={onSearch}>
      <div className="add-fields">
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
          <input
            ref={nameRef}
            autoComplete="off"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Character name"
          />
        </label>
        <button type="submit" disabled={busy || keyword.trim().length < 1}>
          {busy ? "Searching…" : "Search"}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </div>
      {hits.length ? (
        <ul className="hits" ref={hitsRef}>
          {hits.map((hit) => {
            const playClass = classes.get(hit.pcId)
            return (
              <li key={`${hit.serverId}:${hit.characterId}`}>
                <button type="button" onClick={() => onAdd(hit, region)}>
                  {playClass ? <img className="hit-class" src={playClass.icon} alt="" /> : null}
                  <span className="hit-copy">
                    <strong>{hit.name}</strong>
                    <span>{playClass ? `${playClass.name} · ` : ""}Lv {hit.level} · {hit.serverName}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
      {hits.length && endPage > 1 ? (
        <div className="pager">
          <button type="button" disabled={busy || page <= 1} onClick={() => void runSearch(page - 1)}>Previous</button>
          <span className="muted">{page} / {endPage}</span>
          <button type="button" disabled={busy || page >= endPage} onClick={() => void runSearch(page + 1)}>Next</button>
        </div>
      ) : null}
    </form>
  )
}
