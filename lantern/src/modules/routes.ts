/**
 * Problems 5, 8 and 10: move safely through the tunnels.
 * Trusted hazard evidence turns the tunnel map into a weighted graph: flooded segments close,
 * dark or dangerously hot blocks cost more to cross. Dijkstra finds the safest short path.
 */
import type { Edge } from '../sim/hollow'
import { FLOOD_CLOSED_CM } from '../sim/hollow'
import type { RecOf } from '../types'

export interface Hazards {
  /** Edge ids that cannot be used. */
  closed: Set<string>
  /** Per-block cost multiplier (>= 1). */
  blockCost: Map<string, number>
  /** Per-segment cost multiplier, e.g. stairs likely to flood next. */
  edgeCost?: Map<string, number>
}

export interface Route {
  path: string[]
  /** Metres. */
  length: number
  /** Hazard-weighted cost. */
  cost: number
}

export function adjacency(edges: Edge[]): Map<string, { to: string; edge: Edge }[]> {
  const adj = new Map<string, { to: string; edge: Edge }[]>()
  for (const e of edges) {
    if (!adj.has(e.a)) adj.set(e.a, [])
    if (!adj.has(e.b)) adj.set(e.b, [])
    adj.get(e.a)!.push({ to: e.b, edge: e })
    adj.get(e.b)!.push({ to: e.a, edge: e })
  }
  return adj
}

/** Shortest hazard-weighted route from `from` to the nearest of `targets`. */
export function routeTo(edges: Edge[], from: string, targets: string[], hz: Hazards): Route | null {
  if (!targets.length) return null
  const goal = new Set(targets)
  const adj = adjacency(edges)
  const dist = new Map<string, number>([[from, 0]])
  const metres = new Map<string, number>([[from, 0]])
  const prev = new Map<string, string>()
  const done = new Set<string>()
  // 48 nodes: a linear scan beats a heap in clarity and is plenty fast.
  for (;;) {
    let u: string | null = null
    let best = Infinity
    for (const [n, d] of dist) if (!done.has(n) && d < best) ((best = d), (u = n))
    if (u === null) return null
    if (goal.has(u)) {
      const path = [u]
      while (prev.has(path[0])) path.unshift(prev.get(path[0])!)
      return { path, length: metres.get(u)!, cost: best }
    }
    done.add(u)
    for (const { to, edge } of adj.get(u) ?? []) {
      if (hz.closed.has(edge.id) || done.has(to)) continue
      const mult = Math.max(hz.blockCost.get(u) ?? 1, hz.blockCost.get(to) ?? 1) * (hz.edgeCost?.get(edge.id) ?? 1)
      const nd = best + edge.length * mult
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd)
        metres.set(to, metres.get(u)! + edge.length)
        prev.set(to, u)
      }
    }
  }
}

/** Hop distance ignoring hazards (used to keep space-sharing matches walkable). */
export function hops(edges: Edge[], from: string): Map<string, number> {
  const adj = adjacency(edges)
  const out = new Map<string, number>([[from, 0]])
  const q = [from]
  while (q.length) {
    const u = q.shift()!
    for (const { to } of adj.get(u) ?? []) {
      if (!out.has(to)) {
        out.set(to, out.get(u)! + 1)
        q.push(to)
      }
    }
  }
  return out
}

export interface FloodState {
  depth: Map<string, number>
  closed: Set<string>
  /** Open edges likely to flood next: the stairs below a flooded segment (water runs downhill). */
  atRisk: Set<string>
}

/** Latest gauge reading per segment decides; gauges are sensors, so one reading is trusted. */
export function floodState(gauges: RecOf<'gauge'>[], edges: Edge[]): FloodState {
  const latest = new Map<string, { ts: number; depth: number }>()
  for (const g of gauges) {
    const cur = latest.get(g.data.edge)
    if (!cur || g.ts >= cur.ts) latest.set(g.data.edge, { ts: g.ts, depth: g.data.depth })
  }
  const depth = new Map([...latest].map(([e, v]) => [e, v.depth]))
  const closed = new Set([...depth].filter(([, d]) => d >= FLOOD_CLOSED_CM).map(([e]) => e))
  const atRisk = new Set<string>()
  const level = (id: string) => Number(id.slice(1, id.indexOf('-')))
  for (const id of closed) {
    const e = edges.find((x) => x.id === id)
    if (!e) continue
    for (const end of [e.a, e.b]) {
      for (const s of edges) {
        if (s.kind !== 'shaft' || closed.has(s.id)) continue
        const lower = level(s.a) > level(s.b) ? s.a : s.b
        const upper = lower === s.a ? s.b : s.a
        if (upper === end && level(lower) > level(end)) atRisk.add(s.id)
      }
    }
  }
  return { depth, closed, atRisk }
}
