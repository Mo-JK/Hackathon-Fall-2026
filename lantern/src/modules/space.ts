/**
 * Problem 6: find or share space.
 * Crowding is measured per block (people per room). Residents post spare space (a bed shift, a
 * quiet room, a cool room) or ask for it; requests are matched greedily, most crowded first,
 * to the nearest walkable offer. The rule is shown in the UI so anyone can check it.
 */
import type { Block, RecOf, SpaceWhat } from '../types'
import type { Edge } from '../sim/hollow'
import { roomsOf } from '../sim/hollow'
import { hops } from './routes'

export const MAX_HOPS = 3

export interface CrowdRow {
  blockId: string
  level: number
  perRoom: number
}

export const crowding = (blocks: Block[]): CrowdRow[] =>
  blocks.map((b) => ({ blockId: b.id, level: b.level, perRoom: b.population / roomsOf(b) }))

export interface Match {
  requestId: string
  offerId: string
  from: string
  to: string
  what: SpaceWhat
  slots: number
  hops: number
}

export interface SpaceResult {
  matches: Match[]
  /** Request slots left unmatched. */
  unmatched: number
  /** Request slots matched. */
  served: number
  openOffers: number
}

/**
 * Need score = people per room x depth hardship, doubled for a cool-room request from a block in
 * heat danger. Highest need is matched first, to the nearest offer of the same kind within 3 hops.
 */
export function matchSpace(
  offers: RecOf<'space'>[],
  requests: RecOf<'space'>[],
  blocks: Block[],
  edges: Edge[],
  heatDanger: (blockId: string) => boolean,
): SpaceResult {
  const byId = new Map(blocks.map((b) => [b.id, b]))
  const crowd = new Map(crowding(blocks).map((c) => [c.blockId, c.perRoom]))
  const score = (r: RecOf<'space'>) => {
    const b = byId.get(r.blockId)
    const base = (crowd.get(r.blockId) ?? 1) * (b?.hardship ?? 1)
    return r.data.what === 'cool' && heatDanger(r.blockId) ? base * 2 : base
  }
  const left = new Map(offers.map((o) => [o.id, o.data.slots]))
  const distCache = new Map<string, Map<string, number>>()
  const dist = (from: string) => {
    let d = distCache.get(from)
    if (!d) distCache.set(from, (d = hops(edges, from)))
    return d
  }

  const matches: Match[] = []
  let unmatched = 0
  let served = 0
  const queue = [...requests].sort((a, b) => score(b) - score(a) || a.ts - b.ts)
  for (const r of queue) {
    let need = r.data.slots
    const d = dist(r.blockId)
    const candidates = offers
      .filter((o) => o.data.what === r.data.what && (left.get(o.id) ?? 0) > 0 && (d.get(o.blockId) ?? 99) <= MAX_HOPS)
      .sort((a, b) => (d.get(a.blockId) ?? 99) - (d.get(b.blockId) ?? 99) || a.ts - b.ts)
    for (const o of candidates) {
      if (!need) break
      const give = Math.min(need, left.get(o.id)!)
      left.set(o.id, left.get(o.id)! - give)
      need -= give
      matches.push({ requestId: r.id, offerId: o.id, from: o.blockId, to: r.blockId, what: r.data.what, slots: give, hops: d.get(o.blockId) ?? 0 })
    }
    served += r.data.slots - need
    unmatched += need
  }
  return { matches, unmatched, served, openOffers: [...left.values()].reduce((s, n) => s + n, 0) }
}
