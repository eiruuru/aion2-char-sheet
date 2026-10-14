export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value)
}

export function formatWhen(value: number | string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "unknown time"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

export function formatManila(value: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value)
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "less than a minute"
  const totalMinutes = Math.floor(ms / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "0s"
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

export function skillCategoryLabel(category: string): string {
  if (category === "Dp") return "Specialty"
  return category
}
