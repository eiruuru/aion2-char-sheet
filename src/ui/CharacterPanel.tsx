import { useEffect, useState } from "react"
import type { CharacterRecord } from "../model/store"
import { boardRank, slotLabel } from "../model/suggestions"
import { formatNumber, formatWhen, skillCategoryLabel } from "../model/format"
import type { ChecklistRow, MarkOwner } from "../model/checklist"
import type { BoardPoint, GearPoint, SkillPoint, Snapshot } from "../model/snapshot"
import { Checklist } from "./Checklist"
import { ItemCard, useGearLookup, type GearQuery } from "./GearTip"
import { GameIcon } from "./GameIcon"
import { classIconForName } from "../api/classes"
import { RefreshIcon, StarIcon, TrashIcon } from "./icons"

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

const PLAY_TABS = [
  { id: "dailies", label: "Dailies" },
  { id: "weeklies", label: "Weeklies" },
  { id: "season", label: "Seasonal" },
] as const

const BUILD_TABS = [
  { id: "gear", label: "Gear" },
  { id: "skills", label: "Skills" },
  { id: "boards", label: "Daevanion" },
  { id: "cosmetics", label: "Cosmetics" },
] as const

type PlayTab = (typeof PLAY_TABS)[number]["id"]
type BuildTab = (typeof BUILD_TABS)[number]["id"]

