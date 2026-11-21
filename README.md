# Lantern

**A truth layer the Directorate can't switch off or fake.**
Built for Patriot HackFest Fall 2026, *Life Underground* track.

Residents, sensors and sealed surface probes sign what they observe. Lantern cross-checks each observation against independent evidence and passes it from device to device, so the picture survives when the network is cut. Three engines are built on that shared truth, and together they answer **all 15 problems** in the brief.

| Engine | Question it answers | Problems |
|---|---|---|
| **SENSE** | What is really happening? | 1, 3, 4, 5, 9, 11, 13 |
| **SHARE** | How do we split what is scarce, fairly? | 2, 6, 10, 12, 14, 15 |
| **REACH** | How do we find people and safe paths? | 5, 7, 8, 10 |

One rule connects them. The **same need-weighted fairness rule** splits power tonight, fans in a heat wave, lamp hours, food between neighbours and lift capacity on the way back to the surface. The deepest levels are no longer last by default.

## Highlights

- **Live phone mesh.** Scan a QR code and your phone joins the demo with its own signing key, with no app store and no account.
- **Sybil resistance.** Fifty fake identities can't flip a block on the map, because all newcomer keys together count as half a stranger.
- **Proof of Air.** 41 days of hash-chained, signed probe readings. Forge one entry and the chain breaks at exactly that entry.
- **Fair plans that can be checked.** Each split shows what was given next to what a fair rule would give, so anyone can audit it.
- **69 tests** covering the engines, the mesh, reputation and message hardening.

## Quick start

You need [Node.js](https://nodejs.org) 20 or later and Git.

```bash
git clone https://github.com/Mo-JK/Hackathon-Fall-2026.git
cd Hackathon-Fall-2026/lantern
npm install
npm run demo
```

Open http://localhost:8787 and click **▶ Run demo**. The scripted story takes about 2 min 20 s, and the "15 problems" strip fills in as it plays.

| Command | What it does |
|---|---|
| `npm run dev` | Hot-reload dev server at http://localhost:5173 (browser tabs only, phones can't join) |
| `npm run demo` | Builds the app and starts the relay at http://localhost:8787. Phones can join. |
| `npm test` | Runs the 69 tests |
| `npm run check` | Typecheck, tests and build |

**In VS Code:** open the `Hackathon-Fall-2026` folder, then choose **Terminal → Run Task…** and pick any `Lantern:` task (install, dev, demo, test, check).

**Join with a phone:** run `npm run demo`, put the phone on the same network (preferably the laptop's own hotspot) and scan the code under **📱 Join**. With no phone handy, open `http://localhost:8787/?phone` in a second tab. [lantern/DEMO-CHECKLIST.md](lantern/DEMO-CHECKLIST.md) covers hotspot and firewall setup.

## How it works

```
                 Verifiable truth layer
      signed · corroborated · gossiped device to device
          /                  |                  \
      SENSE                SHARE                REACH
  know what is real   split what is scarce   find people and paths
```

1. **Sign.** Every device has an ECDSA P-256 key. Laptops use WebCrypto. Phones on plain http use `@noble/curves`, and the two verify each other.
2. **Gossip.** Messages spread device to device with deduplication, hop budgets, store-and-forward and anti-entropy catch-up. The community relay serves the app and forwards frames but never vouches for them, because every device verifies for itself.
3. **Corroborate.** A block changes on the map only when its evidence weighs 3 or more. A sensor weighs 3, an established resident 1 and a vouched device 0.75. All newcomer keys together are capped at 0.5. Sensor readings are accepted only from registered sensor keys, and every message is checked for shape and range before use.
4. **Decide.** Small, tested engines turn that shared picture into warnings, routes, fair shares and return plans.

[lantern/README.md](lantern/README.md) maps all 15 problems to their code and explains the trust model in detail.

## Real vs simulated

| Real | Simulated |
|---|---|
| Signing, verification and gossip between real devices | Sensors, gauges, probes and about 300 background devices |
| The relay, and phones joining it live | The radio (production would use BLE, LoRa or Wi-Fi Direct behind the same `Transport` interface) |
| Reputation, vouching and the trust caps | The Directorate's bulletin and numbers |
| The hash-chained probe log and its tamper detection | Population, levels, scripted events and 41 days of surface readings |
| Every engine: warnings, wet-bulb heat, max-min fairness, Dijkstra routing, Edmonds-Karp return planning, k-anonymity, PBKDF2 family phrases | |

The numbers on screen come from a simulator tuned to tell the story. They are not evidence about a real population. The known limits are listed in [lantern/README.md](lantern/README.md#known-limits-say-these-before-a-judge-does).

## Tech stack

React 19, TypeScript, Vite and Vitest. Dexie (IndexedDB) for offline storage, a service worker for PWA install, `ws` for the relay, and `@noble/curves` and `@noble/hashes` for cryptography on phones.

## Repository layout

| Path | Contents |
|---|---|
| [lantern/](lantern/) | The app: a React + TypeScript PWA, the relay and the tests |
| [lantern/README.md](lantern/README.md) | Technical write-up: the 15 problems mapped to code, trust, known limits |
| [lantern/PITCH.md](lantern/PITCH.md) | 3-minute pitch script and answers to likely judge questions |
| [lantern/SUBMISSION.md](lantern/SUBMISSION.md) | 3-minute video shot list, phone overlay and demo URL (GitHub Pages or Netlify) |
| [lantern/DEMO-CHECKLIST.md](lantern/DEMO-CHECKLIST.md) | Stage setup, pre-flight checks and fallbacks |
| [lantern/PLAN-v2.md](lantern/PLAN-v2.md) | The v2 build plan |
| `lantern-plan.md`, `hollow-prompt.md`, `lantern-v2-prompt.md` | The original plan and the prompts used during the build |

```
lantern/
  relay/server.mjs   community relay (static app + WebSocket /mesh)
  src/mesh/          crypto, transport, gossip, validation, simulated swarm
  src/engine/        warning, outbreak, allocation, trust, reputation
  src/modules/       heat, routes, space, care, light, food, surface, return plan, briefing
  src/sim/           world, geography and scripted events
  src/components/    map, panels, problem strip, join QR, pitch slides
  src/phone/         phone mode (?phone)
```

## What's next

- A real radio transport (LoRa first)
- Clinician-reviewed triage rules
- Rotating device keys per epoch, kept separate from reputation
- Calibrating reporting rates against one real clinic on the lowest level
