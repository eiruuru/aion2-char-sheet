export const ONBOARDING_KEY = "aion2-onboarding-v1"

export type TourStep = {
  id: string
  title: string
  body: string
  target?: string
}

export type TourContext = {
  hasCharacter: boolean
  desktop: boolean
  preview?: boolean
}

export type Rect = {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

const MARGIN = 12
const GAP = 12

export function visibleSteps(context: TourContext): TourStep[] {
  const hasCharacter = context.hasCharacter || context.preview === true
  const steps: TourStep[] = [
    {
      id: "welcome",
      title: "AION 2 Character Sheet",
      body: "This sheet tracks a local roster and reads public profiles. It does not log into the game.",
    },
    {
      id: "roster",
      title: "Roster",
      target: "roster",
      body: context.preview
        ? "Four free slots and two gold premium slots. The character on screen is an example and is not saved. An empty slot opens search."
        : hasCharacter
          ? "Four free slots and two gold premium slots. An empty slot opens search."
          : "Four free slots and two gold premium slots. An empty slot opens search. The sheet appears after someone is added.",
    },
    {
      id: "tools",
      title: "Tools",
      target: "tools",
      body: context.desktop
        ? "Membership changes the Odyle cap. The pin keeps this window above the game. Export and import are the backup."
        : "Membership changes the Odyle cap. Export and import are the backup.",
    },
  ]
  if (hasCharacter) {
    steps.push(
      {
        id: "profile",
        title: "Profile",
        target: "profile",
        body: "Gear Score and Combat Power sit beside the name. Refresh is under the title.",
      },
      {
        id: "tasks",
        title: "Tasks",
        target: "tasks",
        body: "Dailies, Weeklies, and Seasonal stay on this device. Removing a seasonal task later only hides that row.",
      },
      {
        id: "build",
        title: "Character",
        target: "build",
        body: "Gear, Skills, Daevanion, and Cosmetics are on these tabs.",
      },
      {
        id: "guide",
        title: "Class guide",
        target: "view",
        body: "Guide switches this area to the class priorities for whoever is selected. Sheet brings the character back.",
      },
    )
  }
  steps.push({
    id: "goals",
    title: "Goals",
    target: "goals",
    body: "Odyle is a number you enter from the game. Goals sit under it.",
  })
  return steps
}

export function shouldOpenOnboarding(characterCount: number, seen: boolean): boolean {
  if (characterCount > 0) return false
  return !seen
}

export function readOnboardingSeen(storage: Pick<Storage, "getItem">): boolean {
  try {
    return storage.getItem(ONBOARDING_KEY) === "done"
  } catch {
    return true
  }
}

export function writeOnboardingSeen(storage: Pick<Storage, "setItem">): void {
  storage.setItem(ONBOARDING_KEY, "done")
}

export function clearOnboardingSeen(storage: Pick<Storage, "removeItem">): void {
  try {
    storage.removeItem(ONBOARDING_KEY)
  } catch {
    // Private mode can throw. The tour still opens for this session.
  }
}

export function holeRect(target: Rect, viewport: { width: number; height: number }, pad = 6): Rect {
  const left = clamp(target.left - pad, 4, viewport.width - 4)
  const top = clamp(target.top - pad, 4, viewport.height - 4)
  const right = clamp(target.right + pad, left, viewport.width - 4)
  const bottom = clamp(target.bottom + pad, top, viewport.height - 4)
  return { top, left, right, bottom, width: right - left, height: bottom - top }
}

export function placeCard(
  target: Rect | null,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  const maxTop = viewport.height - card.height - MARGIN
  const maxLeft = viewport.width - card.width - MARGIN
  if (!target) {
    return {
      top: clamp((viewport.height - card.height) / 2, MARGIN, maxTop),
      left: clamp((viewport.width - card.width) / 2, MARGIN, maxLeft),
    }
  }
  const centeredTop = clamp(target.top + (target.height - card.height) / 2, MARGIN, maxTop)
  const right = target.right + GAP
  if (right >= MARGIN && right <= maxLeft) return { top: centeredTop, left: right }
  const left = target.left - GAP - card.width
  if (left >= MARGIN) return { top: centeredTop, left }
  const below = target.bottom + GAP
  const alignedLeft = clamp(target.left, MARGIN, maxLeft)
  if (below <= maxTop) return { top: below, left: alignedLeft }
  const above = target.top - GAP - card.height
  if (above >= MARGIN) return { top: above, left: alignedLeft }
  return { top: centeredTop, left: clamp(right, MARGIN, maxLeft) }
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}
