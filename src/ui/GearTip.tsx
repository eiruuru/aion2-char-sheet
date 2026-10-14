import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { fetchEquipment, fetchEquipmentItem } from "../api/client"
import type { EquipmentItemDetail, ItemStatLine, RegionId } from "../api/types"
import type { GearPoint } from "../model/snapshot"

const ACCESSORY_SLOTS = new Set([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 25, 26])
const ARCANA_SLOTS = new Set([41, 42, 43, 44, 45, 46, 47, 48, 49, 50])

export type GearQuery = {
  region: RegionId
  serverId: number
  characterId: string
}

export type GearIdentity = {
  id: number
  slotPos: number
  enchant: number
}

const detailCache = new Map<string, Promise<EquipmentItemDetail>>()

function detailKey(query: GearQuery, identity: GearIdentity): string {
  return `${query.region}:${query.serverId}:${query.characterId}:${identity.slotPos}:${identity.id}:${identity.enchant}`
}

export function loadGearDetail(query: GearQuery, identity: GearIdentity): Promise<EquipmentItemDetail> {
  const key = detailKey(query, identity)
  const cached = detailCache.get(key)
  if (cached) return cached
  const pending = fetchEquipmentItem(query.region, query.serverId, query.characterId, identity).catch((error) => {
    detailCache.delete(key)
    throw error
  })
  detailCache.set(key, pending)
  return pending
}

export function useGearLookup(query: GearQuery, items: GearPoint[]): (item: GearPoint) => GearIdentity | undefined {
  const [fetched, setFetched] = useState<Map<string, GearIdentity>>(() => new Map())
  const needsIds = items.some((item) => item.id == null || item.slotPos == null)
  const itemKey = items.map((item) => `${item.slot}:${item.name}:${item.id ?? ""}:${item.slotPos ?? ""}`).join("|")

  useEffect(() => {
    if (!needsIds || !items.length) return
    let cancel = false
    fetchEquipment(query.region, query.serverId, query.characterId)
      .then((equipment) => {
        if (cancel) return
        const next = new Map<string, GearIdentity>()
        const pieces = [...equipment.equipment.equipmentList, ...(equipment.equipment.skinList ?? [])]
        for (const piece of pieces) {
          next.set(`${piece.slotPosName}:${piece.name}`, {
            id: piece.id,
            slotPos: piece.slotPos,
            enchant: piece.enchantLevel,
          })
        }
        setFetched(next)
      })
      .catch(() => {})
    return () => {
      cancel = true
    }
  }, [needsIds, itemKey, query.region, query.serverId, query.characterId])

  const resolve = (item: GearPoint): GearIdentity | undefined => {
    if (item.id != null && item.slotPos != null) {
      return { id: item.id, slotPos: item.slotPos, enchant: item.enchant }
    }
    return fetched.get(`${item.slot}:${item.name}`)
  }

  const prefetchKey = items.map((item) => {
    const identity = resolve(item)
    return identity ? detailKey(query, identity) : ""
  }).join("|")

  useEffect(() => {
    const identities = items.map(resolve).filter((identity): identity is GearIdentity => identity != null)
    if (!identities.length) return
    let cursor = 0
    let active = 0
    let cancel = false
    const pump = () => {
      if (cancel) return
      while (active < 2 && cursor < identities.length) {
        const identity = identities[cursor]
        cursor += 1
        active += 1
        loadGearDetail(query, identity).catch(() => {}).finally(() => {
          active -= 1
          pump()
        })
      }
    }
    pump()
    return () => {
      cancel = true
    }
  }, [prefetchKey, query.region, query.serverId, query.characterId])

  return resolve
}

function gradeClass(grade: string): string {
  const known = ["Mythic", "Epic", "Unique", "Legend", "Rare", "Special", "Common", "None"]
  return known.includes(grade) ? `grade-${grade.toLowerCase()}` : ""
}

function statExtra(extra: string | undefined): string {
  if (!extra || extra === "0" || extra === "0%") return ""
  return extra.startsWith("+") || extra.startsWith("-") ? extra : `+${extra}`
}

function signed(value: string): string {
  if (!value) return ""
  return value.startsWith("+") || value.startsWith("-") ? value : `+${value}`
}

function exceedMarks(exceed: number, max: number): string {
  if (exceed <= 0) return ""
  return `${"◆".repeat(exceed)}${"◇".repeat(Math.max(0, max - exceed))}`
}

