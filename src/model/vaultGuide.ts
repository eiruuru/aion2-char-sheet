import vault from "./vaultGuide.json"
import type { ClassSituation, ClassSkill, GuideMacro, GuideTip, PriorityMode } from "./classPriorities"

type VaultSkill = { name: string; why: string; detail: string }
type VaultPage = { skills: VaultSkill[]; stigmas: VaultSkill[]; macro: string; quick: string }

const pages = vault as Record<string, Partial<Record<"pve" | "pvp", VaultPage>>>

function sameName(left: string, right: string): boolean {
  const clean = (value: string) => value.toLowerCase().replace(/['’]/g, "")
  return clean(left) === clean(right)
}

function iconFor(name: string, skills: ClassSkill[]): string {
  return skills.find((skill) => sameName(skill.name, name))?.icon ?? ""
}

function descriptionFor(name: string, skills: ClassSkill[]): string {
  return skills.find((skill) => sameName(skill.name, name))?.description ?? ""
}

export function vaultPage(className: string, mode: PriorityMode): VaultPage | null {
  if (mode === "mass") return null
  const trimmed = className.trim().toLowerCase() === "elementalist" ? "spiritmaster" : className.trim().toLowerCase()
  const match = Object.keys(pages).find((name) => name.toLowerCase() === trimmed)
  const page = match ? pages[match]?.[mode] : null
  if (!page || (!page.skills.length && !page.stigmas.length && !page.macro)) return null
  return page
}

export function applyVault(entry: ClassSituation, className: string): ClassSituation {
  const page = vaultPage(className, entry.mode)
  if (!page) return entry
  const skills: ClassSkill[] = [
    ...page.skills.map((skill, index) => ({
      name: skill.name,
      slot: "active" as const,
      tier: index < 3 ? "S" as const : "A" as const,
      why: skill.why,
      detail: skill.detail ? `Level ${skill.detail}` : "",
      description: descriptionFor(skill.name, entry.skills),
      icon: iconFor(skill.name, entry.skills),
    })),
    ...page.stigmas.map((skill) => ({
      name: skill.name,
      slot: "stigma" as const,
      tier: "S" as const,
      why: skill.why,
      detail: skill.detail ? `Level ${skill.detail}` : "",
      description: descriptionFor(skill.name, entry.skills),
      icon: iconFor(skill.name, entry.skills),
    })),
  ]
  const macros: GuideMacro[] = page.macro ? [{ title: "Macro", chain: page.macro }] : []
  const tips: GuideTip[] = page.quick ? [{ title: "Quick answer", action: page.quick, condition: "" }] : []
  return { ...entry, skills, macros, tips, steps: page.quick || entry.steps }
}
