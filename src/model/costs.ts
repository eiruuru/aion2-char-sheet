/** Published node-grade costs: common stat 1, rare skill 2, legend skill 3, unique core 4. */
export function estimateNodeCost(type: string, grade: string): number | null {
  if (type === "Stat" && grade === "Common") return 1
  if (type === "Stat" && grade === "Unique") return 4
  if (type === "SkillLevel" && grade === "Rare") return 2
  if (type === "SkillLevel" && grade === "Legend") return 3
  if (type === "SkillLevel" && grade === "Unique") return 4
  return null
}
