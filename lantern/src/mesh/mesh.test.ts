import { describe, expect, it } from 'vitest'
import type { MsgBody } from '../types'
import { newIdentity, sha256Hex, signBody, verifyMsg } from './crypto'
import { GossipNode } from './gossip'

const body = (id: string): MsgBody => ({ id, blockId: 'L9-B2', ts: 5, wall: 1000, data: { k: 'report', type: 'outage' } })

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

  it('hashes phrases so the phrase never goes on the wire', async () => {
    expect(await sha256Hex('blue-heron-7')).toMatch(/^[0-9a-f]{64}$/)
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
