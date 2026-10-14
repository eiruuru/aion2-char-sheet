const fs = require("fs")
const path = require("path")

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"))
const source = path.join(__dirname, "..", "release", `${pkg.productName || pkg.build.productName}-${pkg.version}-win.zip`)
const built = path.join(__dirname, "..", "release", `Aion 2 Progress-${pkg.version}-win.zip`)
const from = fs.existsSync(source) ? source : built
const destDir = path.join(__dirname, "..", "download")
fs.mkdirSync(destDir, { recursive: true })
fs.copyFileSync(from, path.join(destDir, "Aion2-Progress-windows.zip"))
console.log(`Copied ${path.basename(from)} to download/Aion2-Progress-windows.zip`)
