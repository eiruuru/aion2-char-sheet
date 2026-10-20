import { useEffect, useState } from "react"
import type { CharacterRecord } from "../model/store"
import {
  MODE_LABELS,
  PRIORITY_SOURCE,
  VAULT_SOURCE,
  SLOT_LABELS,
  guideIconSrc,
  situationLabel,
  type ClassSituation,
  type GuideMacro,
  type GuideRow,
  type GuideTip,
  type PriorityMode,
  type SkillTier,
} from "../model/classPriorities"
import { classPriorities } from "../model/classPriorities"
import { guideFor, loadGuide } from "../model/guideRefresh"
import { applyVault, vaultPage } from "../model/vaultGuide"

type Section = "skills" | "stigmas" | "arcana" | "pantheon" | "equipment" | "stats" | "macros" | "tips"

const SECTIONS: { id: Section; label: string }[] = [
  { id: "skills", label: "Skills" },
  { id: "stigmas", label: "Stigmas" },
  { id: "arcana", label: "Arcana" },
  { id: "pantheon", label: "Pantheon" },
  { id: "equipment", label: "Equipment" },
  { id: "stats", label: "Stats" },
  { id: "macros", label: "Macros" },
  { id: "tips", label: "Combat tips" },
]

const CYRILLIC = /[А-Яа-яЁё]/

function english(value?: string): string {
  if (!value) return ""
  const replaced = value
    .replace(/В сборке/g, "In the build")
    .replace(/Стигмы/g, "Stigma")
    .replace(/Свойства/g, "Stats")
    .replace(/Карты/g, "Cards")
    .replace(/Слот /g, "Slot ")
    .replace(/Активные/g, "Active")
    .replace(/Пассивные/g, "Passive")
    .replace(/части/g, "pieces")
    .replace(/для MP/g, "for MP")
    .replace(/PvE-бонусы наборов в PvP/g, "PvE set bonuses in PvP")
    .replace(/Уровни основных умений/g, "Core skill levels")
  return CYRILLIC.test(replaced) ? "" : replaced
}

const GROUPS: { tier: SkillTier; label: string }[] = [
  { tier: "S", label: "First" },
  { tier: "A", label: "High priority" },
  { tier: "B", label: "Situational" },
]

export function ClassGuide({ character }: { character: CharacterRecord }) {
  const [book, setBook] = useState<Record<string, ClassSituation[]> | null>(null)
  const [mode, setMode] = useState<PriorityMode>("pve")
  const [situation, setSituation] = useState("bosses")
  const [section, setSection] = useState<Section>("skills")
  const className = character.className
  useEffect(() => {
    setMode("pve")
    setSituation("bosses")
    setSection("skills")
  }, [character.id, className])
  useEffect(() => {
    let cancel = false
    void loadGuide(localStorage, Date.now()).then((result) => {
      if (!cancel) setBook(result.book)
    })
    return () => { cancel = true }
  }, [character.id])
  const situations = (book ? guideFor(book, className) : null) ?? classPriorities(className)
  return (
    <section className="class-sheet" data-tour="guide" aria-label={`${className || "Class"} guide`}>
      <nav className="panel improve-card" aria-label="What to improve">
        <h2>What to improve</h2>
        <div className="improve-list">
          {SECTIONS.map((item) => (
            <button key={item.id} type="button" aria-pressed={section === item.id} onClick={() => setSection(item.id)}>{item.label}</button>
          ))}
        </div>
        <p className="muted priority-credit">{situations && vaultPage(className, mode) && (section === "skills" || section === "stigmas" || section === "macros" || section === "tips") ? VAULT_SOURCE : PRIORITY_SOURCE}</p>
      </nav>
      <div className="panel guide-results">
        {!situations ? <p className="muted">Refresh the character to see priorities.</p> : (
          <GuideResults
            situations={situations}
            mode={mode}
            situation={situation}
            section={section}
            className={className}
            onMode={setMode}
            onSituation={setSituation}
          />
        )}
      </div>
    </section>
  )
}

