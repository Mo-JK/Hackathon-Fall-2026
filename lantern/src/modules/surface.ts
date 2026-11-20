/**
 * Problems 13 and 14: is the surface safe, and who goes up first, in what?
 *
 * Proof of Air: sealed probes in the upper shafts sign every reading and chain it to the
 * previous one (each entry carries the hash of the entry before). Anyone can re-check the
 * whole log offline. Changing one old reading breaks its signature, and the next entry's
 * link, so tampering is visible from that point on. Lantern reports evidence, not a verdict.
 */
import { sha256 } from '@noble/hashes/sha2.js'
import type { Msg, ProbeData } from '../types'
import { stable, toHex, verifyMsg } from '../mesh/crypto'
import type { Volunteer } from '../sim/hollow'

export const AQI_CLEAN = 50
/** Breathable with a filter mask. */
export const AQI_MASK = 100
export const AQI_UNSAFE = 150
export const O2_MIN = 19.5
/** Days of continuous safe evidence before a shaft's stage can open. */
export const SAFE_DAYS_TO_OPEN = 14

export type ProbeMsg = Msg & { data: ProbeData }

/** The hash the next entry must carry: covers the reading and the probe's signature. */
export function entryHash(m: { data: ProbeData; sig: string }): string {
  return toHex(sha256(new TextEncoder().encode(stable({ data: m.data, sig: m.sig }))))
}

export type EntryStatus = 'ok' | 'bad-signature' | 'bad-link' | 'unverified'

export interface ChainCheck {
  statuses: EntryStatus[]
  /** Index of the first failing entry, or -1 when the whole chain checks out. */
  firstBad: number
  ok: number
}

/**
 * Entries must be one probe's chain in sequence order. `probePub` is the probe's registered key
 * (published when it was sealed); a reading re-signed by anyone else fails.
 */
export async function verifyChain(entries: ProbeMsg[], probePub = entries[0]?.pub, onProgress?: (done: number) => void): Promise<ChainCheck> {
  const statuses: EntryStatus[] = []
  let firstBad = -1
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    if (firstBad >= 0) {
      statuses.push('unverified')
      continue
    }
    const expectPrev = i === 0 ? '' : entryHash(entries[i - 1])
    if (e.pub !== probePub || !(await verifyMsg(e))) {
      statuses.push('bad-signature')
      firstBad = i
    } else if (e.data.prev !== expectPrev || e.data.seq !== i) {
      statuses.push('bad-link')
      firstBad = i
    } else statuses.push('ok')
    if (onProgress && i % 40 === 0) onProgress(i)
  }
  return { statuses, firstBad, ok: statuses.filter((s) => s === 'ok').length }
}

export interface Assessment {
  probe: string
  days: number
  /** Mean AQI over the last 7 days, with a 95% confidence half-width. */
  last7: number
  ci: number
  /** AQI change per day over the last 14 days (least squares). */
  slope: number
  minO2: number
  /** Consecutive most-recent days with daily mean AQI under AQI_MASK and O2 above O2_MIN. */
  daysSafe: number
  verdict: 'mask' | 'uncertain' | 'unsafe' | 'no-evidence'
  daily: { day: number; aqi: number }[]
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length)

export function assess(probe: string, readings: ProbeData[]): Assessment {
  if (!readings.length) return { probe, days: 0, last7: 0, ci: 0, slope: 0, minO2: 0, daysSafe: 0, verdict: 'no-evidence', daily: [] }
  const byDay = new Map<number, ProbeData[]>()
  for (const r of readings) byDay.set(r.day, [...(byDay.get(r.day) ?? []), r])
  const days = [...byDay.keys()].sort((a, b) => a - b)
  const daily = days.map((d) => ({ day: d, aqi: mean(byDay.get(d)!.map((r) => r.aqi)), o2: Math.min(...byDay.get(d)!.map((r) => r.o2)) }))

  const last7 = readings.filter((r) => r.day > days[days.length - 1] - 7).map((r) => r.aqi)
  const m7 = mean(last7)
  const sd = Math.sqrt(mean(last7.map((x) => (x - m7) ** 2)))
  const ci = (1.96 * sd) / Math.sqrt(Math.max(1, last7.length))

  const recent = daily.slice(-14)
  const mx = mean(recent.map((d) => d.day))
  const my = mean(recent.map((d) => d.aqi))
  const sxx = recent.reduce((s, d) => s + (d.day - mx) ** 2, 0)
  const slope = sxx ? recent.reduce((s, d) => s + (d.day - mx) * (d.aqi - my), 0) / sxx : 0

  let daysSafe = 0
  for (let i = daily.length - 1; i >= 0 && daily[i].aqi <= AQI_MASK && daily[i].o2 >= O2_MIN; i--) daysSafe++
  const minO2 = Math.min(...daily.slice(-7).map((d) => d.o2))
  const verdict = m7 + ci <= AQI_MASK && minO2 >= O2_MIN ? 'mask' : m7 - ci > AQI_UNSAFE || minO2 < O2_MIN ? 'unsafe' : 'uncertain'
  return { probe, days: days.length, last7: m7, ci, slope, minO2, daysSafe, verdict, daily: daily.map(({ day, aqi }) => ({ day, aqi })) }
}

