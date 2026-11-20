import { describe, expect, it } from 'vitest'
import { p256 } from '@noble/curves/nist.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { pbkdf2 } from '@noble/hashes/pbkdf2.js'
import type { Msg, MsgBody } from '../types'
import { fromHex, newIdentity, PHRASE_ITERATIONS, PHRASE_SALT, phraseHash, phraseStrength, sha256Hex, signBody, stable, toHex, uid, verifyMsg } from './crypto'
import { GossipNode } from './gossip'
import { MemoryHub, MemoryTransport } from './transport'

const body = (id: string): MsgBody => ({ id, blockId: 'L9-B2', ts: 5, wall: 1000, data: { k: 'report', type: 'outage' } })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('signing', () => {
  it('verifies an untouched message', async () => {
    const id = await newIdentity()
    expect(await verifyMsg(await signBody(id, body('a'), 'user'))).toBe(true)
  })

  it('rejects a tampered message', async () => {
    const id = await newIdentity()
    const m = await signBody(id, body('a'), 'user')
    expect(await verifyMsg({ ...m, blockId: 'L1-B1' })).toBe(false)
  })

  it('rejects a message signed by someone else', async () => {
    const a = await newIdentity()
    const b = await newIdentity()
    const m = await signBody(a, body('a'), 'user')
    expect(await verifyMsg({ ...m, pub: b.pub })).toBe(false)
  })

  it('a phone signing with noble is verified by a laptop using WebCrypto', async () => {
    const phone = await newIdentity(true)
    expect(phone.stored.kind).toBe('noble')
    expect(await verifyMsg(await signBody(phone, body('p'), 'user'))).toBe(true)
  })

  it('a laptop signature verifies under noble (what a phone does)', async () => {
    const laptop = await newIdentity()
    const m = await signBody(laptop, body('l'), 'user')
    const bytes = new TextEncoder().encode(stable({ id: m.id, blockId: m.blockId, ts: m.ts, wall: m.wall, data: m.data }))
    expect(p256.verify(fromHex(m.sig), bytes, fromHex(m.pub), { lowS: false })).toBe(true)
  })

  it('makes ids without crypto.randomUUID', () => {
    expect(uid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('family phrases', () => {
  it('stretches phrases with PBKDF2 and matches the pure-JS result phones compute', async () => {
    const web = await phraseHash('blue-heron-7')
    const js = toHex(pbkdf2(sha256, 'blue-heron-7', PHRASE_SALT, { c: PHRASE_ITERATIONS, dkLen: 32 }))
    expect(web).toBe(js)
    expect(web).not.toBe(await sha256Hex('blue-heron-7'))
  })

  it('rates short phrases weak and long unusual ones strong', () => {
    expect(phraseStrength('cat').label).toBe('weak')
    expect(phraseStrength('violet tunnel otter 1987 lamp').label).toBe('strong')
  })
})

describe('gossip ingest', () => {
  it('accepts once, drops duplicates and invalid messages', async () => {
    const accepted: string[] = []
    const node = new GossipNode((m) => accepted.push(m.id), () => {})
    const id = await newIdentity()
    const m = await signBody(id, body('m1'), 'user')
    expect(await node.ingest(m)).toBe(true)
    expect(await node.ingest(m)).toBe(false)
    expect(await node.ingest({ ...(await signBody(id, body('m2'), 'user')), blockId: 'L1-B1' })).toBe(false)
    expect(await node.ingest({ ...(await signBody(id, body('m3'), 'user')), hops: 99 })).toBe(false)
    expect(accepted).toEqual(['m1'])
    expect(node.stats).toMatchObject({ accepted: 1, duplicates: 1, invalid: 2 })
  })
})

describe('gossip over a transport', () => {
  it('delivers a published message to a live peer', async () => {
    const hub = new MemoryHub()
    const got: string[] = []
    const a = new GossipNode(() => {}, () => {})
    const b = new GossipNode((m) => got.push(m.id), () => {})
    a.start([new MemoryTransport(hub)])
    b.start([new MemoryTransport(hub)])
    const m = await signBody(await newIdentity(), body('live'), 'user')
    await a.ingest(m)
    a.publish(m)
    await sleep(50)
    expect(got).toContain('live')
    a.stop()
    b.stop()
  })

  it('a device that was offline catches up when it reconnects (anti-entropy)', async () => {
    const hub = new MemoryHub()
    const a = new GossipNode(() => {}, () => {})
    a.start([new MemoryTransport(hub)])
    const id = await newIdentity()
    const missed: Msg[] = []
    for (const n of ['x1', 'x2', 'x3']) {
      const m = await signBody(id, body(n), 'user')
      missed.push(m)
      await a.ingest(m)
      a.publish(m) // nobody is listening yet
    }
    const got: string[] = []
    const b = new GossipNode((m) => got.push(m.id), () => {})
    b.start([new MemoryTransport(hub)])
    await sleep(80)
    expect(got.sort()).toEqual(['x1', 'x2', 'x3'])
    expect(b.lastCatchUp?.n).toBe(3)
    a.stop()
    b.stop()
  })

  it('relayed copies are verified again and forged ones are dropped', async () => {
    const hub = new MemoryHub()
    const b = new GossipNode(() => {}, () => {})
    b.start([new MemoryTransport(hub)])
    const evil = new MemoryTransport(hub)
    evil.start(() => {}, () => {})
    const m = await signBody(await newIdentity(), body('f'), 'user')
    evil.send({ t: 'msgs', from: 'evil', msgs: [{ ...m, blockId: 'L1-B1' }] })
    await sleep(50)
    expect(b.stats.invalid).toBe(1)
    expect(b.log.size).toBe(0)
    b.stop()
  })
})
