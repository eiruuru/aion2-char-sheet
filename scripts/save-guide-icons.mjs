import { mkdir, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const data = require("../src/model/classPriorities.json")
const names = new Set()
function walk(value) {
  if (!value || typeof value !== "object") return
  if (typeof value.icon === "string" && value.icon.endsWith(".png")) names.add(value.icon)
  for (const item of Object.values(value)) walk(item)
}
walk(data)
const dir = new URL("../public/guide-icons/", import.meta.url)
await mkdir(dir, { recursive: true })
let saved = 0
for (const name of names) {
  const response = await fetch(`https://aion2-guide.com/assets/icons/${name}`)
  if (!response.ok) {
    console.log("miss", name, response.status)
    continue
  }
  await writeFile(new URL(name, dir), Buffer.from(await response.arrayBuffer()))
  saved += 1
}
const { writeFileSync } = await import("node:fs")
writeFileSync(new URL("../src/model/guideIconManifest.json", import.meta.url), JSON.stringify([...names].filter((name) => name.endsWith(".png"))))
console.log("saved", saved, "of", names.size)
