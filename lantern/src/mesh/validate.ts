import type { Msg } from '../types'

/**
 * Structural checks on a message before anything else touches it. A signature only proves who
 * sent a message, not that it is well formed: keys are free, so anyone can sign garbage. Every
 * field the engines read is checked here (type, range, length), so one malformed message can't
 * crash or skew every device that receives it.
 */
const BLOCK = /^L\d{1,2}-B\d$/
const HEX = /^[0-9a-f]+$/
const MAX_ID = 80

const str = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const num = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi
const int = (v: unknown, lo: number, hi: number): v is number => num(v, lo, hi) && Number.isInteger(v)
const oneOf = <T extends string>(v: unknown, xs: readonly T[]): v is T => typeof v === 'string' && (xs as readonly string[]).includes(v)
const block = (v: unknown): v is string => typeof v === 'string' && BLOCK.test(v)

function validData(d: unknown): boolean {
  if (!d || typeof d !== 'object') return false
  const x = d as Record<string, unknown>
  switch (x.k) {
    case 'telemetry':
      return num(x.power, 0, 100) && num(x.water, 0, 10_000) && num(x.temp, -50, 80) && num(x.air, 0, 1000) && num(x.rh, 0, 100)
    case 'report':
      return oneOf(x.type, ['symptom', 'water_taste', 'outage'] as const)
    case 'checkin':
      return str(x.codeHash, 128) && HEX.test(x.codeHash)
    case 'sos':
      return oneOf(x.need, ['medical', 'trapped', 'water', 'heat'] as const)
    case 'respond':
      return block(x.to)
    case 'vouch':
      return str(x.target, 200) && HEX.test(x.target)
    case 'gauge':
      return str(x.edge, 40) && (x.edge as string).split('|').length === 2 && (x.edge as string).split('|').every(block) && num(x.depth, 0, 1000)
    case 'pulse':
      return num(x.sleep, 0, 24) && int(x.mood, 1, 5) && num(x.light, 0, 1440)
    case 'triage':
      return oneOf(x.outcome, ['self', 'medicine', 'clinic'] as const)
    case 'space':
      return oneOf(x.mode, ['offer', 'request'] as const) && oneOf(x.what, ['sleep', 'quiet', 'cool'] as const) && int(x.slots, 1, 20)
    case 'plot':
      return str(x.crop, 40) && num(x.kg, 0, 10_000_000) && num(x.ready, 0, 1e7)
    case 'probe':
      return (
        str(x.probe, 8) && int(x.seq, 0, 1e6) && int(x.day, 0, 1e5) && typeof x.prev === 'string' && x.prev.length <= 64 &&
        num(x.aqi, 0, 1000) && num(x.o2, 0, 100) && num(x.rad, 0, 1000) && num(x.tempC, -100, 100)
      )
    default:
      return false
  }
}

/** True when every field of the envelope and its data has the expected type and a sane value. */
export function validMsg(m: unknown): m is Msg {
  if (!m || typeof m !== 'object') return false
  const x = m as Record<string, unknown>
  return (
    str(x.id, MAX_ID) &&
    block(x.blockId) &&
    num(x.ts, 0, 1e9) &&
    num(x.wall, 0, 1e14) &&
    str(x.pub, 200) && HEX.test(x.pub) &&
    str(x.sig, 300) && HEX.test(x.sig) &&
    int(x.hops, 0, 1000) &&
    num(x.ttl, -1000, 1000) &&
    (x.origin === 'user' || x.origin === 'swarm') &&
    validData(x.data)
  )
}
