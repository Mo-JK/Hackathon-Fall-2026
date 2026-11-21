# Lantern

**A truth layer the Directorate can't switch off or fake.** Residents, sensors and sealed surface probes sign what they observe; Lantern cross-checks it against independent evidence and passes it device to device, so the picture survives the network being cut. From that shared truth, three engines answer **all 15 problems** in the brief: survive today, prove the way home, go back fairly.

```
                 Verifiable truth layer
      signed · corroborated · gossiped device to device
          /                  |                  \
      SENSE                SHARE                REACH
  know what is real   split what is scarce   find people and paths
  1 3 4 5 9 11 13     2 6 10 12 14 15        5 7 8 10
```

The idea that ties it together: the **same need-weighted fairness rule** splits power tonight, fans in a heat wave, lamp hours, food between neighbours, and lift capacity on the way back to the surface. Deep levels are never last by default again.

## Run it

Needs Node 20+ (tested on Node 26). In VS Code: open the `Prompt Hackathon Fall 2026` folder, then **Terminal → Run Task…** and pick a `Lantern:` task. Or in a terminal:

```bash
cd lantern
npm install
npm run dev        # http://localhost:5173  (editing: hot reload, tabs only)
npm run demo       # build + relay on http://localhost:8787  (the real demo, phones can join)
npm test           # 69 tests
npm run check      # typecheck + tests + build: run before every push
```

- **Run demo** (top right) plays the scripted story in about 2 min 19 s, and the "15 problems" strip fills as it goes.
- **Your block** (under the two headline cards) joins every engine for one resident: what is confirmed in your block, what is coming and when, the nearest cool refuge or safe water, SOS calls nearby that nobody has answered (one tap: "I'll go"), floods, outbreak, family. Code: `src/modules/briefing.ts`.
- **Answering an SOS** sends a signed "I'm on my way". The caller's phone shows "Your SOS was heard: N people on the way", and the responder gets a hazard-aware route.
- **📱 Join** shows a QR code phones can scan to join the mesh (needs `npm run demo`; see [DEMO-CHECKLIST.md](DEMO-CHECKLIST.md)).
- **Slides** (or `#/pitch`) opens 6 in-app slides. Use the arrow keys.
- No phone handy? Open `http://localhost:8787/?phone` in a second tab to try phone mode.
- `?fresh` (e.g. `http://localhost:8787/?fresh`) starts the laptop without messages saved from earlier rehearsals. Use it before recording.
- The same build also runs from any static host (relative paths). A hosted https copy runs tabs-only: there is no relay beside it, so real phones join through a laptop running `npm run demo`.

## All 15 problems, mapped to code

| # | Problem | Where to see it | Engine (tested) |
|---|---|---|---|
| 1 | Warn before power/air cuts | Sense → Warnings | `src/engine/warning.ts` least-squares time-to-critical |
| 2 | Share fairly | Share → Fair share | `src/engine/allocation.ts` need-weighted max-min vs upper-first |
| 3 | Hot deep levels | Sense → Heat | `src/modules/heat.ts` wet-bulb (Stull), fan scheduler, cool refuges |
| 4 | Bad water | Sense → Warnings (Level 11) | `warning.ts` + resident taste reports via `trust.ts` |
| 5 | Flooded tunnels | Reach → Routes & SOS | `src/modules/routes.ts` gauges close segments, downhill risk, Dijkstra |
| 6 | Crowding | Share → Space | `src/modules/space.ts` people per room, greedy need-first matching |
| 7 | No network | Reach → Mesh & trust, SOS | `src/mesh/*` signed gossip, relay, anti-entropy; `relay/server.mjs` |
| 8 | Reconnect families | Reach → Family | PBKDF2 phrase hashes; route to their block |
| 9 | Real outbreak | Sense → Outbreak, Share → Care | `src/engine/outbreak.ts` z-score clusters vs the official count |
| 10 | Care far from clinics | Share → Care | `src/modules/care.ts` rule-based triage, k-anonymous demand |
| 11 | Life without sunlight | Share → Light & body | `src/modules/light.ts` pulses, depth correlation, lamp rota |
| 12 | Neighbourhood food | Share → Food | `src/modules/food.ts` days-left, district balancing, lamp-vs-fan trade-off |
| 13 | Is the surface safe? | Sense → Proof of Air | `src/modules/surface.ts` hash-chained signed probe log, evidence with CI |
| 14 | Who goes first, in what | Share → The way up | `surface.ts` published option scoring, consent-only cohort rule |
| 15 | Plan the move | Share → The way up | `src/modules/returnplan.ts` Edmonds-Karp max-flow, fair vs upper-first |

