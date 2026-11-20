import type { Block, Kind, ReportType } from '../types'
import { isBeyond, KINDS } from '../sim/world'
import type { Dataset } from './dataset'
import { recent } from './dataset'

/** A block only changes state on the shared map when independent evidence adds up to this. */
export const TRUST_THRESHOLD = 3
export const SENSOR_WEIGHT = 3
export const HUMAN_WEIGHT = 1
/** 6 ticks = 60 simulated minutes. */
export const TRUST_WINDOW = 6

const REPORT_KIND: Partial<Record<ReportType, Kind>> = { outage: 'power', water_taste: 'water' }

export interface KindEvidence {
  kind: Kind
  /** A sensor reading confirms the problem. */
  sensor: boolean
  /** Distinct devices that reported (or raw count when the trust rule is off). */
  humans: number
  rawReports: number
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

export function evidenceFor(ds: Dataset, block: Block): BlockTruth {
  const since = ds.now - TRUST_WINDOW + 1
  const latest = recent(ds, block.id, ds.now - 1)
  const evidence = {} as Record<Kind, KindEvidence>
  let rejected = 0

  for (const kind of KINDS) {
    const sensor = latest.length >= 2 && latest.every((t) => isBeyond(kind, t[kind]))
    const matching = ds.reports.filter(
      (r) => r.blockId === block.id && r.ts >= since && r.ts <= ds.now && REPORT_KIND[r.type] === kind,
    )
    const distinct = new Set(matching.map((r) => r.deviceKey)).size
    const humans = ds.trustOn ? distinct : matching.length
    if (ds.trustOn) rejected += matching.length - distinct
    const weight = (sensor ? SENSOR_WEIGHT : 0) + humans * HUMAN_WEIGHT
    evidence[kind] = { kind, sensor, humans, rawReports: matching.length, weight, flagged: weight >= TRUST_THRESHOLD }
  }

  return {
    blockId: block.id,
    evidence,
    flaggedKinds: KINDS.filter((k) => evidence[k].flagged),
    rejected,
  }
}

export function computeTruth(ds: Dataset): Map<string, BlockTruth> {
  return new Map(ds.blocks.map((b) => [b.id, evidenceFor(ds, b)]))
}
