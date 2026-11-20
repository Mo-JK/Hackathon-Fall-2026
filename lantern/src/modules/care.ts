/**
 * Problems 9 and 10: basic care far from a clinic, and medicine where it is needed.
 * A rule-based checklist (not a diagnosis) sorts lung-sickness symptoms into self-care,
 * needs medicine, or needs a clinic. Only the outcome is shared, never the answers, and
 * block totals are hidden until at least K_ANON different devices have reported.
 */
import type { Block, RecOf, TriageOutcome } from '../types'
import { K_ANON } from './privacy'

export interface Symptoms {
  cough: boolean
  fever: boolean
  breathlessAtRest: boolean
  chestPain: boolean
  blueLips: boolean
  confusion: boolean
  /** Days since symptoms began. */
  days: number
  over65: boolean
  lungCondition: boolean
}

export const NO_SYMPTOMS: Symptoms = {
  cough: false,
  fever: false,
  breathlessAtRest: false,
  chestPain: false,
  blueLips: false,
  confusion: false,
  days: 0,
  over65: false,
  lungCondition: false,
}

export interface TriageResult {
  outcome: TriageOutcome
  reasons: string[]
}

export function triage(s: Symptoms): TriageResult {
  const red: string[] = []
  if (s.breathlessAtRest) red.push('short of breath at rest')
  if (s.blueLips) red.push('blue or grey lips')
  if (s.chestPain) red.push('chest pain')
  if (s.confusion) red.push('new confusion')
  if (red.length) return { outcome: 'clinic', reasons: red.map((r) => `Danger sign: ${r}.`) }

  const reasons: string[] = []
  const risk = s.over65 || s.lungCondition
  if (s.fever && s.cough && (s.days >= 3 || risk)) {
    reasons.push(s.days >= 3 ? 'Fever and cough for 3+ days.' : 'Fever and cough with a risk factor.')
    return { outcome: 'medicine', reasons }
  }
  if ((s.cough || s.fever) && risk && s.days >= 2) return { outcome: 'medicine', reasons: ['Symptoms for 2+ days with a risk factor.'] }
  if (s.cough || s.fever) reasons.push('Mild symptoms: rest, fluids, mask around others, check again tomorrow.')
  else reasons.push('No symptoms of concern.')
  return { outcome: 'self', reasons }
}

export interface CareRow {
  blockId: string
  level: number
  self: number
  medicine: number
  clinic: number
  reporters: number
  /** Fewer than K_ANON distinct devices: counts withheld. */
  hidden: boolean
}

export function careTable(recs: RecOf<'triage'>[], blocks: Block[]): CareRow[] {
  return blocks
    .map((b) => {
      const mine = recs.filter((r) => r.blockId === b.id)
      const reporters = new Set(mine.map((r) => r.deviceKey)).size
      const count = (o: TriageOutcome) => mine.filter((r) => r.data.outcome === o).length
      return { blockId: b.id, level: b.level, self: count('self'), medicine: count('medicine'), clinic: count('clinic'), reporters, hidden: reporters < K_ANON }
    })
    .filter((r) => r.self + r.medicine + r.clinic > 0)
}

/** Courses of medicine to send, split across blocks by demand (visible rows only). */
export function medicineDemand(rows: CareRow[]): { blockId: string; courses: number }[] {
  return rows.filter((r) => !r.hidden && r.medicine > 0).map((r) => ({ blockId: r.blockId, courses: r.medicine }))
}