## What is real and what is simulated

| Real code | Simulated |
|---|---|
| ECDSA P-256 signing: WebCrypto on laptops, `@noble/curves` on phones over plain http (they verify each other) | Sensors, gauges, probes and the ~300 other devices |
| Gossip: dedupe, hop budgets, store-and-forward, anti-entropy catch-up over pluggable transports | The radio (production: BLE / LoRa / Wi-Fi Direct behind the same `Transport` interface) |
| Community relay: serves the app and forwards frames; it never trusts or verifies (devices do) | The Directorate's bulletin and numbers |
| Reputation: newcomer cap, in-person vouching, vouch budgets and tree caps | Population, levels, the scripted events |
| Hash-chained probe log with tamper detection | 41 days of surface readings |
| Every engine in the table above, plus k-anonymity and PBKDF2 phrases | |

## Trust, in one paragraph

A block changes on the map only when evidence weighs 3: a sensor counts 3, an established resident 1, a vouched device 0.75. **All newcomer keys together count at most 0.5**, so 50 fake keys count as half a stranger. A member can vouch in person for 3 devices; those cannot vouch further; and a member plus everyone they vouched for count at most 1.5 together. Trust can also be earned slowly by agreeing with sensors over many hours. See `src/engine/reputation.ts` and its tests.

The same cap applies to outbreak detection (fake symptom reports can't invent a cluster). **Sensor readings** (telemetry, flood gauges, probes) are only accepted from registered sensor keys, so a phone can't sign "power 0%" and pose as a sensor. Every message is checked for shape and range before use (`src/mesh/validate.ts`), so one malformed but validly signed message can't crash or skew other devices. Messages from real devices older than 30 minutes (24 h for family check-ins) are kept and forwarded but not shown as live, so a rehearsal's SOS doesn't reappear in the real demo.

## Known limits (say these before a judge does)

- The numbers come from a simulator tuned to tell the story; they are not evidence about a real population.
- A well-resourced attacker who corrupts several established members can still push a block over the line. The caps make it expensive, not impossible.
- Device keys are stable pseudonyms. Production would rotate keys per epoch and separate reputation from identity.
- Family phrases use PBKDF2 with a fixed salt (families must derive the same value without talking), which slows brute force rather than preventing it. Long phrases matter, and the UI says so.
- Triage is a rule-based checklist, not a diagnosis, and must be reviewed by clinicians before real use.
- k-anonymity counts distinct keys, and keys are free: someone flooding a block with fake keys could push it over k=5 and expose one real person's triage outcome. Production should count only trusted keys toward k.
- An SOS answer points at a block, not a specific call: two SOS calls from the same block share their responders.
- Reporting rates, hardship weights and the option scores are assumptions to calibrate with real clinics, engineers and sensors.

## Layout

```
lantern/
  relay/server.mjs      community relay (static app + WebSocket /mesh)
  src/mesh/             crypto, transport, gossip, simulated swarm
  src/engine/           warning, outbreak, allocation, trust, reputation
  src/modules/          heat, routes, space, care, light, food, surface, returnplan, registry
  src/sim/              world (core story), hollow (geography + module events), rng
  src/components/       map, panels, problem strip, join QR, pitch slides
  src/phone/            phone mode (?phone)
```