function GuideResults({
  situations,
  mode,
  situation,
  section,
  className,
  onMode,
  onSituation,
}: {
  situations: ClassSituation[]
  mode: PriorityMode
  situation: string
  section: Section
  className: string
  onMode: (mode: PriorityMode) => void
  onSituation: (situation: string) => void
}) {
  const inMode = situations.filter((entry) => entry.mode === mode)
  const found = inMode.find((entry) => entry.situation === situation) ?? inMode[0]
  if (!found) return <p className="muted">Refresh the character to see priorities.</p>
  const current = applyVault(found, className)
  return (
    <>
      <div className="guide-toolbar">
        <div className="priority-modes" role="group" aria-label="Priority mode">
          {MODE_LABELS.map((item) => (
            <button key={item.id} type="button" aria-pressed={mode === item.id} onClick={() => onMode(item.id)}>{item.label}</button>
          ))}
        </div>
        <label className="priority-situation">
          Situation
          <select value={current.situation} onChange={(event) => onSituation(event.target.value)}>
            {inMode.map((entry) => (
              <option key={entry.situation} value={entry.situation}>{situationLabel(entry.situation)}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="guide-scroll">
        <SectionBody section={section} entry={current} />
      </div>
    </>
  )
}

function SectionBody({ section, entry }: { section: Section; entry: ClassSituation }) {
  if (section === "macros") return <MacroList macros={entry.macros ?? []} />
  if (section === "tips") return (
    <>
      <Tactics entry={entry} />
      <TipList tips={entry.tips ?? []} />
    </>
  )
  const rows = sectionRows(section, entry)
  if (!rows.length) return <p className="muted">Nothing listed for this situation.</p>
  return <TierGroups rows={rows} />
}

function sectionRows(section: Section, entry: ClassSituation): GuideRow[] {
  if (section === "skills" || section === "stigmas") {
    const skills = entry.skills.filter((skill) => section === "stigmas" ? skill.slot === "stigma" : skill.slot !== "stigma")
    return skills.map((skill) => ({
      title: skill.name,
      tier: skill.tier,
      why: skill.why,
      detail: [skill.detail, skill.training].filter(Boolean).join(" · "),
      slot: SLOT_LABELS[skill.slot],
      icon: skill.icon,
      description: skill.description,
    }))
  }
  const lists: Record<string, GuideRow[] | undefined> = {
    arcana: entry.arcana,
    pantheon: entry.pantheon,
    equipment: entry.equipment,
    stats: entry.statRows,
  }
  return lists[section] ?? []
}

function TierGroups({ rows }: { rows: Array<GuideRow & { description?: string }> }) {
  const later = rows.filter((row) => row.tier === "C" || row.tier === "?")
  const visible = rows.filter((row) => row.tier === "S" || row.tier === "A" || row.tier === "B")
  return (
    <>
      {GROUPS.map((group) => {
        const groupRows = visible.filter((row) => row.tier === group.tier)
        if (!groupRows.length) return null
        return (
          <section key={group.tier} className="tier-group" aria-label={group.label}>
            <h3><span className={`tier-mark ${tierClass(group.tier)}`}>{group.tier}</span> {group.label}</h3>
            <ul className="priority-skills">
              {groupRows.map((row) => <GuideCard key={`${row.tier}-${row.title}-${row.slot ?? ""}`} row={row} />)}
            </ul>
          </section>
        )
      })}
      {later.length ? (
        <details className="fold">
          <summary>Can wait</summary>
          <ul className="priority-skills">
            {later.map((row) => <GuideCard key={`${row.tier}-${row.title}-${row.slot ?? ""}`} row={row} />)}
          </ul>
        </details>
      ) : null}
    </>
  )
}

function GuideCard({ row }: { row: GuideRow & { description?: string } }) {
  const title = english(row.title)
  const detail = english(row.detail)
  const why = english(row.why)
  const description = english(row.description)
  const slot = english(row.slot)
  if (!title && !detail && !why && !description) return null
  return (
    <li className="skill-card">
      {row.icon ? <img src={guideIconSrc(row.icon)} alt="" /> : <span className={`tier-badge ${tierClass(row.tier)}`}>{row.tier}</span>}
      <div>
        <p className="priority-skill-line">
          <strong className={`tier-mark ${tierClass(row.tier)}`}>{row.tier}</strong>
          {title ? <strong>{title}</strong> : null}
          {slot ? <span className="muted">{slot}</span> : null}
        </p>
        {detail ? <p className="muted priority-why">{detail}</p> : null}
        {why ? <p className="muted priority-why">{why}</p> : null}
        {description ? <p className="skill-description">{description}</p> : null}
      </div>
    </li>
  )
}

function MacroList({ macros }: { macros: GuideMacro[] }) {
  const shown = macros.map((macro) => ({ title: english(macro.title), chain: english(macro.chain) })).filter((macro) => macro.title || macro.chain)
  if (!shown.length) return <p className="muted">Nothing listed for this situation.</p>
  return (
    <ul className="priority-skills">
      {shown.map((macro) => (
        <li key={`${macro.title}-${macro.chain}`} className="skill-card">
          <span className="tier-badge">M</span>
          <div>
            {macro.title ? <p><strong>{macro.title}</strong></p> : null}
            {macro.chain ? <p className="muted">{macro.chain}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

function TipList({ tips }: { tips: GuideTip[] }) {
  const shown = tips.map((tip) => ({
    title: english(tip.title),
    action: english(tip.action),
    condition: english(tip.condition),
  })).filter((tip) => tip.title || tip.action || tip.condition)
  if (!shown.length) return null
  return (
    <ul className="priority-skills">
      {shown.map((tip) => (
        <li key={`${tip.title}-${tip.action}`} className="skill-card tip-card">
          <span className="tier-badge">!</span>
          <div>
            {tip.title ? <p><strong>{tip.title}</strong></p> : null}
            {tip.action ? <p>{tip.action}</p> : null}
            {tip.condition ? <p className="muted">{tip.condition}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

function Tactics({ entry }: { entry: ClassSituation }) {
  const role = english(entry.role)
  const steps = english(entry.steps)
  const swaps = english(entry.swaps)
  const risks = english(entry.risks)
  const tip = english(entry.tip)
  const core = entry.core.map(english).filter(Boolean)
  const stigmas = entry.stigmas.map(english).filter(Boolean)
  const stats = entry.stats.map(english).filter(Boolean)
  if (!role && !steps && !swaps && !risks && !tip && !core.length) return null
  return (
    <div className="tactics skill-card tip-card">
      <span className="tier-badge">T</span>
      <div>
        {role ? <p className="priority-role">{role}</p> : null}
        {core.length ? <p><span className="muted">Core. </span>{core.join(", ")}</p> : null}
        {stigmas.length ? <p><span className="muted">Stigmas. </span>{stigmas.join(", ")}</p> : null}
        {stats.length ? <p className="muted">{stats.join(", ")}</p> : null}
        {steps ? <p>{steps}</p> : null}
        {swaps ? <p className="muted">{swaps}</p> : null}
        {risks ? <p className="muted">{risks}</p> : null}
        {tip ? <p>{tip}</p> : null}
      </div>
    </div>
  )
}

function tierClass(tier: string): string {
  return tier === "?" ? "tier-unknown" : `tier-${tier.toLowerCase()}`
}