export function CharacterPanel({
  character,
  busy,
  onRefresh,
  onDelete,
  onSetMain,
  checklistRows,
  names,
  roles,
  onChecklistBoxes,
  onChecklistBank,
  now,
}: {
  character: CharacterRecord
  busy: boolean
  onRefresh: () => void
  onDelete: () => void
  onSetMain: () => void
  checklistRows: ChecklistRow[]
  names: Record<string, string>
  roles: Record<string, "main" | "alt">
  onChecklistBoxes: (taskId: string, owners: MarkOwner[]) => void
  onChecklistBank: (taskId: string, value: number) => void
  now: number
}) {
  const snapshot = character.latest
  const [playTab, setPlayTab] = useState<PlayTab>("dailies")
  const [buildTab, setBuildTab] = useState<BuildTab>("gear")
  const [boardId, setBoardId] = useState<number | null>(null)

  useEffect(() => {
    setBoardId(null)
  }, [character.id])

  const skins = snapshot?.skins ?? []
  const buildTabs = skins.length ? BUILD_TABS : BUILD_TABS.filter((item) => item.id !== "cosmetics")
  const activeBuild: BuildTab = buildTab === "cosmetics" && !skins.length ? "gear" : buildTab
  const gearQuery: GearQuery = {
    region: character.region,
    serverId: character.serverId,
    characterId: character.characterId,
  }
  const gearLookup = useGearLookup(
    gearQuery,
    activeBuild === "cosmetics" ? skins : activeBuild === "gear" ? snapshot?.gear ?? [] : [],
  )
  const className = snapshot?.className || character.className
  const raceName = snapshot?.raceName || character.raceName

  return (
    <>
    <article className="detail" data-tour="profile">
      <header className="detail-head profile-head">
        <div className="profile-row">
          <div className="portrait-wrap">
            {snapshot?.portrait ? <img src={snapshot.portrait} alt="" /> : <span className="portrait-fallback">{character.name.slice(0, 1)}</span>}
          </div>
          <div className="profile-name">
            <p className="eyebrow">{character.role === "main" ? "Main" : "Alt"} · {character.serverName}</p>
            <h2>{character.name}</h2>
            {snapshot?.titleName || snapshot ? (
              <p className="title-name">
                {snapshot?.titleName ? <span className="title-label">{snapshot.titleName}</span> : null}
                {snapshot ? <span className="title-count">({snapshot.titlesOwned}/{snapshot.titlesTotal})</span> : null}
              </p>
            ) : null}
            <div className="actions profile-actions">
              <button type="button" className="icon-button ghost" aria-label={busy ? "Refreshing" : "Refresh"} title={busy ? "Refreshing…" : "Refresh"} onClick={onRefresh} disabled={busy}>
                <RefreshIcon />
              </button>
              {character.role === "alt" ? (
                <button type="button" className="icon-button ghost" aria-label="Make main" title="Make main" onClick={onSetMain}>
                  <StarIcon />
                </button>
              ) : null}
              <button type="button" className="icon-button ghost" aria-label="Remove" title="Remove" onClick={onDelete}>
                <TrashIcon />
              </button>
            </div>
          </div>
          <div className="profile-scores">
            <div className="profile-stat gear">
              <p className="stat-title">Gear Score</p>
              <p className="stat-value">{snapshot?.itemLevel == null ? "—" : formatNumber(snapshot.itemLevel)}</p>
            </div>
            <div className="profile-stat power">
              <p className="stat-title">Combat power</p>
              <p className="stat-value">{snapshot ? formatNumber(snapshot.combatPower) : "—"}</p>
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
        <div className="profile-side">
          <div className="profile-class">
            {className ? <img src={classIconForName(className)} alt="" /> : null}
            <div>
              <strong>{className || "Class loads on refresh"}</strong>
              <p className="profile-race">
                {raceName ? <span>{raceName}</span> : null}
                {snapshot ? <span>Level {snapshot.level}</span> : null}
              </p>
            </div>
          </div>
          <div className="profile-meta">
            {snapshot ? <span>Updated {formatWhen(snapshot.at)}</span> : <span>Refresh to pull the public profile.</span>}
          </div>
        </div>
      </header>
    </article>

      <div className="content-row">
        <section className="panel">
          <div className="tabs" role="tablist" aria-label="Tasks" data-tour="tasks">
            {PLAY_TABS.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={playTab === item.id} onClick={() => setPlayTab(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="card-scroll">
            <Checklist
              cadence={playTab === "season" ? "season" : playTab === "weeklies" ? "weekly" : "daily"}
              rows={checklistRows}
              level={snapshot?.level ?? null}
              names={names}
              roles={roles}
              characterId={character.id}
              now={now}
              onBoxes={onChecklistBoxes}
              onBank={onChecklistBank}
            />
          </div>
        </section>
        <section className="panel">
          <div className="tabs" role="tablist" aria-label="Character" data-tour="build">
            {buildTabs.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={activeBuild === item.id} onClick={() => setBuildTab(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <div className={activeBuild === "boards" ? "card-scroll board-pane" : "card-scroll"}>
          {activeBuild === "boards" ? (
            snapshot ? <DaevanionView snapshot={snapshot} boardId={boardId} onSelect={setBoardId} /> : <p>Refresh this character to load the boards.</p>
          ) : null}
          {activeBuild === "gear" ? <GearView snapshot={snapshot} query={gearQuery} lookup={gearLookup} /> : null}
          {activeBuild === "skills" ? <SkillsView snapshot={snapshot} /> : null}
          {activeBuild === "cosmetics" ? (
            skins.length ? (
              <ul className="gear-grid">
                {orderGear(skins, COSMETIC_SLOTS).map((item) => (
                  <li key={`${item.slot}:${item.name}`}><ItemCard item={item} slot={displaySlot(item.slot)} query={gearQuery} identity={gearLookup(item)} /></li>
                ))}
              </ul>
            ) : <p>No cosmetics on this snapshot.</p>
          ) : null}
          </div>
        </section>
      </div>
    </>
  )
}

function GearView({
  snapshot,
  query,
  lookup,
}: {
  snapshot: Snapshot | null
  query: GearQuery
  lookup: (item: GearPoint) => { id: number; slotPos: number; enchant: number } | undefined
}) {
  if (!snapshot) return <p>Refresh this character to load gear.</p>
  if (!snapshot.gear.length) return <p>No gear on this snapshot.</p>
  const known = new Set([...WEAPON_SLOTS, ...ARMOR_SLOTS, ...ACCESSORY_SLOTS, ...ARCANA_SLOTS])
  const other = snapshot.gear.filter((item) => !known.has(item.slot))
  return (
    <div className="gear-stack">
      <GearGroup title="Weapons" items={orderGear(snapshot.gear, WEAPON_SLOTS)} columns="weapons" query={query} lookup={lookup} />
      <GearGroup title="Armor" items={orderGear(snapshot.gear, ARMOR_SLOTS)} query={query} lookup={lookup} />
      <GearGroup title="Accessories" items={orderGear(snapshot.gear, ACCESSORY_SLOTS)} query={query} lookup={lookup} />
      <GearGroup title="Arcana" items={orderGear(snapshot.gear, ARCANA_SLOTS)} query={query} lookup={lookup} />
      <GearGroup title="Other" items={other} query={query} lookup={lookup} />
    </div>
  )
}

function GearGroup({
  title,
  items,
  columns,
  query,
  lookup,
}: {
  title: string
  items: GearPoint[]
  columns?: string
  query: GearQuery
  lookup: (item: GearPoint) => { id: number; slotPos: number; enchant: number } | undefined
}) {
  if (!items.length) return null
  return (
    <section>
      <h3>{title}</h3>
      <ul className={columns ? `gear-grid ${columns}` : "gear-grid"}>
        {items.map((item) => (
          <li key={`${item.slot}:${item.name}`}>
            <ItemCard item={item} slot={displaySlot(item.slot)} query={query} identity={lookup(item)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function SkillsView({ snapshot }: { snapshot: Snapshot | null }) {
  if (!snapshot) return <p>Refresh this character to load skills.</p>
  const knowsEquip = snapshot.skills.some((skill) => typeof skill.equipped === "boolean")
  const skills = orderSkills(snapshot.skills.filter((skill) => skill.category === "Active"), knowsEquip)
  const stigma = orderSkills(snapshot.skills.filter((skill) => skill.category === "Dp"), knowsEquip)
  return (
    <div className="gear-stack">
      <SkillGroup title="Skills" skills={skills} markEquip={knowsEquip} />
      <SkillGroup title="Stigma" skills={stigma} markEquip={knowsEquip} />
    </div>
  )
}

function orderSkills(skills: SkillPoint[], knowsEquip: boolean): SkillPoint[] {
  const visible = knowsEquip ? skills : skills.filter((skill) => skill.acquired)
  const rank = (skill: SkillPoint) => (skill.equipped ? 0 : 1)
  return visible.slice().sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}

function SkillGroup({ title, skills, markEquip }: { title: string; skills: SkillPoint[]; markEquip: boolean }) {
  if (!skills.length) return null
  return (
    <section>
      <h3>{title}</h3>
      <ul className="skill-grid">
        {skills.map((skill) => (
          <li key={`${skill.category}:${skill.name}`}>
            <SkillTile skill={skill} markEquip={markEquip} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function SkillTile({ skill, markEquip }: { skill: SkillPoint; markEquip: boolean }) {
  const equipped = markEquip && skill.equipped === true
  const badge = skill.acquired ? String(skill.level) : skill.needLevel != null ? String(skill.needLevel) : undefined
  const tip = [
    skillCategoryLabel(skill.category),
    skill.name,
    skill.acquired ? `Level ${skill.level}` : "Not acquired",
    skill.needLevel != null ? `Requires level ${skill.needLevel}` : "",
    equipped ? "Equipped" : "",
  ].filter(Boolean).join(" · ")
  const className = equipped ? "skill-tile equipped" : markEquip ? "skill-tile dim" : "skill-tile"
  return (
    <div className={className}>
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
    <div className="board-layout">
      <div className="board-chart">
        {boards.length ? (
          <select
            aria-label="Daevanion board"
            value={selected ? String(selected.id) : ""}
            onChange={(event) => onSelect(Number(event.target.value))}
          >
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name} · {board.open ? `${board.openNodeCount}/${board.totalNodeCount}` : "Locked"}
              </option>
            ))}
          </select>
        ) : null}
        <div className="board-grid-wrap">
          {selected ? <BoardGrid board={selected} /> : <p>No boards on this snapshot.</p>}
        </div>
      </div>
      <div className="board-effects">
        <div className="effect-block">
          <h4>Active effects ({skillEffects.length})</h4>
          <div className="effect-scroll">
            {snapshot.effects ? (
              skillEffects.length ? (
                <ul className="effect-list">
                  {skillEffects.map((effect) => (
                    <li key={`${effect.boardId}:${effect.desc}`} className={effect.boardId === selected?.id ? "current" : undefined}>
                      <span>{effect.desc}</span>
                      <span className="muted">{effect.boardName}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="muted">No open skill effects.</p>
            ) : <p className="muted">Refresh to load active effects.</p>}
          </div>
        </div>
        {statEffects.length ? (
          <div className="effect-block">
            <h4>{selected?.name} stats</h4>
            <div className="effect-scroll">
              <ul className="effect-list">
                {statEffects.map((effect) => (
                  <li key={`${effect.boardId}:${effect.desc}`}><span>{effect.desc}</span></li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </div>
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

function displaySlot(slot: string): string {
  return SLOT_DISPLAY[slot] ?? slotLabel(slot)
}

function gradeClass(grade: string): string {
  const known = ["Mythic", "Epic", "Unique", "Legend", "Rare", "Special", "Common", "None"]
  return known.includes(grade) ? `grade-${grade.toLowerCase()}` : ""
}

function orderGear(items: GearPoint[], slots: string[]): GearPoint[] {
  return slots.flatMap((slot) => items.filter((item) => item.slot === slot))
}
