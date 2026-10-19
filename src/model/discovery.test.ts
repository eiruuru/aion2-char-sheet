import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const decode = require("../../electron/capture/decode.cjs") as {
  npcapPresent: (exists: (file: string) => boolean) => boolean
  proposeField: (before: Buffer, after: Buffer, direction: string) => { offset: number; width: number; after: number } | null
  confirmField: (hits: Record<string, number>, kind: string, field: { offset: number; width: number }) => { offset: number; width: number } | null
  applyConfirmed: (layout: Record<string, unknown>, kind: string, field: { offset: number; width: number } | null) => { odyle?: { offset: number; width: number }; petSouls?: { offset: number; width: number } }
  decodePacket: (buf: Buffer, layout: { odyle?: { offset: number; width: number }; petSouls?: { offset: number; width: number } }) => { odyle?: number; souls?: number }
  createRing: () => { push: (buf: Buffer, at: number) => void; pair: () => { before: { bytes: Buffer }; after: { bytes: Buffer } } | null }
  pickAdapter: (rows: { name?: string; description?: string; udp?: number }[]) => { name: string; udp: number } | null
  extractNames: (buf: Buffer) => string[]
  matchRosterName: (names: string[], roster: string[]) => string | null
  isLikelyMobName: (name: string) => boolean
  findOdyleTotal: (buf: Buffer) => number | null
  realAdapters: (devices: { name?: string; description?: string }[]) => { name: string }[]
  parseFarmableNames: (source: string) => string[]
  decodeLz4Block: (src: Buffer) => Buffer | null
  matchCatalogName: (text: string, names: string[]) => string | null
  createGameStream: (names: string[]) => {
    push: (meta: {
      proto: string
      srcaddr: string
      dstaddr: string
      srcport: number
      dstport: number
      seq: number
      flags: number
      payload: Buffer
    }, marked: boolean) => {
      names: string[]
      attempts: number
      appended: number
      framed: number
      selfId: number | null
      trace: { kind: string; dead: number; killer: number; selfId: number; pet: string; mine: boolean } | null
      traces?: { kind: string; pet?: string }[]
    }
  }
}

function packet(odyle: number, souls: number): Buffer {
  const buf = Buffer.alloc(16)
  buf.writeUInt32LE(odyle, 4)
  buf.writeUInt16LE(souls, 10)
  return buf
}