/** A shaft's stage opens only on verified evidence that has held for SAFE_DAYS_TO_OPEN days. */
export const shaftOpen = (a: Assessment | undefined, verified: boolean) => !!a && verified && a.verdict === 'mask' && a.daysSafe >= SAFE_DAYS_TO_OPEN

// ---------- problem 14: what to go up in ----------

export interface OptionRow {
  id: 'suit' | 'outpost' | 'dome'
  name: string
  capacity: number
  buildDays: number
  costIndex: number
  /** Share of outside air the occupant is exposed to. */
  exposure: number
  risk: number
  score: number
  viable: boolean
}

const OPTIONS: Omit<OptionRow, 'risk' | 'score' | 'viable'>[] = [
  { id: 'suit', name: 'Sealed suits', capacity: 40, buildDays: 7, costIndex: 1, exposure: 1 },
  { id: 'outpost', name: 'Sealed outposts', capacity: 120, buildDays: 30, costIndex: 3, exposure: 0.35 },
  { id: 'dome', name: 'Pressurised domes', capacity: 400, buildDays: 75, costIndex: 8, exposure: 0.15 },
]

/** Published scoring: 40% safety, 20% capacity, 20% speed, 20% cost. No trusted evidence: nothing is viable. */
export function surfaceOptions(aqi: number | null): OptionRow[] {
  return OPTIONS.map((o) => {
    const risk = aqi === null ? 1 : Math.min(1, (o.exposure * aqi) / AQI_UNSAFE)
    const score = 0.4 * (1 - risk) + 0.2 * (o.capacity / 400) + 0.2 * (7 / o.buildDays) + 0.2 * (1 / o.costIndex)
    return { ...o, risk, score, viable: risk <= 0.5 }
  }).sort((a, b) => Number(b.viable) - Number(a.viable) || b.score - a.score)
}

export interface CohortPick {
  volunteer: Volunteer
  score: number
  why: string
}

export const REQUIRED_SKILLS = ['medic', 'engineer', 'sensor-tech']

/**
 * Published cohort rule: only volunteers who consented; score = 40% health + 35% skills + 25%
 * stated risk acceptance; the first places go to the best-scoring person for each required
 * skill, the rest by score. Depth never counts against anyone.
 */
export function rankCohort(vols: Volunteer[], size = 6): { picks: CohortPick[]; eligible: number; declined: number } {
  const eligible = vols.filter((v) => v.consent)
  const score = (v: Volunteer) => 0.4 * v.health + 0.35 * Math.min(1, v.skills.length / 2) + 0.25 * v.riskAccept
  const sorted = [...eligible].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))
  const picks: CohortPick[] = []
  const taken = new Set<string>()
  for (const skill of REQUIRED_SKILLS) {
    const v = sorted.find((x) => !taken.has(x.id) && x.skills.includes(skill))
    if (v && picks.length < size) {
      taken.add(v.id)
      picks.push({ volunteer: v, score: score(v), why: `best-scoring ${skill}` })
    }
  }
  for (const v of sorted) {
    if (picks.length >= size) break
    if (taken.has(v.id)) continue
    taken.add(v.id)
    picks.push({ volunteer: v, score: score(v), why: 'by score' })
  }
  return { picks, eligible: eligible.length, declined: vols.length - eligible.length }
}
