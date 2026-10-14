import { useEffect, useState } from "react"
import type { CharacterRecord } from "../model/store"
import { parseStoredNumber } from "../model/store"
import type { Suggestion } from "../model/suggestions"
import { boardRank, slotLabel } from "../model/suggestions"
import { formatCountdown, formatNumber, formatWhen, skillCategoryLabel } from "../model/format"
import { CUBE_COST, type OdyleProjection } from "../model/odyle"
import type { ChecklistRow, MarkOwner } from "../model/checklist"
import type { BoardPoint, GearPoint, SkillPoint, Snapshot } from "../model/snapshot"
import { Checklist } from "./Checklist"
import { GameIcon } from "./GameIcon"
import { Sparkline } from "./Sparkline"

const WEAPON_SLOTS = ["MainHand", "SubHand"]
const ARMOR_SLOTS = ["Torso", "Pants", "Helmet", "Shoulder", "Gloves", "Boots", "Cape"]
const ACCESSORY_SLOTS = ["Belt", "Necklace", "Earring1", "Earring2", "Ring1", "Ring2", "Bracelet1", "Bracelet2", "Amulet", "Rune1", "Rune2"]
const ARCANA_SLOTS = ["Arcana1", "Arcana2", "Arcana3", "Arcana4", "Arcana5"]
const COSMETIC_SLOTS = ["Shoulder", "MaceMain", "Pants", "Boots", "Helmet", "Cape", "Gloves", "Torso", "MainHand", "SubHand"]

const SLOT_DISPLAY: Record<string, string> = {
  MainHand: "Main Hand",
  SubHand: "Off-hand",
  Helmet: "Helmet",
  Shoulder: "Shoulders",
  Torso: "Torso",
  Pants: "Legs",
  Gloves: "Gloves",
  Boots: "Boots",
  Cape: "Cape",
  Belt: "Belt",
  Necklace: "Necklace",
  Earring1: "Earring 1",
  Earring2: "Earring 2",
  Ring1: "Ring 1",
  Ring2: "Ring 2",
  Bracelet1: "Bracelet 1",
  Bracelet2: "Bracelet 2",
  Amulet: "Amulet",
  Rune1: "Rune 1",
  Rune2: "Rune 2",
  Arcana1: "Arcana 1",
  Arcana2: "Arcana 2",
  Arcana3: "Arcana 3",
  Arcana4: "Arcana 4",
  Arcana5: "Arcana 5",
  MaceMain: "Mace",
}

const TABS: { id: TabId; label: string }[] = [
  { id: "checklist", label: "Checklist" },
  { id: "gear", label: "Gear" },
  { id: "skills", label: "Skills" },
  { id: "boards", label: "Daevanion" },
  { id: "advice", label: "Advice" },
]

type TabId = "checklist" | "gear" | "skills" | "boards" | "advice" | "cosmetics"