export function ItemCard({
  item,
  slot,
  query,
  identity,
}: {
  item: GearPoint
  slot: string
  query: GearQuery
  identity?: GearIdentity
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<EquipmentItemDetail | null>(null)
  const [failed, setFailed] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const hideTimer = useRef<number | null>(null)
  const enchant = item.enchant > 0 ? `+${item.enchant} ` : ""
  const show = () => {
    if (hideTimer.current != null) window.clearTimeout(hideTimer.current)
    setOpen(true)
  }
  const scheduleHide = () => {
    if (document.activeElement === cardRef.current) return
    if (hideTimer.current != null) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setOpen(false), 140)
  }

  useEffect(() => {
    if (!open || !identity) return
    let cancel = false
    setFailed(false)
    loadGearDetail(query, identity)
      .then((next) => {
        if (!cancel) setDetail(next)
      })
      .catch(() => {
        if (!cancel) setFailed(true)
      })
    return () => {
      cancel = true
    }
  }, [open, identity?.id, identity?.slotPos, identity?.enchant, query.region, query.serverId, query.characterId])

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const card = cardRef.current
      const tip = tipRef.current
      if (!card) return
      const rect = card.getBoundingClientRect()
      const width = tip?.offsetWidth ?? 300
      const height = tip?.offsetHeight ?? 240
      const margin = 8
      let left = rect.right + 10
      if (left + width > window.innerWidth - margin) left = rect.left - width - 10
      if (left < margin) left = margin
      let top = rect.top
      if (top + height > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - height - margin)
      setPos({ top, left })
    }
    place()
    const tip = tipRef.current
    const observer = tip && typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null
    if (tip && observer) observer.observe(tip)
    window.addEventListener("scroll", place, true)
    window.addEventListener("resize", place)
    return () => {
      observer?.disconnect()
      window.removeEventListener("scroll", place, true)
      window.removeEventListener("resize", place)
    }
  }, [open, detail, failed])

  return (
    <div
      ref={cardRef}
      className={`item-card ${gradeClass(item.grade)}`}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onFocus={show}
      onBlur={() => setOpen(false)}
    >
      {item.icon ? <img src={item.icon} alt="" /> : <span className="item-fallback">{slot.slice(0, 1)}</span>}
      <span className="item-copy">
        <span className="item-name">{enchant}{item.name}</span>
        <span className="item-slot">{slot}</span>
      </span>
      {open ? createPortal(
        <div ref={tipRef} className="gear-tip" role="tooltip" style={{ top: pos.top, left: pos.left }} onMouseEnter={show} onMouseLeave={scheduleHide}>
          <GearTipBody item={item} slot={slot} slotPos={identity?.slotPos ?? item.slotPos} detail={detail} failed={failed} waiting={Boolean(identity) && !detail && !failed} />
        </div>,
        document.body,
      ) : null}
    </div>
  )
}

