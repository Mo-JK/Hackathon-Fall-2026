# Lantern — Plan (output of Master Prompt)

Assumptions: 4 people, 24 hours, TypeScript PWA (React + Vite) + IndexedDB/Dexie + Node simulator. Everything is demoed on simulated data.

---

## 1. Critique of the concept

1. **Mesh networking is the least credible part.** Real Bluetooth/LoRa mesh from a browser isn't doable in 24h. *Fix:* build real gossip + store-and-forward logic, and run it over `BroadcastChannel` / WebRTC between browser tabs acting as "devices". Say plainly in the pitch: protocol is real, radio is simulated. Name BLE / LoRa / Wi-Fi Direct as the production transport.
2. **Crowd data can be faked, and the Directorate is the likely faker.** Judges will ask. *Fix:* corroboration rule (section 4) and sensor-over-human weighting. Show a spam attack being rejected in the demo.
3. **"Fair allocation" has no authority behind it.** Who enforces it? *Fix:* position it as an **auditable proposal**: Lantern publishes "what the Directorate did" vs. "what a fair rule would do", and neighborhoods use it to negotiate, share informally and prove neglect. Advisory, not enforced.
4. **Six problems is a lot.** *Fix:* one spine, everything hangs off it: **shared ground truth**. Hook for the whole pitch: *the gap between the official number and the reported number.*

## 2. MVP

**Story:** report -> shared map -> alert -> fair allocation -> family check-in, all while the network is cut.

| IN | OUT |
|---|---|
| World simulator (12 levels, ~4 blocks each, 3 scripted events) | Real hardware sensors |
| Per-level map with **official vs. reported** panel | Real radio mesh |
| Early-warning engine with "why this alert" explanation | Accounts / login |
| Outbreak cluster detection + supply suggestion | Machine-learning models |
| Allocation engine with before/after fairness view | Surface / reinhabitation features |
| Offline mode: gossip sync between tabs, "Directorate cuts network" toggle | Native mobile app |
| "I'm OK" check-in, no account, block-level location | Full i18n |
| One-click demo mode | |

## 3. Architecture

```
 [Node simulator] --> sensor readings + resident reports (JSON stream)
          |
   (each browser tab = one "device" / neighborhood node)
          v
 +--------------------------------------------------+
 |  Local-first store (IndexedDB / Dexie)           |
 |   readings, reports, checkins, alerts, allocs    |
 +--------------------------------------------------+
      |  engines run locally on the local store     ^
      v                                             |
 [Warning] [Outbreak] [Allocation]          [Gossip sync layer]
      |                                      signed msgs, TTL, dedupe
      v                                             |
 [React UI: map, alerts, allocation, check-in]  transport:
                                              - "Directorate uplink" (can be CUT)
                                              - peer link (BroadcastChannel / WebRTC)
```

**Data model (Dexie tables)**
- `blocks(id, level, name, population, hardshipWeight)`
- `readings(id, blockId, kind[air|water|temp|power], value, ts, sourceId, sourceType[sensor|human])`
- `reports(id, blockId, type[symptom|water_taste|outage], ts, deviceKey)`
- `checkins(id, blockId, ts, deviceKey, note)`: no name; family matches by shared code phrase
- `alerts(id, blockId, kind, etaMinutes, confidence, reasons[])`
- `allocations(id, resource, blockId, official, proposed)`
- `messages(id, payload, sig, ttl, seenBy[])`: gossip log

**Real vs. simulated**
- Real: local-first storage, gossip/dedupe/TTL, message signing (WebCrypto ephemeral keys), all three engines, UI.
- Simulated: sensors, population, the Directorate's "official" numbers, the radio link.

## 4. Core algorithms

**A. Early warning (explainable, no black box)**
- Per block and kind, keep the last N readings. Fit a linear trend (least squares) over a rolling window.
- Compute time-to-threshold: `eta = (critical - current) / slope`. Alert when `eta < 120 min` and slope is sustained.
- Corroborate: power sag in neighboring blocks, temp rising, plus human "lights flicker" reports raise confidence.
- Output `reasons[]`, e.g. *"Water TDS up 38% in 40 min; 2 neighboring blocks also rising; 4 residents report metallic taste."*

