const fs = require("fs")
const path = require("path")
const zlib = require("zlib")

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"))
const source = path.join(__dirname, "..", "release", `${pkg.build.productName}-${pkg.version}-win.zip`)
const destDir = path.join(__dirname, "..", "download")
const dest = path.join(destDir, "Aion2-Progress-windows.zip")

function readU16(buf, offset) {
  return buf.readUInt16LE(offset)
}

function readU32(buf, offset) {
  return buf.readUInt32LE(offset)
}

function rewriteForWindows(input) {
  const eocd = input.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (eocd < 0) throw new Error("The packed zip has no central directory")
  const count = readU16(input, eocd + 10)
  let pos = readU32(input, eocd + 16)
  const files = []
  for (let index = 0; index < count; index += 1) {
    if (readU32(input, pos) !== 0x02014b50) throw new Error("Broken central directory")
    const method = readU16(input, pos + 10)
    const time = readU16(input, pos + 12)
    const date = readU16(input, pos + 14)
    const crc = readU32(input, pos + 16)
    const compressed = readU32(input, pos + 20)
    const uncompressed = readU32(input, pos + 24)
    const nameLength = readU16(input, pos + 28)
    const extraLength = readU16(input, pos + 30)
    const commentLength = readU16(input, pos + 32)
    const localOffset = readU32(input, pos + 42)
    const name = input.subarray(pos + 46, pos + 46 + nameLength)
    pos += 46 + nameLength + extraLength + commentLength
    if (name[name.length - 1] === 0x2f) continue
    const localName = readU16(input, localOffset + 26)
    const localExtra = readU16(input, localOffset + 28)
    const payloadStart = localOffset + 30 + localName + localExtra
    files.push({
      name,
      method,
      time,
      date,
      crc,
      compressed,
      uncompressed,
      payload: input.subarray(payloadStart, payloadStart + compressed),
    })
  }

  const out = []
  const central = []
  let offset = 0
  for (const file of files) {
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(file.method, 8)
    local.writeUInt16LE(file.time, 10)
    local.writeUInt16LE(file.date, 12)
    local.writeUInt32LE(file.crc, 14)
    local.writeUInt32LE(file.compressed, 18)
    local.writeUInt32LE(file.uncompressed, 22)
    local.writeUInt16LE(file.name.length, 26)
    local.writeUInt16LE(0, 28)
    out.push(local, file.name, file.payload)

    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt16LE(0, 8)
    entry.writeUInt16LE(file.method, 10)
    entry.writeUInt16LE(file.time, 12)
    entry.writeUInt16LE(file.date, 14)
    entry.writeUInt32LE(file.crc, 16)
    entry.writeUInt32LE(file.compressed, 20)
    entry.writeUInt32LE(file.uncompressed, 24)
    entry.writeUInt16LE(file.name.length, 28)
    entry.writeUInt16LE(0, 30)
    entry.writeUInt16LE(0, 32)
    entry.writeUInt16LE(0, 34)
    entry.writeUInt16LE(0, 36)
    entry.writeUInt32LE(0, 38)
    entry.writeUInt32LE(offset, 42)
    central.push(entry, file.name)
    offset += local.length + file.name.length + file.payload.length
  }

  const centralBytes = Buffer.concat(central)
  const eocdBuf = Buffer.alloc(22)
  eocdBuf.writeUInt32LE(0x06054b50, 0)
  eocdBuf.writeUInt16LE(files.length, 8)
  eocdBuf.writeUInt16LE(files.length, 10)
  eocdBuf.writeUInt32LE(centralBytes.length, 12)
  eocdBuf.writeUInt32LE(offset, 16)
  return Buffer.concat([...out, centralBytes, eocdBuf])
}

fs.mkdirSync(destDir, { recursive: true })
const rewritten = rewriteForWindows(fs.readFileSync(source))
fs.writeFileSync(dest, rewritten)

const check = rewritten.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
const sampleNameLength = readU16(rewritten, 26)
const sampleExtra = readU16(rewritten, 28)
const sampleMethod = readU16(rewritten, 8)
const sampleCompressed = readU32(rewritten, 18)
const samplePayload = rewritten.subarray(30 + sampleNameLength + sampleExtra, 30 + sampleNameLength + sampleExtra + Math.min(sampleCompressed, 64))
if (sampleMethod === 8) zlib.inflateRawSync(rewritten.subarray(30 + sampleNameLength, 30 + sampleNameLength + sampleCompressed))
if (sampleExtra !== 0 || check < 0 || samplePayload.length === 0) {
  throw new Error("Repacked zip is missing a plain file entry")
}
console.log(`Wrote download/Aion2-Progress-windows.zip (${rewritten.length} bytes)`)
