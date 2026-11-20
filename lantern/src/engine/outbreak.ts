import { neighborsOf, REPORT_RATE } from '../sim/world'
import type { Dataset } from './dataset'

export const RECENT = 6 // ticks of recent reports compared with baseline
export const CALIBRATION_TICKS = 18 // quiet period used to learn each block's normal rate
export const Z_FLAG = 3
export const MIN_RECENT = 3

export interface BlockOutbreak {
  blockId: string
  recent: number
  expected: number
  z: number
  flagged: boolean
  estCases: number
}

export interface Cluster {
  blocks: string[]
  estCases: number
}

export interface Outbreak {
  blocks: Map<string, BlockOutbreak>
  clusters: Cluster[]
  estimatedCases: number
}

export function computeOutbreak(ds: Dataset): Outbreak {
  const sym = ds.reports.filter((r) => r.type === 'symptom')
  const byBlock = new Map<string, typeof sym>()
  for (const r of sym) {
    const list = byBlock.get(r.blockId)
    if (list) list.push(r)
    else byBlock.set(r.blockId, [r])
  }

  // With the trust rule on, a device counts at most once per tick.
  const count = (list: typeof sym, from: number, to: number) => {
    const inRange = list.filter((r) => r.ts >= from && r.ts <= to)
    return ds.trustOn ? new Set(inRange.map((r) => `${r.deviceKey}:${r.ts}`)).size : inRange.length
  }

  const blocks = new Map<string, BlockOutbreak>()
  for (const b of ds.blocks) {
    const list = byBlock.get(b.id) ?? []
    const calEnd = Math.min(CALIBRATION_TICKS, ds.now)
    const baseline = Math.max(0.05, count(list, 1, calEnd) / Math.max(1, calEnd))
    const rec = count(list, ds.now - RECENT + 1, ds.now)
    const expected = baseline * RECENT
    const z = (rec - expected) / Math.sqrt(Math.max(expected, 0.5))
    const flagged = ds.now > CALIBRATION_TICKS && z >= Z_FLAG && rec >= MIN_RECENT
    const estCases = flagged ? Math.max(0, (rec / RECENT - baseline) / REPORT_RATE) : 0
    blocks.set(b.id, { blockId: b.id, recent: rec, expected, z, flagged, estCases })
  }

  // Merge adjacent flagged blocks into clusters.
  const byId = new Map(ds.blocks.map((b) => [b.id, b]))
  const seen = new Set<string>()
  const clusters: Cluster[] = []
  for (const b of ds.blocks) {
    if (!blocks.get(b.id)?.flagged || seen.has(b.id)) continue
    const group: string[] = []
    const queue = [b.id]
    seen.add(b.id)
    while (queue.length) {
      const id = queue.shift()!
      group.push(id)
      for (const nid of neighborsOf(byId.get(id)!)) {
        if (!seen.has(nid) && blocks.get(nid)?.flagged) {
          seen.add(nid)
          queue.push(nid)
        }
      }
    }
    clusters.push({ blocks: group, estCases: group.reduce((s, id) => s + blocks.get(id)!.estCases, 0) })
  }
  clusters.sort((a, c) => c.estCases - a.estCases)

  return { blocks, clusters, estimatedCases: clusters.reduce((s, c) => s + c.estCases, 0) }
}

/** Largest-remainder split of `total` units in proportion to `weights`. */
export function distribute(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0)
  if (sum <= 0) return weights.map(() => 0)
  const exact = weights.map((w) => (total * w) / sum)
  const out = exact.map(Math.floor)
  let left = total - out.reduce((s, n) => s + n, 0)
  const order = exact.map((e, i) => ({ i, frac: e - Math.floor(e) })).sort((a, b) => b.frac - a.frac)
  for (const { i } of order) {
    if (left <= 0) break
    out[i]++
    left--
  }
  return out
}
