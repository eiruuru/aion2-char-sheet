const fs = require("fs")
const path = require("path")

exports.default = async function afterPack(context) {
  const extras = ["LICENSES.chromium.html", "vk_swiftshader.dll", "vk_swiftshader_icd.json"]
  for (const name of extras) {
    fs.rmSync(path.join(context.appOutDir, name), { force: true })
  }
}