export function CharacterPanel({
  character,
  suggestions,
  projection,
  now,
  busy,
  onRefresh,
  onDelete,
  onSetMain,
  onSaveOdyle,
  onSetOdyleTimer,
  onSpendCube,
  checklistRows,
  names,
  roles,
  onChecklistBoxes,
  onChecklistBank,
}: {
  character: CharacterRecord
  suggestions: Suggestion[]
  projection: OdyleProjection | null
  now: number
  busy: boolean
  onRefresh: () => void
  onDelete: () => void
  onSetMain: () => void
  onSaveOdyle: (amount: number) => void
  onSetOdyleTimer: (remainingMs: number) => void
  onSpendCube: () => void
  checklistRows: ChecklistRow[]
  names: Record<string, string>
  roles: Record<string, "main" | "alt">
  onChecklistBoxes: (taskId: string, owners: MarkOwner[]) => void
  onChecklistBank: (taskId: string, value: number) => void
}) {
  const snapshot = character.latest
  const [tab, setTab] = useState<TabId>("checklist")
  const [boardId, setBoardId] = useState<number | null>(null)
  const [odyleDraft, setOdyleDraft] = useState(character.odyle ? String(character.odyle.amount) : "")
  const [hourDraft, setHourDraft] = useState("")
  const [minuteDraft, setMinuteDraft] = useState("")

  useEffect(() => {
    setOdyleDraft(character.odyle ? String(character.odyle.amount) : "")
    setBoardId(null)
    if (!projection?.nextTickAt) {
      setHourDraft("")
      setMinuteDraft("")
      return
    }
    const totalMinutes = Math.floor(Math.max(0, projection.nextTickAt - Date.now()) / 60000)
    setHourDraft(String(Math.floor(totalMinutes / 60)))
    setMinuteDraft(String(totalMinutes % 60))
  }, [character.id, character.odyle?.amount, character.odyle?.readAt, projection?.nextTickAt])

  const timerPaused = !projection || projection.full || projection.aboveCap || projection.nextTickAt == null
  const skins = snapshot?.skins ?? []
  const tabs = skins.length ? [...TABS, { id: "cosmetics" as const, label: "Cosmetics" }] : TABS
  const activeTab: TabId = tab === "cosmetics" && !skins.length ? "gear" : tab
  const className = snapshot?.className || character.className
  const raceName = snapshot?.raceName || character.raceName

  return (
    <article className="detail">
      <header className="detail-head profile-head">
        <div className="profile-main">
          <div className="identity">
            <div className="portrait-wrap">
              {snapshot?.portrait ? <img src={snapshot.portrait} alt="" /> : <span className="portrait-fallback">{character.name.slice(0, 1)}</span>}
              {snapshot ? <span className="level-badge">{snapshot.level}</span> : null}
            </div>
            <div>
              <p className="eyebrow">{character.role === "main" ? "Main" : "Alt"} · {character.serverName}</p>
              <h2>{character.name}</h2>
              {snapshot?.titleName ? <p className="title-name">{snapshot.titleName}</p> : null}
              <p className="muted">
                {className || "Class loads on refresh"}
                {raceName ? ` · ${raceName}` : ""}
                {snapshot ? ` · Level ${snapshot.level}` : ""}
              </p>
              {snapshot ? (
                <div className="identity-metrics">
                  <div>
                    <p className="eyebrow">Item level</p>
                    <p className="stat-value">{snapshot.itemLevel == null ? "—" : formatNumber(snapshot.itemLevel)}</p>
                  </div>
                  <div>
                    <p className="eyebrow">Combat power</p>
                    <p className="stat-value">{formatNumber(snapshot.combatPower)}</p>
                  </div>
                </div>
              ) : null}
              {snapshot ? (
                <p className="muted">Titles {snapshot.titlesOwned}/{snapshot.titlesTotal} · Updated {formatWhen(snapshot.at)}</p>
              ) : (
                <p className="muted">Refresh to pull the public profile: combat power, boards, gear, and skills.</p>
              )}
            </div>
          </div>
          {snapshot && (snapshot.pet || snapshot.wing || snapshot.wingSkin) ? (
            <div className="companions">
              {snapshot.pet ? <Companion name={snapshot.pet.name} icon={snapshot.pet.icon} detail={snapshot.pet.level != null ? `Lv ${snapshot.pet.level}` : undefined} /> : null}
              {snapshot.wing ? <Companion name={snapshot.wing.name} icon={snapshot.wing.icon} detail={snapshot.wing.grade} /> : null}
              {snapshot.wingSkin ? <Companion name={snapshot.wingSkin.name} icon={snapshot.wingSkin.icon} detail="Wing skin" /> : null}
            </div>
          ) : null}
        </div>
        <div className="actions">
          <button type="button" onClick={onRefresh} disabled={busy}>{busy ? "Refreshing…" : "Refresh"}</button>
          {character.role === "alt" ? <button type="button" onClick={onSetMain}>Make main</button> : null}
          <button type="button" className="ghost" onClick={onDelete}>Remove</button>
        </div>
      </header>

      <section className="panel">
        <h3>Odyle energy</h3>
        <p className="muted">The public profile does not include this. Type the number from the game, then set the hours and minutes until the next +15 so the clock matches.</p>
        {projection ? (
          <>
            <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={projection.cap} aria-valuenow={Math.min(projection.current, projection.cap)} aria-label="Odyle energy">
              <span style={{ width: `${Math.min(100, (projection.current / projection.cap) * 100)}%` }} />
            </div>
            <p>
              <strong>{formatNumber(projection.current)} / {formatNumber(projection.cap)}</strong>
              {projection.aboveCap ? " · above the passive cap, regen paused" : null}
              {projection.full && !projection.aboveCap ? ` · capping${projection.lost ? `, about ${formatNumber(projection.lost)} lost` : ""}` : null}
              {!projection.full && !projection.aboveCap && projection.nextTickAt ? ` · next +15 in ${formatCountdown(projection.nextTickAt - now)}` : null}
              {!projection.full && projection.fullAt ? ` · full in ${formatCountdown(projection.fullAt - now)}` : null}
            </p>
          </>
        ) : <p>No reading yet.</p>}
        <div className="inline">
          <label>
            Last reading
            <input inputMode="numeric" value={odyleDraft} onChange={(event) => setOdyleDraft(event.target.value)} />
          </label>
          <button
            type="button"
            onClick={() => {
              const amount = parseStoredNumber(odyleDraft)
              if (amount == null) return
              onSaveOdyle(amount)
            }}
          >
            Save reading
          </button>
          <label>
            Next +15 hours
            <input
              className="timer-input"
              inputMode="numeric"
              value={hourDraft}
              disabled={timerPaused}
              onChange={(event) => setHourDraft(event.target.value)}
            />
          </label>
          <label>
            Minutes
            <input
              className="timer-input"
              inputMode="numeric"
              value={minuteDraft}
              disabled={timerPaused}
              onChange={(event) => setMinuteDraft(event.target.value)}
            />
          </label>
          <button type="button" disabled={!projection || timerPaused} onClick={() => {
            const hours = clockPart(hourDraft)
            const minutes = clockPart(minuteDraft)
            if (hours == null || minutes == null || minutes > 59) return
            onSetOdyleTimer((hours * 60 + minutes) * 60 * 1000)
          }}>
            Set timer
          </button>
          <button type="button" disabled={!projection} onClick={onSpendCube}>
            Opened a cube (−{CUBE_COST})
          </button>
        </div>
      </section>

      <div className="tabs" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={activeTab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {activeTab === "checklist" ? (
        <Checklist
          rows={checklistRows}
          level={snapshot?.level ?? null}
          names={names}
          roles={roles}
          characterId={character.id}
          onBoxes={onChecklistBoxes}
          onBank={onChecklistBank}
        />
      ) : null}

      {activeTab === "advice" ? (
        <>
          <section className="panel">
            <h3>Where to spend next</h3>
            <ul className="suggestions">
              {suggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <strong>{suggestion.title}</strong>
                  <p>{suggestion.detail}</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel">
            <h3>Combat power</h3>
            {snapshot ? (
              <>
                <Sparkline values={character.history.map((point) => point.combatPower)} />
                {character.history.length >= 2 ? (
                  <p className="muted">
                    First saved reading {formatNumber(character.history[0].combatPower)} on {formatWhen(character.history[0].at)}.
                    Latest {formatNumber(snapshot.combatPower)}.
                  </p>
                ) : null}
              </>
            ) : <p>Refresh this character to start a combat-power history.</p>}
          </section>
        </>
      ) : null}

      {activeTab === "boards" ? (
        snapshot ? <DaevanionView snapshot={snapshot} boardId={boardId} onSelect={setBoardId} /> : <section className="panel"><p>Refresh this character to load the boards.</p></section>
      ) : null}

      {activeTab === "gear" ? (
        <GearView snapshot={snapshot} />
      ) : null}

      {activeTab === "skills" ? (
        <SkillsView snapshot={snapshot} />
      ) : null}

      {activeTab === "cosmetics" ? (
        <section className="panel">
          <h3>Cosmetics</h3>
          {skins.length ? (
            <ul className="gear-grid">
              {orderGear(skins, COSMETIC_SLOTS).map((item) => (
                <li key={`${item.slot}:${item.name}`}><ItemCard item={item} /></li>
              ))}
            </ul>
          ) : <p>No cosmetics on this snapshot.</p>}
        </section>
      ) : null}
    </article>
  )
}

function GearView({ snapshot }: { snapshot: Snapshot | null }) {
  if (!snapshot) return <section className="panel"><p>Refresh this character to load gear.</p></section>
  if (!snapshot.gear.length) return <section className="panel"><h3>Gear</h3><p>No gear on this snapshot.</p></section>
  const known = new Set([...WEAPON_SLOTS, ...ARMOR_SLOTS, ...ACCESSORY_SLOTS, ...ARCANA_SLOTS])
  const other = snapshot.gear.filter((item) => !known.has(item.slot))
  return (
    <div className="gear-stack">
      <GearGroup title="Weapons" items={orderGear(snapshot.gear, WEAPON_SLOTS)} columns="weapons" />
      <GearGroup title="Armor" items={orderGear(snapshot.gear, ARMOR_SLOTS)} />
      <GearGroup title="Accessories" items={orderGear(snapshot.gear, ACCESSORY_SLOTS)} />
      <GearGroup title="Arcana" items={orderGear(snapshot.gear, ARCANA_SLOTS)} />
      <GearGroup title="Other" items={other} />
    </div>
  )
}

function GearGroup({ title, items, columns }: { title: string; items: GearPoint[]; columns?: string }) {
  if (!items.length) return null
  return (
    <section className="panel">
      <h3>{title}</h3>
      <ul className={columns ? `gear-grid ${columns}` : "gear-grid"}>
        {items.map((item) => (
          <li key={`${item.slot}:${item.name}`}><ItemCard item={item} /></li>
        ))}
      </ul>
    </section>
  )
}

function ItemCard({ item }: { item: GearPoint }) {
  const slot = displaySlot(item.slot)
  const enchant = item.enchant > 0 ? `+${item.enchant} ` : ""
  const lines = [
    `${enchant}${item.name}`.trim(),
    item.grade,
    slot,
    `Enchant +${item.enchant}`,
    item.exceed ? `Exceed +${item.exceed}` : "",
  ].filter(Boolean)
  return (
    <div className={`item-card ${gradeClass(item.grade)}`} tabIndex={0}>
      {item.icon ? <img src={item.icon} alt="" /> : <span className="item-fallback">{slot.slice(0, 1)}</span>}
      <span className="item-copy">
        <span className="item-name">{enchant}{item.name}</span>
        <span className="item-slot">{slot}</span>
      </span>
      <span className="tip" role="tooltip">{lines.join("\n")}</span>
    </div>
  )
}

function SkillsView({ snapshot }: { snapshot: Snapshot | null }) {
  if (!snapshot) return <section className="panel"><p>Refresh this character to load skills.</p></section>
  const knowsEquip = snapshot.skills.some((skill) => typeof skill.equipped === "boolean")
  if (!knowsEquip) {
    const groups = ["Active", "Passive", "Dp"].map((category) => ({
      category,
      skills: snapshot.skills.filter((skill) => skill.category === category && skill.acquired),
    })).filter((group) => group.skills.length)
    return (
      <section className="panel">
        <h3>Skills</h3>
        {groups.length ? groups.map((group) => (
          <SkillGroup key={group.category} title={skillCategoryLabel(group.category)} skills={group.skills} />
        )) : <p>No acquired skills on this snapshot.</p>}
      </section>
    )
  }
  const equippedSpecialty = snapshot.skills.filter((skill) => skill.category === "Dp" && skill.equipped)
  const equippedActive = snapshot.skills.filter((skill) => skill.category === "Active" && skill.equipped)
  const notEquipped = snapshot.skills.filter((skill) => skill.acquired && !skill.equipped && skill.category !== "Passive")
  const notAcquired = snapshot.skills.filter((skill) => !skill.acquired && !skill.equipped)
  const passive = snapshot.skills.filter((skill) => skill.category === "Passive" && skill.acquired)
  const placed = new Set([...equippedSpecialty, ...equippedActive, ...notEquipped, ...notAcquired, ...passive])
  const other = snapshot.skills.filter((skill) => !placed.has(skill))
  return (
    <div className="gear-stack">
      <SkillGroup title="Equipped specialty" skills={equippedSpecialty} />
      <SkillGroup title="Equipped active" skills={equippedActive} />
      <SkillGroup title="Not equipped" skills={notEquipped} />
      <SkillGroup title={`Not acquired (${notAcquired.length})`} skills={notAcquired} dim />
      <SkillGroup title={`Passive skills (${passive.length})`} skills={passive} />
      <SkillGroup title="Other" skills={other} />
    </div>
  )
}

function SkillGroup({ title, skills, dim }: { title: string; skills: SkillPoint[]; dim?: boolean }) {
  if (!skills.length) return null
  return (
    <section className="panel">
      <h3>{title}</h3>
      <ul className="skill-grid">
        {skills.map((skill) => (
          <li key={`${skill.category}:${skill.name}`}>
            <SkillTile skill={skill} dim={dim} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function SkillTile({ skill, dim }: { skill: SkillPoint; dim?: boolean }) {
  const badge = skill.acquired ? String(skill.level) : skill.needLevel != null ? String(skill.needLevel) : undefined
  const tip = [
    skillCategoryLabel(skill.category),
    skill.name,
    skill.acquired ? `Level ${skill.level}` : "Not acquired",
    skill.needLevel != null ? `Requires level ${skill.needLevel}` : "",
    skill.equipped ? "Equipped" : "",
  ].filter(Boolean).join(" · ")
  return (
    <div className={dim ? "skill-tile dim" : "skill-tile"}>
      <GameIcon src={skill.icon} label={skill.name} badge={badge} tip={tip} />
      <span className="skill-name">{skill.name}</span>
    </div>
  )
}

function DaevanionView({
  snapshot,
  boardId,
  onSelect,
}: {
  snapshot: Snapshot
  boardId: number | null
  onSelect: (id: number) => void
}) {
  const boards = snapshot.boards.slice().sort((a, b) => boardRank(a) - boardRank(b))
  const selected = boards.find((board) => board.id === boardId) ?? boards.find((board) => board.open) ?? boards[0] ?? null
  const skillEffects = (snapshot.effects ?? []).filter((effect) => effect.kind === "skill")
  const statEffects = (snapshot.effects ?? []).filter((effect) => effect.kind === "stat" && effect.boardId === selected?.id)
  return (
    <section className="panel">
      <h3>Daevanion</h3>
      {boards.length ? (
        <div className="board-chips" role="tablist">
          {boards.map((board) => (
            <button
              key={board.id}
              type="button"
              className="board-chip"
              role="tab"
              aria-selected={selected?.id === board.id}
              onClick={() => onSelect(board.id)}
            >
              <strong>{board.name}</strong>
              <span className="muted">{board.open ? `${board.openNodeCount}/${board.totalNodeCount}` : "Locked"}</span>
              <span className="meter slim" aria-hidden="true">
                <span style={{ width: `${board.open ? Math.max(0, Math.min(100, board.openPercent)) : 0}%` }} />
              </span>
            </button>
          ))}
        </div>
      ) : <p>No boards on this snapshot.</p>}
      {selected ? (
        <div className="board-stage">
          <BoardGrid board={selected} />
          <div className="effect-list">
            <h4>Active effects ({skillEffects.length})</h4>
            {snapshot.effects ? (
              skillEffects.length ? (
                <ul>
                  {skillEffects.map((effect) => (
                    <li key={`${effect.boardId}:${effect.desc}`} className={effect.boardId === selected.id ? "current" : undefined}>
                      <span>{effect.desc}</span>
                      <span className="muted">{effect.boardName}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="muted">No open skill effects.</p>
            ) : <p className="muted">Refresh to load active effects.</p>}
            {statEffects.length ? (
              <>
                <h4>{selected.name} stats</h4>
                <ul>
                  {statEffects.map((effect) => (
                    <li key={`${effect.boardId}:${effect.desc}`}><span>{effect.desc}</span></li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function BoardGrid({ board }: { board: BoardPoint }) {
  if (!board.open) return <p>Locked</p>
  const nodes = board.nodes
  if (!nodes) return <p className="muted">Refresh to load the node grid.</p>
  if (!nodes.length) return <p className="muted">No node positions returned for this board.</p>
  const minRow = Math.min(...nodes.map((node) => node.row))
  const minCol = Math.min(...nodes.map((node) => node.col))
  const rows = Math.max(...nodes.map((node) => node.row)) - minRow + 1
  const cols = Math.max(...nodes.map((node) => node.col)) - minCol + 1
  return (
    <div
      className="node-grid"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
    >
      {nodes.map((node) => {
        const label = [node.name, node.effect, node.open ? "Open" : "Closed"].filter(Boolean).join(" · ")
        return (
          <button
            key={`${node.row}:${node.col}:${node.name}`}
            type="button"
            className={`node ${node.type === "Start" ? "start" : node.open ? "open" : "closed"} ${gradeClass(node.grade)}`}
            style={{ gridRow: node.row - minRow + 1, gridColumn: node.col - minCol + 1 }}
            aria-label={label || node.type}
            title={label}
          />
        )
      })}
    </div>
  )
}

function Companion({ name, icon, detail }: { name: string; icon?: string; detail?: string }) {
  return (
    <div className="companion">
      {icon ? <img src={icon} alt="" /> : <span className="item-fallback">{name.slice(0, 1)}</span>}
      <span>
        <strong>{name}</strong>
        {detail ? <span className="muted">{detail}</span> : null}
      </span>
    </div>
  )
}

function clockPart(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return 0
  if (!/^\d+$/.test(trimmed)) return null
  return Number(trimmed)
}

function displaySlot(slot: string): string {
  return SLOT_DISPLAY[slot] ?? slotLabel(slot)
}

function gradeClass(grade: string): string {
  const known = ["Unique", "Legend", "Rare", "Special", "Common", "None"]
  return known.includes(grade) ? `grade-${grade.toLowerCase()}` : ""
}

function orderGear(items: GearPoint[], slots: string[]): GearPoint[] {
  return slots.flatMap((slot) => items.filter((item) => item.slot === slot))
}
