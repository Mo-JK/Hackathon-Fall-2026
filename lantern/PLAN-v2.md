# Lantern v2: Phase Plan

Baseline (20 Nov 2026): 17/17 tests pass, typecheck clean, build OK (359 kB JS). Code is on GitHub at `ef855bd`.

Budget: 20 hours to judging, 4 people. Every phase ends with typecheck + tests + build + a click-through of the demo, then a commit.

## What the code review found

| Finding | Where | Consequence for v2 |
|---|---|---|
| Gossip is hard-wired to `BroadcastChannel` | `mesh/gossip.ts:42` | Pull out a `Transport` interface first, then add WebSocket |
| **`crypto.subtle` is read at module load** | `mesh/crypto.ts:3` | **Phones opening `http://192.168.x.x` have no `crypto.subtle` (insecure context), so the app crashes before rendering.** Must fix before the phone demo can work (see decision 1). |
| `crypto.randomUUID` is used for ids | `gossip.ts:31`, `store.ts` | Same insecure-context problem; needs a fallback |
| Trust counts every distinct key as 1 | `engine/trust.ts:45-48` | Sybil fix replaces the count with a sum of per-key weights |
| Family phrase = unsalted SHA-256 | `store.ts:299` | Swap for PBKDF2 |
| `MsgData` is a closed union of 3 kinds | `types.ts:46` | Extend the union per module; gossip/trust stay untouched |
| `maxMinFair` / `priorityFill` are generic over `needs[]` | `engine/allocation.ts:14,31` | Heat fans, lamp rota, food matching and the return queue can all reuse them as-is |
| Simulator is deterministic (`rngFor`) | `sim/world.ts:63` | New scripted events stay reproducible |
| `store.ts` is one 386-line class | `store.ts` | Add `src/modules/` registry so the store doesn't double in size |

## Decisions needed

1. **Phone crypto (blocks the live-phone wow moment).** Recommended: add `@noble/curves` + `@noble/hashes` (pure JS, audited, offline, ~30 kB) as a fallback signer when `crypto.subtle` is missing. Same P-256 ECDSA, so signatures stay compatible. Alternative: serve HTTPS with a self-signed cert, but every judge then has to tap through a scary browser warning.
2. **TIME_LEFT.** The plan assumes 20 hours. Tell me if it's different and I'll rescale the cut line.

## Phases

| Phase | Hours | Work | Owner |
|---|---|---|---|
| **P0 Foundations** | 0-1.5 | `Transport` interface (BroadcastChannel impl, no behaviour change); insecure-context crypto fallback; `src/modules/` registry; extend `MsgData`; `world.ts` event hooks | Claude + A |
| **P1 Tier 1** | 1.5-7 | `relay/` WebSocket node + WS transport + anti-entropy "caught up: N" + QR join + SOS; Sybil reputation (0.25 start, QR vouching, capped vouch trees) + 3 tests; Proof of Air hash chain + verify panel + tamper test; PBKDF2 phrases + k=5 hiding | A: mesh, C: Sybil, D: Proof of Air, B: design tokens + split view |
| **P2 Tier 2 modules** | 7-14 | M3 heat index + fan scheduler; M5 tunnel graph + Dijkstra + flood spread; M6 crowding heatmap + space board; M9+10 triage + medicine demand + runner; M11 pulse + light rota; M12 grow ledger + days-left; M14 surface options table + cohorts; M15 staged return with max-flow | C: M3, M12, M15 · A: M5, M9+10 · D: M11, M14 · B: all views, M6 |
| **P3 Story** | 14-16 | New demo script (core beats + 3-5 s module flashes); "15 problems" strip; how-it-connects diagram; `/pitch` slides; `npm run demo` | B + D |
| **P4 Freeze + review** | 16-18 | Skeptical-judge pass, top 5 weak moments fixed; README 15-problem table; DEMO-CHECKLIST.md | All |
| **P5 Rehearse** | 18-20 | PITCH.md rewrite, 3 timed run-throughs, backup video | D leads |

**Cut line:** unchanged from the prompt. Tier 2 depth is cut first (M15 → simple queue, M14 → table only, M6 → heatmap only, M11 → chart only, M12 → days-left only). Never cut: relay + phones, Sybil, Proof-of-Air verify, the 15-strip, the existing demo.

## Risks

| Risk | Mitigation |
|---|---|
| Venue Wi-Fi blocks device-to-device traffic | Laptop runs its own hotspot; tabs-only fallback still shows the mesh |
| Windows Firewall blocks the relay port | DEMO-CHECKLIST adds a firewall rule step; test with a phone the night before |
| Demo grows past 3 minutes with 15 modules | Module flashes are 3-5 s each; one number per module |
| 15 problems looks shallow | Every module has a real tested engine function; README table links each to its file |
