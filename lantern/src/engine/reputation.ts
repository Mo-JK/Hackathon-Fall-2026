/**
 * Sybil resistance. Making keys is free, so a key alone earns almost nothing:
 * - A brand-new key weighs 0.25, and ALL newcomer keys reporting on a block together are capped
 *   at 0.5. Fifty fake keys count for half of one honest resident.
 * - A key becomes trusted when an established member vouches for it in person (QR / code
 *   exchange), or slowly by agreeing with sensors over many hours.
 * - Each voucher can vouch for at most 3 keys, a vouched key cannot vouch further, and a member
 *   plus everyone they vouched for count at most 1.5 together on any one question. One
 *   corrupted member cannot mint an army.
 */
export const NEWCOMER_WEIGHT = 0.25
export const NEWCOMER_CAP = 0.5
/** Combined weight of one vouch tree (a member and the keys they vouched for). */
export const TREE_CAP = 1.5
export const TRUSTED_MIN = 0.75
export const VOUCH_BUDGET = 3
/** Weight a vouched key gets, as a fraction of its voucher's weight. */
export const VOUCH_FACTOR = 0.75
/** Each agreeing sim-hour adds this much, up to AGREE_MAX. */
export const AGREE_STEP = 0.05
export const AGREE_MAX = 0.5

export type RepStatus = 'established' | 'vouched' | 'earned' | 'newcomer'

export interface Rep {
  weight: number
  status: RepStatus
  vouchedBy?: string
}

export interface Vouch {
  from: string
  to: string
  ts: number
}

export interface RepInput {
  /** Members known before today (the simulated community's history). */
  established: Set<string>
  vouches: Vouch[]
  /** Distinct sim-hours in which this key's reports agreed with sensor readings. */
  agreeHours: Map<string, number>
}

export function computeReputation(input: RepInput): Map<string, Rep> {
  const rep = new Map<string, Rep>()
  for (const k of input.established) rep.set(k, { weight: 1, status: 'established' })

  const spent = new Map<string, number>()
  for (const v of [...input.vouches].sort((a, b) => a.ts - b.ts)) {
    const voucher = rep.get(v.from)
    // Only established members vouch: a vouched key cannot extend the tree.
    if (!voucher || voucher.status !== 'established' || v.from === v.to) continue
    const used = spent.get(v.from) ?? 0
    if (used >= VOUCH_BUDGET) continue
    const cur = rep.get(v.to)
    if (cur && cur.weight >= voucher.weight * VOUCH_FACTOR) continue
    spent.set(v.from, used + 1)
    rep.set(v.to, { weight: voucher.weight * VOUCH_FACTOR, status: 'vouched', vouchedBy: v.from })
  }

  for (const [k, hours] of input.agreeHours) {
    if (rep.has(k)) continue
    const w = NEWCOMER_WEIGHT + Math.min(AGREE_MAX, hours * AGREE_STEP)
    rep.set(k, { weight: w, status: w >= TRUSTED_MIN ? 'earned' : 'newcomer' })
  }
  return rep
}

export function repOf(rep: Map<string, Rep> | undefined, key: string): Rep {
  // Without a reputation table (unit tests of other engines) every key counts fully.
  if (!rep) return { weight: 1, status: 'established' }
  return rep.get(key) ?? { weight: NEWCOMER_WEIGHT, status: 'newcomer' }
}

export const isTrusted = (r: Rep) => r.weight >= TRUSTED_MIN
