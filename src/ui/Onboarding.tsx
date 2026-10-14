import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { holeRect, placeCard, visibleSteps, type Rect } from "./tour"

export function Onboarding({
  hasCharacter,
  desktop,
  preview = false,
  onDone,
}: {
  hasCharacter: boolean
  desktop: boolean
  preview?: boolean
  onDone: () => void
}) {
  const steps = useMemo(() => visibleSteps({ hasCharacter, desktop, preview }), [hasCharacter, desktop, preview])
  const [index, setIndex] = useState(0)
  const step = steps[Math.min(index, steps.length - 1)] ?? steps[0]
  const cardRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const [spot, setSpot] = useState<{ hole: Rect | null; top: number; left: number } | null>(null)
  const last = index >= steps.length - 1

  useLayoutEffect(() => {
    const place = () => {
      const card = cardRef.current
      if (!card || !step) return
      const node = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null
      const raw = node?.getBoundingClientRect()
      const target: Rect | null = raw
        ? { top: raw.top, left: raw.left, right: raw.right, bottom: raw.bottom, width: raw.width, height: raw.height }
        : null
      const viewport = { width: window.innerWidth, height: window.innerHeight }
      const next = placeCard(target, { width: card.offsetWidth, height: card.offsetHeight }, viewport)
      setSpot({ hole: target ? holeRect(target, viewport) : null, top: next.top, left: next.left })
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [step])

  useEffect(() => {
    nextRef.current?.focus()
  }, [step?.id])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onDone()
        return
      }
      if (event.key !== "Tab") return
      const card = cardRef.current
      if (!card) return
      const items = [...card.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")]
      if (!items.length) return
      const first = items[0]
      const end = items[items.length - 1]
      if (!first || !end) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        end.focus()
      } else if (!event.shiftKey && document.activeElement === end) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onDone])

  if (!step) return null

  return createPortal(
    <div className="tour">
      <div className={spot?.hole ? "tour-blocker" : "tour-scrim"} />
      {spot?.hole ? (
        <div
          className="tour-hole"
          style={{ top: spot.hole.top, left: spot.hole.left, width: spot.hole.width, height: spot.hole.height }}
        />
      ) : null}
      <div
        ref={cardRef}
        className="tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        style={{ top: spot?.top ?? 0, left: spot?.left ?? 0, visibility: spot ? "visible" : "hidden" }}
      >
        <p className="eyebrow">{index + 1} of {steps.length}</p>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-body">{step.body}</p>
        <div className="tour-actions">
          <button type="button" className="ghost" onClick={onDone}>Skip</button>
          <button type="button" className="ghost" onClick={() => setIndex((current) => Math.max(0, current - 1))} disabled={index === 0}>Back</button>
          <button ref={nextRef} type="button" onClick={() => last ? onDone() : setIndex((current) => current + 1)}>
            {last ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
