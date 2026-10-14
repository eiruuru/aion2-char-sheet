import type { CharacterRecord } from "../model/store"
import { formatNumber } from "../model/format"
import { odyleCap, projectOdyle } from "../model/odyle"

export function RosterList({
  characters,
  selectedId,
  membership,
  now,
  onSelect,
}: {
  characters: CharacterRecord[]
  selectedId: string | null
  membership: boolean
  now: number
  onSelect: (id: string) => void
}) {
  const cap = odyleCap(membership)
  if (!characters.length) {
    return <p className="muted">Search a name to pin your main and alts.</p>
  }
  return (
    <ul className="roster">
      {characters.map((character) => {
        const projection = character.odyle ? projectOdyle(character.odyle, cap, now) : null
        return (
          <li key={character.id}>
            <button
              type="button"
              className={character.id === selectedId ? "roster-item selected" : "roster-item"}
              onClick={() => onSelect(character.id)}
            >
              {character.latest?.portrait ? (
                <img className="portrait" src={character.latest.portrait} alt="" />
              ) : null}
              <span className="roster-copy">
                <span className="roster-top">
                  <strong>{character.name}</strong>
                  <span className={character.role === "main" ? "tag main" : "tag"}>{character.role}</span>
                  {projection?.full ? <span className="tag warn">{projection.aboveCap ? "Above cap" : "Capping"}</span> : null}
                </span>
                <span className="muted">
                  {character.className || "Class pending"} · Lv {character.latest?.level ?? "—"} · {character.serverName}
                  {character.latest ? ` · CP ${formatNumber(character.latest.combatPower)}` : ""}
                  {projection ? ` · Odyle ${formatNumber(projection.current)}/${formatNumber(projection.cap)}` : ""}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
