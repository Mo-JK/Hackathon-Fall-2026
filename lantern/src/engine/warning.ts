import type { Block, Kind } from '../types'
import { isBeyond, KIND_INFO, KINDS, neighborsOf, TICK_MINUTES } from '../sim/world'
import type { Dataset } from './dataset'
import { recent } from './dataset'
import type { BlockTruth } from './trust'

export const WINDOW = 8 // ticks of history fitted
export const HORIZON_TICKS = 12 // warn when threshold is within 120 minutes
const MIN_POINTS = 5

export interface Alert {
  id: string
  blockId: string
  kind: Kind
  level: 'warning' | 'critical'
  etaMinutes: number
  confidence: number
  value: number
  /** Units per hour. */
  slopePerHour: number
  reasons: string[]
}

export interface Fit {
  slope: number
  intercept: number
  r2: number
}

/** Ordinary least squares on (x, y). */
export function regress(points: { x: number; y: number }[]): Fit {
  const n = points.length
  const mx = points.reduce((s, p) => s + p.x, 0) / n
  const my = points.reduce((s, p) => s + p.y, 0) / n
  let sxx = 0
  let sxy = 0
  let syy = 0
  for (const p of points) {
    sxx += (p.x - mx) ** 2
    sxy += (p.x - mx) * (p.y - my)
    syy += (p.y - my) ** 2
  }
  const slope = sxx === 0 ? 0 : sxy / sxx
  const intercept = my - slope * mx
  const r2 = syy === 0 ? 0 : (sxy * sxy) / (sxx * syy)
  return { slope, intercept, r2 }
}

interface Trend extends Fit {
  fitted: number
  latest: number
}

function trendFor(ds: Dataset, block: Block, kind: Kind): Trend | null {
  const pts = recent(ds, block.id, ds.now - WINDOW + 1)
  if (pts.length < MIN_POINTS) return null
  const fit = regress(pts.map((t) => ({ x: t.ts, y: t[kind] })))
  return { ...fit, fitted: fit.intercept + fit.slope * ds.now, latest: pts[pts.length - 1][kind] }
}

const towardCritical = (kind: Kind, slope: number) => slope * KIND_INFO[kind].dir >= KIND_INFO[kind].minSlope

export function computeAlerts(ds: Dataset, truth?: Map<string, BlockTruth>): Alert[] {
  const trends = new Map<string, Trend>()
  for (const b of ds.blocks) {
    for (const kind of KINDS) {
      const t = trendFor(ds, b, kind)
      if (t) trends.set(`${b.id}:${kind}`, t)
    }
  }

  const alerts: Alert[] = []
  for (const b of ds.blocks) {
    for (const kind of KINDS) {
      const t = trends.get(`${b.id}:${kind}`)
      if (!t) continue
      const info = KIND_INFO[kind]
      const already = isBeyond(kind, t.latest) && isBeyond(kind, t.fitted)
      const rising = towardCritical(kind, t.slope) && t.r2 >= 0.5
      let etaTicks = 0
      if (!already) {
        if (!rising) continue
        etaTicks = (info.critical - t.fitted) / t.slope
        if (etaTicks <= 0 || etaTicks > HORIZON_TICKS) continue
      }

      const reasons: string[] = []
      const perHour = t.slope * (60 / TICK_MINUTES)
      if (already) {
        reasons.push(`${info.label} is at ${t.latest.toFixed(info.digits)}${info.unit}, past the critical line of ${info.critical}${info.unit}.`)
      } else {
        reasons.push(
          `${info.label} ${perHour > 0 ? 'rising' : 'falling'} ${Math.abs(perHour).toFixed(info.digits === 0 ? 0 : 1)}${info.unit}/h over the last ${WINDOW * TICK_MINUTES} min (fit r²=${t.r2.toFixed(2)}); critical line ${info.critical}${info.unit} reached in about ${Math.round(etaTicks * TICK_MINUTES)} min.`,
        )
      }

      const trending = neighborsOf(b).filter((nid) => {
        const nt = trends.get(`${nid}:${kind}`)
        return nt && (towardCritical(kind, nt.slope) || isBeyond(kind, nt.latest))
      })
      if (trending.length) reasons.push(`${trending.length} neighbouring block(s) show the same trend: ${trending.join(', ')}.`)

      const ev = truth?.get(b.id)?.evidence[kind]
      if (ev && ev.humans >= 1) reasons.push(`${ev.humans} resident device(s) independently reported a matching problem.`)

      if (kind === 'temp' || kind === 'air') {
        const p = trends.get(`${b.id}:power`)
        if (p && isBeyond('power', p.latest)) reasons.push('Power is already below critical, so cooling and ventilation fans have stopped.')
      }
      if (kind === 'power') reasons.push('Cooling, ventilation and water recyclers on this level depend on this feed.')

      const confidence = already
        ? 0.97
        : Math.min(0.97, 0.45 + t.r2 * 0.25 + Math.min(0.2, trending.length * 0.1) + (ev && ev.humans >= 3 ? 0.15 : 0))

      alerts.push({
        id: `${b.id}:${kind}`,
        blockId: b.id,
        kind,
        level: already ? 'critical' : 'warning',
        etaMinutes: Math.round(etaTicks * TICK_MINUTES),
        confidence,
        value: t.latest,
        slopePerHour: perHour,
        reasons,
      })
    }
  }

  return alerts.sort((a, b) => (a.level === b.level ? a.etaMinutes - b.etaMinutes : a.level === 'warning' ? -1 : 1))
}