**B. Outbreak detection**
- Baseline symptom reports per 1,000 residents per block (trailing 7 sim-days).
- Flag a block when today's rate > baseline + 3σ; merge adjacent flagged blocks into a cluster.
- Estimated cases = reports / assumed reporting rate. Show **official count vs. estimate** side by side.
- Supply suggestion: split masks/medicine across clusters proportional to estimated cases.

**C. Fair-share allocation**
- `need(block) = population × hardshipWeight(level)`; deep levels get higher weight (heat, no light, sickness).
- **Need-weighted max-min fairness** (progressive filling): raise every block's share equally relative to need until supply runs out or a block's need is met.
- Compare to baseline "upper levels first". Report: min coverage ratio, Gini coefficient, number of blocks below 50% of need. This before/after chart is the demo's money shot.

**D. Trust / anti-spam**
- A block's state changes on the shared map only when `sum(weights) ≥ 3` from **distinct device keys** within 30 min (sensor = 3, human = 1, cap 1 per device per window).
- Demo: one device floods 100 fake "all clear" reports; the map doesn't move.

**E. Gossip sync**
- Each message: `{id, payload, sig, ttl, hops}`. Peers exchange id lists, then missing messages. Dedupe by id, drop at ttl 0. Messages queue while offline and flush when a peer appears.

## 5. Task breakdown (4 people, 24h)

| Person | h0-6 | h6-14 | h14-20 |
|---|---|---|---|
| **A: Data + Simulator** | schema, seed 12 levels, event script | simulator tuning, "official" numbers | demo-mode scripting |
| **B: Map + UI** | app shell, level map | official-vs-reported panel, alerts feed | polish, mobile layout |
| **C: Engines** | warning engine | outbreak + allocation + fairness chart | trust rule + tests |
| **D: Offline + Sync** | PWA + Dexie + service worker | gossip layer, network-cut toggle | check-in flow, signing |

h20-22: integration freeze, bug bash. h22-24: pitch rehearsal x3, record a backup demo video.

**Cut line (drop in this order if late):** i18n/polish -> message signing -> WebRTC (keep BroadcastChannel) -> supply routing -> check-in. **Never cut:** official-vs-reported panel, allocation before/after, network-cut toggle.

## 6. Demo script (3 min)

1. **0:00** Level 9, a family. Show the map: official page says "all normal".
2. **0:20** Sensors + residents report; reported state turns red. *"Official: 12 cases. Lantern: ~340."*
3. **0:50** Early warning fires: "Blackout in ~90 min", with reasons. Water alert in Level 11 follows.
4. **1:20** Flip **"Directorate cuts network"**. Official feed dies. Lantern keeps syncing tab to tab.
5. **1:50** Spam attack on the map: rejected, trust rule shown.
6. **2:10** Allocation: "Upper levels first" vs. "Fair share". Deep-level coverage 18% -> 71%.
7. **2:35** A parent taps "I'm OK"; the sibling on Level 3 sees it, no account used.
8. **2:50** Close: *the truth, shared by the people living it.*

## 7. Judging checklist

| # | Problem | Covered by |
|---|---|---|
| 1 | Blackout warning | Early-warning engine |
| 2 | Fair sharing | Allocation engine |
| 4 | Bad water | Water alert + human reports |
| 7 | No network | Offline gossip sync |
| 8 | Family reconnect | "I'm OK" check-in |
| 9 | Real outbreak | Outbreak detection |
| 3 (partial) | Heat | Temp trend in warning engine |
| 10 (partial) | Medicine | Supply suggestion |

**One-sentence impact claim:** *Lantern gives the people of the Hollow a shared, tamper-resistant picture of reality that keeps working when the Directorate shuts the network, and turns it into early warnings, fair shares and a way to find their families.*

**Next:** use Prompt 2 (build prompt) with section 2 and 3 pasted in.
