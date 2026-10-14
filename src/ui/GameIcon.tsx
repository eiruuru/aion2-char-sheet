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
  return (
    <span className={src ? "game-icon" : "game-icon text"} tabIndex={0}>
      {src ? <img src={src} alt="" /> : <span>{label}</span>}
      {badge ? <span className="icon-badge">{badge}</span> : null}
      <span className="tip" role="tooltip">{text}</span>
    </span>
  )
}
