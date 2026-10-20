import { writeFileSync } from "node:fs"
import { downloadGuide } from "../src/model/guideRefresh.ts"

const classes = await downloadGuide()
writeFileSync(new URL("../src/model/classPriorities.json", import.meta.url), JSON.stringify({
  source: "https://aion2-guide.com",
  checked: "2026-10-20",
  classes,
}))
const sample = classes.Gladiator?.find((entry) => entry.situation === "bosses")
console.log("gladiator bosses", sample?.skills[0]?.name, Boolean(sample?.skills[0]?.description), sample?.arcana?.length, sample?.pantheon?.length, sample?.shops?.length)
