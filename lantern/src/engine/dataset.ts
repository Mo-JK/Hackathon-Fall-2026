import type { Block, Report, Telemetry } from '../types'
import type { Rep } from './reputation'

/** Everything the engines need, so they stay pure and testable. */
export interface Dataset {
  blocks: Block[]
  telemetry: Map<string, Telemetry[]>
  reports: Report[]
  /** Current simulated tick. */
  now: number
  /** When false, raw report counts are used (shows what spam would do without the trust rule). */
  trustOn: boolean
  /** Per-device reputation. Absent: every device counts fully (pre-v2 behaviour). */
  rep?: Map<string, Rep>
}

export function recent(ds: Dataset, blockId: string, fromTs: number): Telemetry[] {
  const all = ds.telemetry.get(blockId)
  if (!all) return []
  return all.filter((t) => t.ts >= fromTs && t.ts <= ds.now)
}
