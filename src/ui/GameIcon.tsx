import { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

export function GameIcon({
  src,
  label,
  badge,
  tip,
}: {
  src?: string
  label: string
  badge?: string
  tip?: string
}) {
  const text = tip ?? (badge ? `${label} ${badge}` : label)
  const hostRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const host = hostRef.current
      const tipNode = tipRef.current
      if (!host || !tipNode) return
      const rect = host.getBoundingClientRect()
      const margin = 8
      const width = tipNode.offsetWidth
      const height = tipNode.offsetHeight
      let left = rect.left + rect.width / 2 - width / 2
      left = Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - width - margin))
      let top = rect.top - height - 8
      if (top < margin) top = rect.bottom + 8
      if (top + height > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - height - margin)
      setPos({ top, left })
    }
    place()
    window.addEventListener("scroll", place, true)
    window.addEventListener("resize", place)
    return () => {
      window.removeEventListener("scroll", place, true)
      window.removeEventListener("resize", place)
    }
  }, [open, text])

  return (
    <span
      ref={hostRef}
      className={src ? "game-icon" : "game-icon text"}
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {src ? <img src={src} alt="" /> : <span>{label}</span>}
      {badge ? <span className="icon-badge">{badge}</span> : null}
      {open ? createPortal(
        <span ref={tipRef} className="tip floating" role="tooltip" style={{ top: pos.top, left: pos.left }}>{text}</span>,
        document.body,
      ) : null}
    </span>
  )
}
