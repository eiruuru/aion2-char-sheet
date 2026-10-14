export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <p className="muted">Combat power history starts after the next refresh.</p>
  }
  const width = 280
  const height = 64
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(1, max - min)
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * (width - 8) + 4
      const y = height - 8 - ((value - min) / span) * (height - 16)
      return `${x},${y}`
    })
    .join(" ")
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Combat power history">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
    </svg>
  )
}
