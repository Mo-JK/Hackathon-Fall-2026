/**
 * "Your block": what a resident needs to know and do right now, in plain words.
 * Every other module answers a question about the whole Hollow; this one joins their answers
 * for one place (the user's block and its neighbours) and turns them into ranked actions:
 * confirmed hazards, what is coming and when, where to go, who nearby needs help, and family.
 */
import type { Kind, RecOf } from '../types'
import type { Alert } from '../engine/warning'
import type { Edge } from '../sim/hollow'
import type { HeatRow } from './heat'
import { TW_DANGER, TW_EXTREME } from './heat'
import type { FloodState, Route } from './routes'
import { hops } from './routes'
import type { RouteTarget } from './compute'
import type { TabId } from '../store'

export type Tone = 'critical' | 'warn' | 'info' | 'good'

export interface BriefAction {
  label: string
  tab: TabId
  route?: RouteTarget
  /** Answer the SOS from this block. */
  respond?: string
}

export interface BriefItem {
  tone: Tone
  text: string
  action?: BriefAction
}

export interface Briefing {
  home: string
  level: 'ok' | 'watch' | 'act'
  items: BriefItem[]
}

export interface BriefingInput {
  home: string
  edges: Edge[]
  /** Corroborated hazards per block (the trust rule's output). */
  flagged: (blockId: string) => Kind[]
  outbreakFlagged: (blockId: string) => boolean
  alerts: Alert[]
  heat: HeatRow[]
  coolRoute: Route | null
  waterRoute: Route | null
  flood: FloodState
  sos: RecOf<'sos'>[]
  responders: Map<string, number>
  helping: string | null
  family: { blockId: string; minutesAgo: number } | null
}

const HAZARD_WORDS: Record<Kind, string> = { power: 'power is out', water: 'tap water is unsafe', temp: 'heat is dangerous', air: 'air is bad' }
const KIND_WORD: Record<Kind, string> = { power: 'power', water: 'water quality', temp: 'heat', air: 'air' }
const NEED_WORD = { medical: 'medical', trapped: 'trapped', water: 'no water', heat: 'heat' } as const
const ORDER: Record<Tone, number> = { critical: 0, warn: 1, info: 2, good: 3 }
export const MAX_ITEMS = 6

const where = (r: Route) => `${r.path[r.path.length - 1]}, ${Math.round(r.length).toLocaleString('en-US')} m`
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

