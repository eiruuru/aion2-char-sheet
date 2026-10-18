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
})