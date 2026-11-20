# Lantern

A community-run, offline-first resilience network for the Hollow. Residents and cheap sensors report what is really happening; reports are signed and gossiped peer to peer, so the picture survives the Directorate switching off the network. From that shared picture Lantern gives early warnings, an honest outbreak count, a fairer split of scarce resources and a way for families to find each other.

Covers hackathon problems 1 (blackout and air warnings), 2 (fair sharing), 4 (bad water), 7 (no network), 8 (reconnecting families) and 9 (real outbreak tracking), with partial coverage of 3 (heat) and 10 (supply routing).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts: `npm test` (engine + mesh tests), `npm run typecheck`, `npm run build` then `npm run preview` (the production build registers a small service worker so the shell works offline).

Click **Run 3-min demo** for the scripted story, or **Start** and explore on your own. Open a second tab to see real peer-to-peer gossip of check-ins.

## What is real and what is simulated

| Real code | Simulated |
|---|---|
| Message signing and verification (WebCrypto ECDSA P-256) | Sensors and the 280 other devices in the mesh |
| Gossip: dedupe, hop budget, store-and-forward over `BroadcastChannel` between tabs | The radio link (production would be BLE / LoRa / Wi-Fi Direct) |
| Trust rule (independent corroboration) | The Directorate's bulletin and its numbers |
| Early-warning, outbreak and allocation engines | Population, levels, and the scripted events |
| Local-first storage of your device key and check-ins (IndexedDB via Dexie) | |

Simulated-swarm traffic stays inside the tab; only messages you create (reports, check-ins) cross the peer link. Simulated clocks are per tab, so cross-tab reports are not compared by sim time; check-ins use wall-clock time.

## The story the simulator tells

| Tick (10 sim-min each) | Event |
|---|---|
| ~22-35 | Outbreak starts on Level 10; Lantern flags the cluster while the bulletin stays low |
| 38-55 | Water on Level 11 degrades; warned about before it crosses 600 ppm |
| 62+ | Blackout spreads from Level 9 down; fans stop, then heat and air degrade |
| 88 | A family member on Level 3 checks in with the phrase `blue-heron-7` |

## How the engines work

- **Warning** (`src/engine/warning.ts`): least-squares trend over the last 8 readings, time-to-critical = `(critical - fitted) / slope`; warn inside 120 minutes. Each alert lists its reasons (trend, neighbouring blocks, resident reports, cascades such as "power is out so fans have stopped").
- **Trust** (`src/engine/trust.ts`): a block changes on the map only when evidence weight >= 3 (a sensor counts 3, each distinct resident device counts 1, within a 60-minute window). One device flooding reports counts once. The header toggle turns the rule off to show what spam would do.
- **Outbreak** (`src/engine/outbreak.ts`): each block's last-hour symptom reports vs its own baseline learned in the first 3 sim-hours; flag at z >= 3; adjacent flagged blocks merge into clusters; cases are estimated assuming 0.4% of active cases report per tick; supplies are split by estimated cases.
- **Allocation** (`src/engine/allocation.ts`): need = people x per-person need x depth hardship x (1 + 25% per confirmed hazard). Today's baseline serves levels top-down. The fair rule equalises coverage of need across all blocks (need-weighted max-min). Metrics: worst-served block, people under 50%, population-weighted Gini. It is an auditable proposal, not an enforcement mechanism.

## Known limits (say these before a judge does)

- The numbers in the demo come from a simulator tuned to tell the story; they are not evidence about a real population.
- Family phrases are hashed, so a short or guessable phrase can be brute-forced. Use a long one.
- Reporting-rate and hardship weights are assumptions to be calibrated with real clinics and sensors.
- The trust rule resists one noisy device, not a well-resourced attacker who controls many device keys. Production would add device attestation and reputation.
- Browser tabs share one device key, so cross-tab check-ins show as "You".