describe("packet discovery", () => {
  it("notices Npcap only when a known driver file exists", () => {
    expect(decode.npcapPresent(() => false)).toBe(false)
    expect(decode.npcapPresent((file) => file.endsWith("Npcap\\wpcap.dll"))).toBe(true)
  })

  it("locks an Odyle field after the same change is marked twice", () => {
    const before = packet(640, 12)
    const after = packet(650, 12)
    const field = decode.proposeField(before, after, "increase")
    expect(field).toMatchObject({ offset: 4, width: 4, after: 650 })
    const hits: Record<string, number> = {}
    expect(decode.confirmField(hits, "odyle", field!)).toBeNull()
    const locked = decode.confirmField(hits, "odyle", field!)
    const layout = decode.applyConfirmed({}, "odyle", locked)
    expect(decode.decodePacket(after, layout).odyle).toBe(650)
  })

  it("locks pet souls from a gain and ignores a packet that is too short to pair", () => {
    const before = packet(650, 12)
    const after = packet(650, 13)
    const field = decode.proposeField(before, after, "increase")
    expect(field).toMatchObject({ offset: 10, width: 2, after: 13 })
    const hits: Record<string, number> = {}
    decode.confirmField(hits, "pet", field!)
    const locked = decode.confirmField(hits, "pet", field!)
    const layout = decode.applyConfirmed({}, "pet", locked)
    expect(decode.decodePacket(after, layout).souls).toBe(13)
    const ring = decode.createRing()
    expect(ring.pair()).toBeNull()
    ring.push(before, 1)
    ring.push(after, 2)
    expect(ring.pair()?.after.bytes.readUInt16LE(10)).toBe(13)
  })

  it("keeps the adapter that saw the most UDP payloads", () => {
    expect(decode.pickAdapter([
      { name: "wifi", udp: 2 },
      { name: "ethernet", description: "Realtek", udp: 40 },
      { name: "loopback", udp: 0 },
    ])).toEqual({ name: "ethernet", description: "Realtek", udp: 40 })
    expect(decode.pickAdapter([{ name: "idle", udp: 0 }])).toBeNull()
  })

  it("reads a name and the Odyle total beside a cap, and skips virtual adapters", () => {
    const named = Buffer.alloc(32)
    named.write("Aria", 0, "utf8")
    const wide = Buffer.alloc(16)
    wide.write("Aria", 0, "utf16le")
    expect(decode.extractNames(named)).toContain("Aria")
    expect(decode.extractNames(wide)).toContain("Aria")
    expect(decode.matchRosterName(["Sparkie", "Aria"], ["Nyx", "Aria"])).toBe("Aria")
    expect(decode.matchRosterName(["Sparkie"], ["Aria"])).toBeNull()
    expect(decode.isLikelyMobName("Dratona")).toBe(true)
    expect(decode.isLikelyMobName("Elite Klaw")).toBe(true)
    expect(decode.isLikelyMobName("Dwb")).toBe(false)
    expect(decode.isLikelyMobName("wNH")).toBe(false)
    expect(decode.isLikelyMobName("DhUCr")).toBe(false)
    expect(decode.isLikelyMobName("All Welcome")).toBe(false)
    const odyle = Buffer.alloc(12)
    odyle.writeUInt32LE(640, 0)
    odyle.writeUInt32LE(840, 4)
    expect(decode.findOdyleTotal(odyle)).toBe(640)
    expect(decode.realAdapters([
      { name: "eth", description: "Realtek Gaming" },
      { name: "lo", description: "Npcap Loopback" },
      { name: "bt", description: "Bluetooth Device" },
      { name: "vpn", description: "Hyper-V Virtual Ethernet" },
    ]).map((device) => device.name)).toEqual(["eth"])
  })

  it("reads a packed farm mob from the reassembled game stream", () => {
    const names = decode.parseFarmableNames('["Fera", "Sparkie"]\n["Fera", "Giant Sparkie"]\n["Special", "Swift Lugi"]')
    expect(names).toEqual(["Sparkie", "Giant Sparkie"])
    expect(decode.matchCatalogName("Giant Odyle Sparkie", names)).toBe("Giant Sparkie")
    expect(decode.matchCatalogName("NOX", names)).toBeNull()
    const text = Buffer.from("Giant Odyle Sparkie")
    const packed = Buffer.concat([Buffer.from([0xf0, text.length - 15]), text])
    expect(decode.decodeLz4Block(packed)?.toString("latin1")).toBe("Giant Odyle Sparkie")
    const framedBody = Buffer.concat([Buffer.from([text.length + 4]), text])
    const stream = decode.createGameStream(names)
    const first = framedBody.subarray(0, 6)
    const second = framedBody.subarray(6)
    const missed = stream.push({
      proto: "tcp", srcaddr: "10.0.0.2", dstaddr: "10.0.0.1", srcport: 13328, dstport: 40000,
      seq: 100, flags: 0, payload: first,
    }, false)
    expect(missed.names).toEqual([])
    const later = stream.push({
      proto: "tcp", srcaddr: "10.0.0.2", dstaddr: "10.0.0.1", srcport: 13328, dstport: 40000,
      seq: 106, flags: 0, payload: second,
    }, false)
    expect(later.names).toEqual([])
    const found = stream.push({
      proto: "tcp", srcaddr: "10.0.0.8", dstaddr: "10.0.0.9", srcport: 13328, dstport: 50000,
      seq: 1, flags: 0, payload: Buffer.from("Lunatiq"),
    }, true)
    expect(found.names).toEqual([])
    const noise = stream.push({
      proto: "tcp", srcaddr: "10.0.0.8", dstaddr: "10.0.0.9", srcport: 13328, dstport: 50000,
      seq: 2, flags: 0, payload: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9]),
    }, false)
    expect(noise.names).toEqual([])
    const early = stream.push({
      proto: "tcp", srcaddr: "10.0.0.9", dstaddr: "10.0.0.8", srcport: 50000, dstport: 13328,
      seq: 44, flags: 0, payload: first,
    }, false)
    expect(early.names).toEqual([])
    const joined = stream.push({
      proto: "tcp", srcaddr: "10.0.0.9", dstaddr: "10.0.0.8", srcport: 50000, dstport: 13328,
      seq: 50, flags: 0, payload: second,
    }, false)
    expect(joined.names).toEqual([])
  })

  it("frames a real header and a compressed bundle without inventing a name", () => {
    const names = ["Sparkie", "Giant Sparkie"]
    const stream = decode.createGameStream(names)
    stream.push({
      proto: "tcp", srcaddr: "10.0.0.8", dstaddr: "10.0.0.9", srcport: 13328, dstport: 50000,
      seq: 1, flags: 0, payload: Buffer.from("Lunatiq"),
    }, true)
    const sample = stream.push({
      proto: "tcp", srcaddr: "10.0.0.9", dstaddr: "10.0.0.8", srcport: 50000, dstport: 13328,
      seq: 10, flags: 0, payload: Buffer.from("0e003649757550a1010000", "hex"),
    }, false)
    expect(sample.names).toEqual([])
    expect(sample.framed).toBe(1)
    const text = Buffer.from("Giant Odyle Sparkie")
    const inner = Buffer.concat([Buffer.from([text.length + 4]), text])
    const block = Buffer.concat([Buffer.from([0xf0, inner.length - 15]), inner])
    const bundle = Buffer.concat([
      Buffer.from([0xff, 0xff]),
      Buffer.from([inner.length, 0, 0, 0]),
      block,
    ])
    const outer = Buffer.concat([Buffer.from([bundle.length + 4]), bundle])
    const opened = stream.push({
      proto: "tcp", srcaddr: "10.0.0.9", dstaddr: "10.0.0.8", srcport: 50000, dstport: 13328,
      seq: 21, flags: 0, payload: outer,
    }, false)
    expect(opened.names).toEqual([])
    expect(opened.framed).toBeGreaterThan(1)
  })

  it("credits a farm pet only when this character's id is the killer", () => {
    const names = ["Sparkie", "Giant Sparkie", "Armadon"]
    const stream = decode.createGameStream(names)
    const frame = (body: Buffer) => Buffer.concat([Buffer.from([body.length + 4]), body])
    const sparkie = frame(Buffer.from([0x41, 0x36, 0x10, 0x3c, 0x0e, 0x20, 0x00, 0x40, 0x02]))
    const armadon = frame(Buffer.from([0x41, 0x36, 0x11, 0x0f, 0x0e, 0x20, 0x00, 0x40, 0x02]))
    const selfHp = frame(Buffer.from([0x00, 0x8d, 0xb2, 0x0c, 0x01, 0x01]))
    const someoneElse = frame(Buffer.from([0x42, 0x36, 0x11, 0x00, 0x03]))
    const mobHitsUs = frame(Buffer.from([0x04, 0x38, 0x10, 0x06, 0x00, 0xb2, 0x0c]))
    const ourHit = frame(Buffer.from([0x04, 0x38, 0xb2, 0x0c, 0x06, 0x00, 0x10]))
    const mine = frame(Buffer.from([0x42, 0x36, 0x10, 0x00, 0x01]))
    stream.push({
      proto: "tcp", srcaddr: "10.0.0.8", dstaddr: "10.0.0.9", srcport: 13328, dstport: 50000,
      seq: 1, flags: 0, payload: Buffer.from("Lunatiq"),
    }, true)
    let seq = 20
    const push = (payload: Buffer) => {
      const result = stream.push({
        proto: "tcp", srcaddr: "10.0.0.9", dstaddr: "10.0.0.8", srcport: 50000, dstport: 13328,
        seq, flags: 0, payload,
      }, false)
      seq += payload.length
      return result
    }
    const spawned = push(Buffer.concat([selfHp, sparkie, armadon]))
    expect(spawned.names).toEqual([])
    expect(spawned.selfId).toBe(1586)
    const other = push(someoneElse)
    expect(other.names).toEqual([])
    expect(other.trace).toMatchObject({ dead: 17, pet: "Armadon", flag: 3, mine: false })
    const incoming = push(mobHitsUs)
    expect(incoming.names).toEqual([])
    const outgoing = push(ourHit)
    expect(outgoing.names).toEqual([])
    expect(outgoing.traces?.some((row) => row.kind === "hit" && row.pet === "Giant Sparkie")).toBe(true)
    const kill = push(mine)
    expect(kill.names).toEqual(["Giant Sparkie"])
    expect(kill.trace).toMatchObject({ dead: 16, pet: "Giant Sparkie" })
  })

  it("credits a farm pet when this character's skill packet names it", () => {
    const names = ["Sparkie", "Giant Sparkie", "Armadon"]
    const stream = decode.createGameStream(names)
    const frame = (body: Buffer) => Buffer.concat([Buffer.from([body.length + 4]), body])
    const sparkie = frame(Buffer.from([0x41, 0x36, 0x10, 0x3c, 0x0e, 0x20, 0x00, 0x40, 0x02]))
    const armadon = frame(Buffer.from([0x41, 0x36, 0x11, 0x0f, 0x0e, 0x20, 0x00, 0x40, 0x02]))
    const selfHp = frame(Buffer.from([0x00, 0x8d, 0xb2, 0x0c, 0x01, 0x01]))
    const ourCast = frame(Buffer.from([0x02, 0x38, 0xb2, 0x0c, 0x00, 0x06, 0x01, 0x02, 0x10]))
    const mine = frame(Buffer.from([0x42, 0x36, 0x10, 0x00, 0x03]))
    const other = frame(Buffer.from([0x42, 0x36, 0x11, 0x00, 0x01]))
    stream.push({
      proto: "tcp", srcaddr: "10.0.0.8", dstaddr: "10.0.0.9", srcport: 13328, dstport: 50000,
      seq: 1, flags: 0, payload: Buffer.from("Lunatiq"),
    }, true)
    let seq = 20
    const push = (payload: Buffer) => {
      const result = stream.push({
        proto: "tcp", srcaddr: "10.0.0.9", dstaddr: "10.0.0.8", srcport: 50000, dstport: 13328,
        seq, flags: 0, payload,
      }, false)
      seq += payload.length
      return result
    }
    push(Buffer.concat([selfHp, sparkie, armadon]))
    expect(push(ourCast).names).toEqual([])
    expect(push(mine).names).toEqual(["Giant Sparkie"])
    expect(push(other).names).toEqual([])
  })

  it("counts two mobs of the same pet and ignores a repeated death", () => {
    const names = ["Giant Sparkie"]
    const stream = decode.createGameStream(names)
    const frame = (body: Buffer) => Buffer.concat([Buffer.from([body.length + 4]), body])
    const first = frame(Buffer.from([0x41, 0x36, 0x10, 0x3c, 0x0e, 0x20, 0x00, 0x40, 0x02]))
    const second = frame(Buffer.from([0x41, 0x36, 0x12, 0x3c, 0x0e, 0x20, 0x00, 0x40, 0x02]))
    const selfHp = frame(Buffer.from([0x00, 0x8d, 0xb2, 0x0c, 0x01, 0x01]))
    const castFirst = frame(Buffer.from([0x02, 0x38, 0xb2, 0x0c, 0x00, 0x06, 0x01, 0x02, 0x10]))
    const castSecond = frame(Buffer.from([0x02, 0x38, 0xb2, 0x0c, 0x00, 0x06, 0x01, 0x03, 0x12]))
    const dieFirst = frame(Buffer.from([0x42, 0x36, 0x10, 0x00, 0x03]))
    const dieSecond = frame(Buffer.from([0x42, 0x36, 0x12, 0x00, 0x03]))
    stream.push({
      proto: "tcp", srcaddr: "10.0.0.8", dstaddr: "10.0.0.9", srcport: 13328, dstport: 50000,
      seq: 1, flags: 0, payload: Buffer.from("Lunatiq"),
    }, true)
    let seq = 20
    const push = (payload: Buffer) => {
      const result = stream.push({
        proto: "tcp", srcaddr: "10.0.0.9", dstaddr: "10.0.0.8", srcport: 50000, dstport: 13328,
        seq, flags: 0, payload,
      }, false)
      seq += payload.length
      return result
    }
    push(Buffer.concat([selfHp, first, second, castFirst, castSecond]))
    expect(push(dieFirst).names).toEqual(["Giant Sparkie"])
    expect(push(dieSecond).names).toEqual(["Giant Sparkie"])
    expect(push(dieFirst).names).toEqual([])
  })

  it("reads the mob id after the skill counter", () => {
    const names = ["Giant Sparkie"]
    const stream = decode.createGameStream(names)
    const frame = (body: Buffer) => Buffer.concat([Buffer.from([body.length + 4]), body])
    const sparkie = frame(Buffer.from([0x41, 0x36, 0xb1, 0xb5, 0x02, 0x3c, 0x0e, 0x20, 0x00, 0x40, 0x02]))
    const selfHp = frame(Buffer.from([0x00, 0x8d, 0xe9, 0x20, 0x01, 0x01]))
    const ourCast = frame(Buffer.from("0238e92000408e03014702b1b502", "hex"))
    const mine = frame(Buffer.from([0x42, 0x36, 0xb1, 0xb5, 0x02, 0x00, 0x03]))
    stream.push({
      proto: "tcp", srcaddr: "10.0.0.8", dstaddr: "10.0.0.9", srcport: 13328, dstport: 50000,
      seq: 1, flags: 0, payload: Buffer.from("Lunatiq"),
    }, true)
    let seq = 20
    const push = (payload: Buffer) => {
      const result = stream.push({
        proto: "tcp", srcaddr: "10.0.0.9", dstaddr: "10.0.0.8", srcport: 50000, dstport: 13328,
        seq, flags: 0, payload,
      }, false)
      seq += payload.length
      return result
    }
    push(Buffer.concat([selfHp, sparkie]))
    expect(push(ourCast).names).toEqual([])
    expect(push(mine).names).toEqual(["Giant Sparkie"])
  })
})