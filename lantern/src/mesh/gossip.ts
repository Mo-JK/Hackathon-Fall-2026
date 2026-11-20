import type { Msg } from '../types'
import { verifyMsg } from './crypto'

export const MAX_HOPS = 16

const PEER_TTL_MS = 25_000
const HEARTBEAT_MS = 10_000

type Wire =
  | { t: 'hello'; from: string }
  | { t: 'bye'; from: string }
  | { t: 'inv'; from: string; to: string; ids: string[] }
  | { t: 'want'; from: string; to: string; ids: string[] }
  | { t: 'msgs'; from: string; to?: string; msgs: Msg[] }

export interface GossipStats {
  accepted: number
  duplicates: number
  /** Dropped: bad signature or out-of-range hop count. */
  invalid: number
  relayed: number
}

/**
 * Store-and-forward gossip. Every accepted message is kept in `log`. When a peer appears
 * (another tab/device) we offer an inventory of user messages, the peer asks for what it
 * lacks, and we send it. Messages are signed, deduplicated by id and carry a hop budget.
 * Simulated-swarm traffic stays local; only user-originated messages cross the peer link.
 */
export class GossipNode {
  readonly nodeId = crypto.randomUUID()
  readonly log = new Map<string, Msg>()
  readonly peers = new Map<string, number>()
  stats: GossipStats = { accepted: 0, duplicates: 0, invalid: 0, relayed: 0 }
  private chan: BroadcastChannel | null = null
  private beat: ReturnType<typeof setInterval> | null = null

  constructor(private onAccept: (m: Msg) => void, private onChange: () => void) {}

  start() {
    if (typeof BroadcastChannel === 'undefined' || this.chan) return
    this.chan = new BroadcastChannel('lantern-mesh')
    this.chan.onmessage = (e: MessageEvent<Wire>) => void this.onWire(e.data)
    this.send({ t: 'hello', from: this.nodeId })
    this.beat = setInterval(() => {
      this.send({ t: 'hello', from: this.nodeId })
      this.onChange()
    }, HEARTBEAT_MS)
  }

  stop() {
    this.send({ t: 'bye', from: this.nodeId })
    if (this.beat) clearInterval(this.beat)
    this.chan?.close()
    this.chan = null
  }

  /** Peers heard from recently. */
  peerCount(): number {
    const cutoff = Date.now() - PEER_TTL_MS
    for (const [id, seen] of this.peers) if (seen < cutoff) this.peers.delete(id)
    return this.peers.size
  }

  private send(w: Wire) {
    this.chan?.postMessage(w)
  }

  private userMsgs(): Msg[] {
    return [...this.log.values()].filter((m) => m.origin === 'user')
  }

  /** Verify, dedupe and store a message. Returns true if it was new and valid. */
  async ingest(m: Msg): Promise<boolean> {
    if (this.log.has(m.id)) {
      this.stats.duplicates++
      return false
    }
    if (m.hops > MAX_HOPS || m.ttl < 0 || !(await verifyMsg(m))) {
      this.stats.invalid++
      return false
    }
    if (this.log.has(m.id)) return false // arrived twice while verifying
    this.log.set(m.id, m)
    this.stats.accepted++
    this.onAccept(m)
    return true
  }

  /** Publish a message this node just created to peers. */
  publish(m: Msg) {
    if (m.origin === 'user') this.send({ t: 'msgs', from: this.nodeId, msgs: [m] })
  }

  dropSwarm() {
    for (const [id, m] of this.log) if (m.origin === 'swarm') this.log.delete(id)
  }

  /** Number of my own user messages no peer has acknowledged yet (queued store-and-forward). */
  pendingFor(pub: string): number {
    return this.peerCount() === 0 ? this.userMsgs().filter((m) => m.pub === pub).length : 0
  }

  private seen(from: string) {
    this.peers.set(from, Date.now())
    this.onChange()
  }

  private async onWire(w: Wire) {
    if (w.from === this.nodeId) return
    if ('to' in w && w.to && w.to !== this.nodeId) return
    if (w.t === 'bye') {
      this.peers.delete(w.from)
      this.onChange()
      return
    }
    this.seen(w.from)
    switch (w.t) {
      case 'hello': {
        // Replying with our inventory also tells the newcomer we exist.
        this.send({ t: 'inv', from: this.nodeId, to: w.from, ids: this.userMsgs().map((m) => m.id) })
        break
      }
      case 'inv': {
        const missing = w.ids.filter((id) => !this.log.has(id))
        if (missing.length) this.send({ t: 'want', from: this.nodeId, to: w.from, ids: missing })
        break
      }
      case 'want': {
        const msgs = w.ids.map((id) => this.log.get(id)).filter((m): m is Msg => !!m && m.origin === 'user')
        if (msgs.length) this.send({ t: 'msgs', from: this.nodeId, to: w.from, msgs })
        break
      }
      case 'msgs': {
        for (const raw of w.msgs) {
          const m: Msg = { ...raw, origin: 'user', hops: raw.hops + 1, ttl: raw.ttl - 1 }
          if ((await this.ingest(m)) && m.ttl > 1) {
            this.stats.relayed++
            this.send({ t: 'msgs', from: this.nodeId, msgs: [m] })
          }
        }
        this.onChange()
        break
      }
    }
  }
}
