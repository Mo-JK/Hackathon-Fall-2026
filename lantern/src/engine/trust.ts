import type { Block, Kind, Report, ReportType } from '../types'
import { isBeyond, KINDS } from '../sim/world'
import type { Dataset } from './dataset'
import { recent } from './dataset'
import { isTrusted, NEWCOMER_CAP, repOf, TREE_CAP } from './reputation'

/** A block only changes state on the shared map when independent evidence adds up to this. */
export const TRUST_THRESHOLD = 3
export const SENSOR_WEIGHT = 3
export const HUMAN_WEIGHT = 1
/** 6 ticks = 60 simulated minutes. */
export const TRUST_WINDOW = 6

export const REPORT_KIND: Partial<Record<ReportType, Kind>> = { outage: 'power', water_taste: 'water' }

export interface KindEvidence {
  kind: Kind
  /** A sensor reading confirms the problem. */
  sensor: boolean
  /** Distinct devices that reported (or raw count when the trust rule is off). */
  humans: number
  rawReports: number
  /** Weight from trusted (established, vouched or earned) devices. */
  trustedWeight: number
  /** Distinct newcomer keys that reported. */
  newcomers: number
  /** Newcomer weight after the cap. */
  newcomerWeight: number
  weight: number
  flagged: boolean
}

export interface BlockTruth {
  blockId: string
  evidence: Record<Kind, KindEvidence>
  flaggedKinds: Kind[]
  /** Reports ignored because they came from a device that had already been counted. */
  rejected: number
}

const round2 = (x: number) => Math.round(x * 100) / 100

/** `blockReports`: this block's reports, if the caller has already grouped them (saves a full scan per block). */
export function evidenceFor(ds: Dataset, block: Block, blockReports?: Report[]): BlockTruth {
  const since = ds.now - TRUST_WINDOW + 1
  const latest = recent(ds, block.id, ds.now - 1)
  const evidence = {} as Record<Kind, KindEvidence>
  let rejected = 0
  const inWindow = (blockReports ?? ds.reports.filter((r) => r.blockId === block.id)).filter((r) => r.ts >= since && r.ts <= ds.now)

  for (const kind of KINDS) {
    const sensor = latest.length >= 2 && latest.every((t) => isBeyond(kind, t[kind]))
    const matching = inWindow.filter((r) => REPORT_KIND[r.type] === kind)
    const keys = [...new Set(matching.map((r) => r.deviceKey))]
    // Trusted weight is summed per vouch tree, each tree capped, so vouching can't multiply a voice.
    const trees = new Map<string, number>()
    let newcomerRaw = 0
    let newcomers = 0
    for (const k of keys) {
      const rep = repOf(ds.rep, k)
      if (isTrusted(rep)) {
        const root = rep.vouchedBy ?? k
        trees.set(root, (trees.get(root) ?? 0) + rep.weight * HUMAN_WEIGHT)
      } else {
        newcomers++
        newcomerRaw += rep.weight * HUMAN_WEIGHT
      }
    }
    const trustedWeight = [...trees.values()].reduce((s, w) => s + Math.min(TREE_CAP, w), 0)
    const newcomerWeight = Math.min(NEWCOMER_CAP, newcomerRaw)
    const humans = ds.trustOn ? keys.length : matching.length
    if (ds.trustOn) rejected += matching.length - keys.length
    const weight = round2((sensor ? SENSOR_WEIGHT : 0) + (ds.trustOn ? trustedWeight + newcomerWeight : matching.length * HUMAN_WEIGHT))
    evidence[kind] = {
      kind,
      sensor,
      humans,
      rawReports: matching.length,
      trustedWeight: round2(trustedWeight),
      newcomers,
      newcomerWeight: round2(newcomerWeight),
      weight,
      flagged: weight >= TRUST_THRESHOLD,
    }
  }

  return {
    blockId: block.id,
    evidence,
    flaggedKinds: KINDS.filter((k) => evidence[k].flagged),
    rejected,
  }
}

export function computeTruth(ds: Dataset): Map<string, BlockTruth> {
  const byBlock = new Map<string, Report[]>()
  for (const r of ds.reports) {
    const list = byBlock.get(r.blockId)
    if (list) list.push(r)
    else byBlock.set(r.blockId, [r])
  }
  return new Map(ds.blocks.map((b) => [b.id, evidenceFor(ds, b, byBlock.get(b.id) ?? [])]))
}
