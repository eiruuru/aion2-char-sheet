const pages = [
  "ranger/pve", "cleric/pve", "templar/pve", "sorcerer/pve", "chanter/pve",
  "gladiator/pvp", "ranger/pvp", "cleric/pvp",
]
function text(value) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}
for (const page of pages) {
  const html = await (await fetch(`https://aion2vault.com/builds/${page}/`)).text()
  console.log("\n==", page)
  for (const match of html.matchAll(/<table>([\s\S]*?)<\/table>/g)) {
    const heads = [...match[1].matchAll(/<th>([\s\S]*?)<\/th>/g)].map((cell) => text(cell[1]))
    const first = [...match[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].slice(0, 3).map((cell) => text(cell[1]))
    console.log(heads.join(" | "), "=>", first.join(" / "))
  }
}
