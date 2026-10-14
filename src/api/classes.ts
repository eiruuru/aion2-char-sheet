export type PlayClass = {
  name: string
  icon: string
}

export type PcClassRow = {
  id: number
  className: string
  classText?: string
}

const ICON_KEYS: Record<string, string> = {
  spiritmaster: "elementalist",
  brawler: "fighter",
}

export function classIconUrl(className: string): string {
  return `https://assets.playnccdn.com/static-aion2/characters/img/class/class_icon_${className.toLowerCase()}.png`
}

export function classIconForName(name: string): string {
  const key = ICON_KEYS[name.trim().toLowerCase()] ?? name.trim().toLowerCase()
  return classIconUrl(key)
}

export function playClassesFrom(rows: PcClassRow[]): Map<number, PlayClass> {
  const classes = new Map<number, PlayClass>()
  for (const row of rows) {
    if (!row.className) continue
    classes.set(row.id, {
      name: row.classText || row.className,
      icon: classIconUrl(row.className),
    })
  }
  return classes
}