export function briefing(inp: BriefingInput): Briefing {
  const { home } = inp
  const items: BriefItem[] = []
  const dist = hops(inp.edges, home)
  const near = (id: string, max: number) => (dist.get(id) ?? 99) <= max

  // 1. What is confirmed wrong here (sensor + residents, via the trust rule).
  const here = inp.flagged(home)
  if (here.length) {
    const words = here.map((k) => HAZARD_WORDS[k])
    items.push({ tone: 'critical', text: `Confirmed in your block: ${list(words)}.` })
  }

  // 2. Heat stress and the nearest cool, powered refuge.
  const heat = inp.heat.find((r) => r.blockId === home)
  if (heat && heat.tw >= TW_DANGER) {
    const tw = `Wet-bulb ${heat.tw.toFixed(1)} °C: ${heat.tw >= TW_EXTREME ? 'the body can no longer cool itself' : 'heavy work is dangerous'}.`
    items.push(
      inp.coolRoute
        ? { tone: heat.tw >= TW_EXTREME ? 'critical' : 'warn', text: `${tw} Nearest cool refuge: ${where(inp.coolRoute)}.`, action: { label: 'Show route', tab: 'routes', route: 'cool' } }
        : { tone: 'critical', text: `${tw} No cool refuge can be reached right now.` },
    )
  }

  // 3. Unsafe water and where to get safe water.
  if (here.includes('water')) {
    items.push(
      inp.waterRoute
        ? { tone: 'warn', text: `Don't drink untreated tap water. Safe water point: ${where(inp.waterRoute)}.`, action: { label: 'Show route', tab: 'routes', route: 'water' } }
        : { tone: 'critical', text: "Don't drink untreated tap water. No safe water point can be reached." },
    )
  }

  // 4. What is coming for this block, and when.
  const coming = inp.alerts.filter((a) => a.level === 'warning' && a.blockId === home && !here.includes(a.kind))
  for (const a of coming.slice(0, 2)) items.push({ tone: 'warn', text: `${cap(KIND_WORD[a.kind])} is heading past the safe line here in about ${a.etaMinutes} min.`, action: { label: 'Why?', tab: 'alerts' } })

  // 5. My own SOS, and SOS calls close by that nobody has answered.
  const mine = inp.sos.find((s) => s.mine)
  if (mine) {
    const n = inp.responders.get(mine.id) ?? 0
    items.push({ tone: n ? 'good' : 'warn', text: n ? `Your SOS was heard: ${n} ${n === 1 ? 'person is' : 'people are'} on the way.` : 'Your SOS is out. Waiting for someone nearby to answer.' })
  }
  if (inp.helping) items.push({ tone: 'info', text: `You are on your way to the SOS in ${inp.helping}.`, action: { label: 'Route', tab: 'routes', route: 'sos' } })
  for (const s of inp.sos) {
    if (s.mine || s.blockId === inp.helping || !near(s.blockId, 2)) continue
    const n = inp.responders.get(s.id) ?? 0
    const d = dist.get(s.blockId) ?? 0
    const away = d === 0 ? 'in your block' : `${d} block${d === 1 ? '' : 's'} away`
    items.push(
      n
        ? { tone: 'info', text: `SOS (${NEED_WORD[s.data.need]}) in ${s.blockId}, ${away}: ${n} ${n === 1 ? 'person is' : 'people are'} on the way.` }
        : { tone: 'critical', text: `SOS (${NEED_WORD[s.data.need]}) in ${s.blockId}, ${away}. Nobody has answered yet.`, action: { label: "I'll go", tab: 'routes', route: 'sos', respond: s.blockId } },
    )
  }

  // 6. Tunnels next to home that are flooded or about to be.
  const touches = (edge: string) => edge.split('|').includes(home)
  const closed = [...inp.flood.closed].filter(touches)
  const atRisk = [...inp.flood.atRisk].filter(touches)
  if (closed.length) items.push({ tone: 'warn', text: `Flooded: ${closed.map((e) => e.replace('|', ' ↔ ')).join(', ')}. Routes avoid it.`, action: { label: 'Tunnels', tab: 'routes' } })
  else if (atRisk.length) items.push({ tone: 'warn', text: `The stairs ${atRisk.map((e) => e.replace('|', ' ↔ ')).join(', ')} may flood next: water is coming from above.`, action: { label: 'Tunnels', tab: 'routes' } })

  // 7. The soonest threat next door.
  const next = inp.alerts.find((a) => a.blockId !== home && near(a.blockId, 1))
  if (next) {
    const when = next.level === 'critical' ? 'is past the safe line now' : `is heading past the safe line in about ${next.etaMinutes} min`
    items.push({ tone: 'info', text: `Next door in ${next.blockId}, ${KIND_WORD[next.kind]} ${when}.`, action: { label: 'Why?', tab: 'alerts' } })
  }

  // 8. Lung-sickness cluster here or next door.
  const cluster = [home, ...[...dist].filter(([, d]) => d === 1).map(([id]) => id)].filter((id) => inp.outbreakFlagged(id))
  if (cluster.length) {
    items.push({
      tone: 'warn',
      text: `${cluster.includes(home) ? 'Your block is' : `${list(cluster)} ${cluster.length === 1 ? 'is' : 'are'}`} above the normal rate of lung-sickness reports. Wear a mask; check symptoms if you cough.`,
      action: { label: 'Check symptoms', tab: 'care' },
    })
  }

  // 9. Family.
  if (inp.family) items.push({ tone: 'good', text: `Family checked in OK at ${inp.family.blockId}, ${inp.family.minutesAgo < 1 ? 'just now' : `${inp.family.minutesAgo} min ago`}.`, action: { label: 'Route', tab: 'routes', route: 'family' } })

  const sorted = items.map((x, i) => ({ x, i })).sort((a, b) => ORDER[a.x.tone] - ORDER[b.x.tone] || a.i - b.i).map(({ x }) => x)
  const level = sorted.some((x) => x.tone === 'critical') ? 'act' : sorted.some((x) => x.tone === 'warn') ? 'watch' : 'ok'
  if (!sorted.length) sorted.push({ tone: 'good', text: 'Nothing is confirmed wrong in or next to your block. Lantern keeps watching its sensors and your neighbours.' })
  return { home, level, items: sorted.slice(0, MAX_ITEMS) }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
