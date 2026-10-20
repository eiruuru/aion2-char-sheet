const classes = ["gladiator", "templar", "assassin", "ranger", "sorcerer", "spiritmaster", "cleric", "chanter"]
const modes = ["pve", "pvp"]

function text(value) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tables(html) {
  return [...html.matchAll(/<table>([\s\S]*?)<\/table>/g)].map((match) => {
    const rows = [...match[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((row) =>
      [...row[1].matchAll(/<t[hd]>([\s\S]*?)<\/t[hd]>/g)].map((cell) => text(cell[1])),
    )
    return rows.filter((row) => row.length)
  })
}

function glance(rows) {
  const found = {}
  for (const row of rows) {
    if (row.length < 2) continue
    found[row[0]] = row[row.length - 1]
  }
  return found
}

const book = {}
for (const slug of classes) {
  const name = slug[0].toUpperCase() + slug.slice(1)
  book[name] = {}
  for (const mode of modes) {
    const response = await fetch(`https://aion2vault.com/builds/${slug}/${mode}/`)
    if (!response.ok) {
      console.log("skip", slug, mode, response.status)
      continue
    }
    const html = await response.text()
    const parsed = tables(html)
    const skills = []
    const stigmas = []
    let macro = ""
    for (const table of parsed) {
      const head = table[0] ?? []
      const label = head.join(" | ")
      if (head[0] === "Skill" && !/Stagger/i.test(label) && head.some((cell) => /Job|option|target|Level/i.test(cell))) {
        for (const row of table.slice(1)) {
          if (!row[0] || row[0] === "Skill") continue
          skills.push({ name: row[0], why: row[1] ?? "", detail: row.slice(2).filter(Boolean).join(" · ") })
        }
      } else if (head[0] === "Stigma" && head.some((cell) => /does|Effect/i.test(cell))) {
        for (const row of table.slice(1)) {
          if (!row[0] || row[0] === "Stigma") continue
          stigmas.push({ name: row[0], why: row[1] ?? "", detail: row.slice(2).filter(Boolean).join(" · ") })
        }
      } else if (/Stigmas/.test(label) && head[0] !== "Stigma") {
        for (const row of table.slice(1)) {
          const cell = [...row].reverse().find((item) => (item.match(/,/g) ?? []).length >= 2) ?? ""
          const source = row[row.length - 1] ?? ""
          for (const stigmaName of cell.split(/,\s*/)) {
            const name = stigmaName.replace(/\s+\d+$/, "").trim()
            if (!/^[A-Z][A-Za-z'’:-]+(?:\s+[A-Z0-9][A-Za-z'’:-]+){0,5}$/.test(name)) continue
            if (!stigmas.some((item) => item.name === name)) stigmas.push({ name, why: source === cell ? "" : source, detail: "" })
          }
        }
      } else if (head[0] === "Part" || head[0] === "Creator") {
        for (const row of table.slice(1)) {
          const chain = row.find((cell) => cell.includes("→"))
          if (chain) macro = chain
        }
      }
    }
    const quick = text((html.match(/Quick Answer[\s\S]{0,40}<\/p>\s*<p>([\s\S]*?)<\/p>/) ?? [])[1] ?? "")
    book[name][mode] = { skills, stigmas, macro, quick }
    console.log(name, mode, "skills", skills.length, "stigmas", stigmas.length, "macro", Boolean(macro))
  }
}
const { writeFileSync } = await import("node:fs")
writeFileSync(new URL("../src/model/vaultGuide.json", import.meta.url), JSON.stringify(book))
console.log("wrote")
