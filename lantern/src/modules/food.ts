/**
 * Problem 12: a neighbourhood that can feed itself.
 * Blocks keep a shared ledger of their pantry and grow plots. Lantern answers "how many days of
 * food if the central farms cut us off?", and proposes transfers between neighbouring levels
 * so no block runs out while its neighbours have surplus (equalising days left, the same idea
 * as the fair-share rule).
 */
import type { Block, RecOf } from '../types'
import { DAILY_KG, TICKS_PER_DAY } from '../sim/hollow'

export const HORIZON_DAYS = 60

export interface Ledger {
  pantry: number
  plots: { crop: string; kg: number; ready: number }[]
}

export function ledgers(recs: RecOf<'plot'>[]): Map<string, Ledger> {
  const out = new Map<string, Ledger>()
  for (const r of recs) {
    const l = out.get(r.blockId) ?? { pantry: 0, plots: [] }
    if (r.data.crop === 'pantry') l.pantry = r.data.kg
    else l.plots.push({ crop: r.data.crop, kg: r.data.kg, ready: r.data.ready })
    out.set(r.blockId, l)
  }
  return out
}

/** Days until the pantry runs dry, adding each harvest on the day it is ready. */
export function daysLeft(population: number, ledger: Ledger, now: number): number {
  const perDay = population * DAILY_KG
  if (perDay <= 0) return HORIZON_DAYS
  let stock = ledger.pantry
  for (let day = 0; day < HORIZON_DAYS; day++) {
    const end = now + (day + 1) * TICKS_PER_DAY
    const start = now + day * TICKS_PER_DAY
    for (const p of ledger.plots) if (p.ready > start && p.ready <= end) stock += p.kg
    if (stock < perDay) return day + stock / perDay
    stock -= perDay
  }
  return HORIZON_DAYS
}

export interface FoodRow {
  blockId: string
  level: number
  population: number
  pantry: number
  plots: number
  days: number
}

export function foodTable(blocks: Block[], led: Map<string, Ledger>, now: number): FoodRow[] {
  return blocks
    .filter((b) => led.has(b.id))
    .map((b) => {
      const l = led.get(b.id)!
      return { blockId: b.id, level: b.level, population: b.population, pantry: l.pantry, plots: l.plots.length, days: daysLeft(b.population, l, now) }
    })
}

export interface Transfer {
  from: string
  to: string
  kg: number
}

/**
 * Within a district (a level and its neighbours above and below), move pantry food from blocks
 * above the district's average days-of-stock to blocks below it. Uses pantry stock only:
 * harvests are not promised away before they exist.
 */
export function balanceDistrict(rows: FoodRow[], level: number): { transfers: Transfer[]; before: number; after: number } {
  const district = rows.filter((r) => Math.abs(r.level - level) <= 1)
  const daily = (r: FoodRow) => r.population * DAILY_KG
  const totalPantry = district.reduce((s, r) => s + r.pantry, 0)
  const totalDaily = district.reduce((s, r) => s + daily(r), 0)
  if (!district.length || !totalDaily) return { transfers: [], before: 0, after: 0 }
  const target = totalPantry / totalDaily
  const give = district.map((r) => ({ id: r.blockId, kg: r.pantry - target * daily(r) }))
  const donors = give.filter((g) => g.kg > 1).sort((a, b) => b.kg - a.kg)
  const takers = give.filter((g) => g.kg < -1).sort((a, b) => a.kg - b.kg)
  const transfers: Transfer[] = []
  for (const t of takers) {
    let want = -t.kg
    for (const d of donors) {
      if (want <= 0) break
      if (d.kg <= 0) continue
      const kg = Math.min(want, d.kg)
      d.kg -= kg
      want -= kg
      transfers.push({ from: d.id, to: t.id, kg: Math.round(kg) })
    }
  }
  const before = Math.min(...district.map((r) => r.pantry / daily(r)))
  return { transfers, before, after: target }
}

/**
 * Power trade-off: lamp power for farms competes with fans and light rota. `lampShare` of a
 * fixed spare-power budget adds harvest at `kgPerShare` per day per block on the cut-off level.
 */
export function lampTradeoff(lampShare: number, cutOffRows: FoodRow[], fanPeopleAtRisk: number) {
  const extraKgPerDay = lampShare * cutOffRows.reduce((s, r) => s + r.population * DAILY_KG * 0.35, 0)
  const daily = cutOffRows.reduce((s, r) => s + r.population * DAILY_KG, 0)
  const pantry = cutOffRows.reduce((s, r) => s + r.pantry, 0)
  const days = daily > extraKgPerDay ? pantry / (daily - extraKgPerDay) : HORIZON_DAYS
  return { days: Math.min(HORIZON_DAYS, days), peopleLosingFans: Math.round(fanPeopleAtRisk * lampShare) }
}