function GearTipBody({
  item,
  slot,
  slotPos,
  detail,
  failed,
  waiting,
}: {
  item: GearPoint
  slot: string
  slotPos?: number
  detail: EquipmentItemDetail | null
  failed: boolean
  waiting: boolean
}) {
  const enchant = item.enchant > 0 ? `+${item.enchant} ` : ""
  const grade = detail?.gradeName || detail?.grade || item.grade
  const category = detail?.categoryName || slot
  const marks = exceedMarks(item.exceed ?? 0, detail?.maxExceedEnchantLevel ?? item.exceed ?? 0)
  const classes = detail?.classNames?.length ? detail.classNames.join(", ") : ""
  const level = detail?.level ? `Lv.${detail.level}` : ""
  const required = detail?.equipLevel ? `Req. Lv.${detail.equipLevel}` : ""
  const main = detail?.mainStats ?? []
  const base = main.filter((stat) => !stat.exceed)
  const exceed = main.filter((stat) => stat.exceed)
  const subs = detail?.subStats ?? []
  const skills = detail?.subSkills ?? []
  const stones = detail?.magicStoneStat ?? []
  const gods = detail?.godStoneStat ?? []
  const stoneCap = detail?.magicStoneSlotCount || stones.length
  const godCap = detail?.godStoneSlotCount || gods.length || 1
  const filled = subs.length + skills.length
  const cap = (detail?.subStatCount ?? 0) + (detail?.subSkillCountMax ?? 0)
  const arcana = identityIsArcana(detail, item)
  const soul = detail?.soulBindRate != null ? Number(detail.soulBindRate) : null
  const soulValue = soul != null && Number.isFinite(soul) ? Math.max(0, Math.min(100, soul)) : null
  const stoneLabel = slotPos != null && ACCESSORY_SLOTS.has(slotPos) ? "Soulstones" : "Manastones"

  return (
    <>
      <div className="gear-tip-head">
        {item.icon ? <img src={detail?.icon || item.icon} alt="" /> : null}
        <div>
          <p className={`gear-tip-name ${gradeClass(grade)}`}>{enchant}{detail?.name || item.name}</p>
          {marks ? <p className="gear-tip-exceed">{marks}</p> : null}
          <p className="gear-tip-meta">{grade} · {category}</p>
        </div>
      </div>
      {level || required || classes ? (
        <p className="gear-tip-meta">
          {[level, required && `(${required})`, classes].filter(Boolean).join(" ")}
        </p>
      ) : null}
      {waiting ? <p className="gear-tip-meta">Loading details…</p> : null}
      {failed ? <p className="gear-tip-meta">Couldn't load this item.</p> : null}
      {base.length || exceed.length ? (
        <section>
          <p className="gear-tip-label">Base stats</p>
          {base.map((stat, index) => <StatRow key={`base-${index}`} stat={stat} />)}
          {exceed.map((stat, index) => <StatRow key={`exceed-${index}`} stat={stat} exceed />)}
        </section>
      ) : null}
      {subs.length || skills.length || soulValue != null ? (
        <section>
          {soulValue != null ? (
            <div className="gear-tip-soul">
              <span>Soul binding</span>
              <span>{soulValue.toFixed(1)}%</span>
            </div>
          ) : null}
          {soulValue != null ? (
            <div className="gear-tip-bar" aria-hidden="true"><span style={{ width: `${soulValue}%` }} /></div>
          ) : null}
          <p className="gear-tip-label">
            {arcana ? "Skills" : "Additional stats"}
            {cap > 0 ? ` (${filled}/${cap})` : ""}
          </p>
          {subs.map((stat, index) => (
            <div className="gear-tip-row" key={`sub-${index}`}>
              <span>{stat.name}</span>
              <span className="bonus">{signed(stat.value ?? "")}</span>
            </div>
          ))}
          {skills.map((skill, index) => (
            <div className="gear-tip-row" key={`skill-${index}`}>
              <span className="gear-tip-with-icon">
                {skill.icon ? <img src={skill.icon} alt="" /> : null}
                {skill.name}
              </span>
              <span className="bonus">{skill.level ? `+${skill.level}` : ""}</span>
            </div>
          ))}
        </section>
      ) : null}
      {stones.length ? (
        <section>
          <p className="gear-tip-label">{stoneLabel} ({stones.length}/{stoneCap})</p>
          {stones.map((stone, index) => (
            <div className="gear-tip-row" key={`stone-${index}`}>
              <span className="gear-tip-with-icon">
                {stone.icon ? <img src={stone.icon} alt="" /> : null}
                <span className={gradeClass(stone.grade ?? "")}>{stone.name}</span>
              </span>
              <span>{stone.value}</span>
            </div>
          ))}
        </section>
      ) : null}
      {gods.length ? (
        <section>
          <p className="gear-tip-label">Theostone ({gods.length}/{godCap})</p>
          {gods.map((stone, index) => (
            <div key={`god-${index}`}>
              <div className="gear-tip-row">
                <span className="gear-tip-with-icon">
                  {stone.icon ? <img src={stone.icon} alt="" /> : null}
                  <span className={gradeClass(stone.grade ?? "")}>{stone.name}</span>
                </span>
              </div>
              {stone.desc ? <p className="gear-tip-desc">{stone.desc}</p> : null}
            </div>
          ))}
        </section>
      ) : null}
      {detail?.set?.name ? (
        <section>
          <p className="gear-tip-label">
            {detail.set.name}
            {detail.set.equippedCount != null ? ` (${detail.set.equippedCount}${detail.set.items?.length ? `/${detail.set.items.length}` : ""})` : ""}
          </p>
          {(detail.set.bonuses ?? []).map((bonus, index) => (
            <p className="gear-tip-desc" key={`set-${index}`}>
              {bonus.degree != null ? `(${bonus.degree}) ` : ""}
              {(bonus.descriptions ?? []).join(" ")}
            </p>
          ))}
        </section>
      ) : null}
      {detail ? (
        <p className="gear-tip-foot">
          {[
            detail.tradable === false ? "Untradeable" : "Tradeable",
            detail.tradablePersonal ? "Personal trade" : "",
            detail.storable === false ? "No storage" : "",
            ...(detail.sources ?? []),
          ].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </>
  )
}

function StatRow({ stat, exceed }: { stat: ItemStatLine; exceed?: boolean }) {
  const extra = statExtra(stat.extra)
  return (
    <div className={exceed ? "gear-tip-row exceed" : "gear-tip-row"}>
      <span>{stat.name}</span>
      <span>
        {exceed ? statExtra(stat.extra) || stat.value : stat.value}
        {!exceed && extra ? <span className="extra"> ({extra})</span> : null}
      </span>
    </div>
  )
}

function identityIsArcana(detail: EquipmentItemDetail | null, item: GearPoint): boolean {
  if (item.slot.startsWith("Arcana")) return true
  return item.slotPos != null && ARCANA_SLOTS.has(item.slotPos) && (detail?.subSkills?.length ?? 0) > 0 && (detail?.subStats?.length ?? 0) === 0
}
