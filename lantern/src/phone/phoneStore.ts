import type { Msg, MsgData, ReportType, SosNeed, TriageOutcome } from '../types'
import { fingerprint, hasWebCrypto, phraseHash, signBody, uid } from '../mesh/crypto'
import type { Identity } from '../mesh/crypto'
import { GossipNode } from '../mesh/gossip'
import { BroadcastTransport, SocketTransport } from '../mesh/transport'
import { loadIdentity, saveOutbox } from '../db'
import { isStale, relayBase, normalisePhrase } from '../store'

export interface PhoneSnap {
  ready: boolean
  me: string
  block: string
  relayUp: boolean
  peers: number
  sent: { id: string; text: string; wall: number }[]
  vouchedBy: string | null
  family: { blockId: string; wall: number }[]
  sosNearby: number
  /** Real SOS calls from other devices in the last 30 minutes, newest first. */
  calls: { blockId: string; need: SosNeed; responders: number; mineAnswering: boolean }[]
  /** People who answered this phone's own latest SOS (null if it sent none). */
  myResponders: number | null
  crypto: 'webcrypto' | 'noble'
  error: string | null
}

const BLOCK_KEY = 'lantern.phone.block'

/**
 * A phone in the mesh. It runs no simulation: it has its own key, signs what its owner sends,
 * and gossips over the relay (and to tabs on the same device). Everything else happens on
 * the laptop and on other phones that receive its messages.
 */
class PhoneStore {
  private me: Identity | null = null
  private node: GossipNode
  private block = readBlock()
  private sent: PhoneSnap['sent'] = []
  private phraseHashValue: string | null = null
  private error: string | null = null
  private listeners = new Set<() => void>()
  private snap: PhoneSnap
  private started = false

  constructor() {
    this.node = new GossipNode(
      () => this.emit(),
      () => this.emit(),
      { role: 'phone', dev: () => this.me?.deviceKey ?? '' },
    )
    this.snap = this.build()
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  getSnapshot = () => this.snap

  private emit() {
    this.snap = this.build()
    this.listeners.forEach((l) => l())
  }

  async start() {
    if (this.started) return
    this.started = true
    try {
      this.me = await loadIdentity('identity-phone')
      this.node.start([new BroadcastTransport(), new SocketTransport(relayBase().ws)])
      window.addEventListener('pagehide', () => this.node.stop())
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e)
    }
    this.emit()
  }

  setBlock = (b: string) => {
    this.block = b
    try {
      localStorage.setItem(BLOCK_KEY, b)
    } catch {
      /* ignore */
    }
    this.emit()
  }

  private async send(data: MsgData, text: string) {
    if (!this.me) return
    const m = await signBody(this.me, { id: `u-${uid()}`, blockId: this.block, ts: 0, wall: Date.now(), data }, 'user')
    await this.node.ingest(m)
    this.node.publish(m)
    await saveOutbox(m)
    this.sent.unshift({ id: m.id, text, wall: Date.now() })
    this.sent = this.sent.slice(0, 6)
    this.emit()
  }

  checkIn = async (phrase: string) => {
    const h = await phraseHash(normalisePhrase(phrase))
    this.phraseHashValue = h
    await this.send({ k: 'checkin', codeHash: h }, `I'm OK (family phrase)`)
  }
  setPhrase = async (phrase: string) => {
    this.phraseHashValue = phrase.trim() ? await phraseHash(normalisePhrase(phrase)) : null
    this.emit()
  }
  sos = (need: SosNeed) => this.send({ k: 'sos', need }, `SOS: ${need}`)
  respond = (blockId: string) => this.send({ k: 'respond', to: blockId }, `On my way to the SOS in ${blockId}`)
  report = (type: ReportType, text: string) => this.send({ k: 'report', type }, text)
  triage = (outcome: TriageOutcome) => this.send({ k: 'triage', outcome }, `Triage: ${outcome}`)

  private build(): PhoneSnap {
    const msgs = [...this.node.log.values()]
    const pub = this.me?.pub
    const live = msgs.filter((m) => !isStale(m))
    const responses = live.filter((m) => m.data.k === 'respond')
    const answering = (blockId: string, since: number) => responses.filter((r) => r.data.k === 'respond' && r.data.to === blockId && r.wall >= since)
    const sosMsgs = live.filter((m) => m.data.k === 'sos').sort((a, b) => b.wall - a.wall)
    const mySos = sosMsgs.find((m) => m.pub === pub)
    const calls = sosMsgs
      .filter((m) => m.pub !== pub)
      .slice(0, 4)
      .map((m) => {
        const who = answering(m.blockId, m.wall)
        return { blockId: m.blockId, need: (m.data as { need: SosNeed }).need, responders: new Set(who.map((r) => r.pub)).size, mineAnswering: who.some((r) => r.pub === pub) }
      })
    const vouch = msgs.find((m: Msg) => m.data.k === 'vouch' && m.data.target === pub)
    const family = this.phraseHashValue
      ? msgs.filter((m) => m.data.k === 'checkin' && m.data.codeHash === this.phraseHashValue && m.pub !== pub).map((m) => ({ blockId: m.blockId, wall: m.wall }))
      : []
    return {
      ready: !!this.me,
      me: this.me?.deviceKey ?? '',
      block: this.block,
      relayUp: this.node.links().some((l) => l.name === 'relay' && l.up),
      peers: this.node.peerCount(),
      sent: this.sent,
      vouchedBy: vouch ? fingerprint(vouch.pub) : null,
      family,
      sosNearby: calls.length,
      calls,
      myResponders: mySos ? new Set(answering(mySos.blockId, mySos.wall).filter((r) => r.pub !== pub).map((r) => r.pub)).size : null,
      crypto: hasWebCrypto ? 'webcrypto' : 'noble',
      error: this.error,
    }
  }
}

function readBlock(): string {
  try {
    return localStorage.getItem(BLOCK_KEY) ?? 'L4-B1'
  } catch {
    return 'L4-B1'
  }
}

export const phone = new PhoneStore()
