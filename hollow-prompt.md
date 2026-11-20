# Life Underground — Prompt Kit

Three prompts, in the order you'll use them. Paste into your AI of choice.

> **Assumed defaults (edit if wrong):** concept = Lantern, team = 4 people, time = 24 hours, stack = TypeScript PWA (React + Vite) + IndexedDB/Dexie + Node simulator. Search the file for these values to change them. The only remaining placeholders are the `[PASTE ...]` markers in Prompts 2 and 3, which you fill with the output of the previous prompt.

---

## 0. Decisions to make as a team first (5 minutes)

| Decision | Default in the prompts below |
|---|---|
| Path | **Make life underground more sustainable** (not the surface path) |
| Problems combined | **1, 2, 4, 7, 8, 9** (see concept) |
| Deliverable | A working web app / PWA demo + 3-minute pitch |
| Team size / hours | `4 people, 24 hours` |
| Stack | `TypeScript PWA (React + Vite) + IndexedDB/Dexie + Node simulator` |

Why combine? The brief says one connected solution that hits several problems scores better. Blackout warning, bad water, outbreaks, family check-ins and offline comms all share one root cause: **nobody can trust or reach the data the Directorate controls**. Solve that once and you cover many problems.

---

## 1. MASTER PROMPT — concept + build plan

```
You are a senior product engineer and hackathon coach. Help my team win the "Life Underground" hackathon track.

## The world
In 2087 the surface is uninhabitable. Two billion people live in the Hollow: cities in old mines and subway tunnels, stacked in levels. The Directorate (government) controls air, the network and movement between levels. Upper levels get light and space; deep levels get dark, hot and sick, and blackouts hit them first. Power, water and food are rationed. Water recyclers in deep levels are failing, lung sickness is spreading, and the Directorate's public numbers don't match what people see. The Directorate can shut down the network at will. Many residents believe the surface has healed.

## Our mission
Build something that helps Hollow residents survive. Ideally ONE well-connected solution that addresses several of these problems at once:
1. Warn people before power or air cuts out
2. Share power, water and food fairly when scarce
4. Catch bad water before people drink it
7. Organize, share information and call for help without the Directorate's network
8. Reconnect families split across levels after a blackout
9. Track the real lung-sickness outbreak and route supplies to where they're needed

## Concept (challenge it, don't just accept it)
"LANTERN": a community-run, offline-first resilience network.
- Residents and cheap sensors report air quality, water quality, temperature, power status and symptoms.
- Reports are shared peer-to-peer (mesh / store-and-forward), so it works when the Directorate cuts the network.
- A shared "ground truth" map per level shows the real state of each tunnel/block, independent of official numbers.
- From that data, Lantern (a) predicts blackouts and bad-water events, (b) flags outbreak clusters, (c) proposes a transparent, auditable allocation of scarce power/water/food/medicine so deep levels aren't always last, and (d) lets anyone mark "I'm OK" so families can find each other.

## Constraints
- Team: 4 people, 24 hours. Stack: TypeScript PWA (React + Vite), IndexedDB via Dexie for local-first storage, a small Node script for the world simulator. Must demo live without internet.
- Must run on low-end hardware and degrade gracefully (SMS-sized messages, low bandwidth, no accounts needed to send a distress signal).
- Privacy: anonymity matters, because the Directorate is an adversary. No central server holding personal health data. Aggregate and fuzz location to block-level.
- Be honest about data trust: crowd-sourced data can be spammed or faked. Include a basic trust mechanism (e.g. corroboration by multiple independent reporters, sensor vs. human weighting).
- Everything must be demoable with SIMULATED data. We will build a small world simulator (3-4 levels, a few blocks each) that generates blackouts, a water contamination event and an outbreak.

## What I want from you
1. **Critique the concept.** What's the weakest part? What would a judge poke at? Suggest a sharper version if there is one. Max 10 lines.
2. **Define the MVP.** The smallest slice that demos end-to-end: a story of "sensor/human report -> shared map -> prediction/alert -> fair allocation decision -> family check-in", all while 'the network is cut'. List what's IN and explicitly what's OUT.
3. **Architecture.** One diagram in text + a data model (tables/fields). Choose the simplest approach that is credible (e.g. PWA + local-first DB + CRDT/sync, with the mesh transport mocked or implemented over WebRTC/Bluetooth if feasible). Say which parts are real and which are simulated.
4. **The core algorithms, specified concretely:**
   - blackout/water-failure early warning (simple, explainable model on the simulated sensor stream, not a black box)
   - outbreak cluster detection from symptom reports vs. the "official" number
   - fair-share allocation (propose a rule, such as need-weighted max-min fairness, and show deep levels vs. current "upper levels first" outcome as a before/after)
5. **Task breakdown** split across 4 people with time boxes and a "cut line" (what we drop first if we run late).
6. **Demo script (3 min)** with a narrative: a family in Level 9 during a blackout. Show the moment the Directorate kills the network and Lantern keeps working.
7. **Judging checklist.** Map our features to the brief: how many of the 15 problems do we credibly hit, and what is the one-sentence impact claim.

## Output format
Use headers for each of the 7 items. Be concrete and opinionated; recommend, don't survey. Flag assumptions as ASSUMPTION. If something is unrealistic for 24 hours, say so and offer the cheaper version.
```

---

## 2. BUILD PROMPT — paste into your coding agent after the plan is agreed

```
We are building "Lantern" for the Life Underground hackathon. Here is the agreed plan: [PASTE THE MVP + ARCHITECTURE FROM PROMPT 1].

Build it in this order, committing after each step, and keep the app runnable at every step:
1. Project skeleton + local-first data model + seed data for a simulated Hollow (levels 1-12; deep levels = darker, hotter, worse infrastructure).
2. World simulator: emits sensor readings and resident reports over time; scripted events: a blackout in Level 9, a contaminated water recycler in Level 11, an outbreak cluster in Level 10.
3. Shared ground-truth map per level with an "official vs. reported" comparison panel.
4. Early-warning engine (explainable: show WHY an alert fired).
5. Allocation engine with a before/after fairness view.
6. Offline mode + peer sync (mock transport is fine; make the 'Directorate cuts the network' toggle visibly work).
7. "I'm OK" family check-in with no account and block-level location only.
8. Polish: one-click demo mode that plays the whole story.

Rules: simple over clever; no secrets in code; no real personal data; add a short README with how to run and what is simulated vs. real. Ask me before adding any dependency that needs internet at demo time.
```

---

## 3. PITCH PROMPT — use in the last hour

```
Here are our final features and demo flow: [PASTE].
Write a 3-minute pitch for hackathon judges, in this structure:
1. 20s hook: one person, one blackout, one moment of not knowing.
2. 30s problem: why the Directorate's control of data is the root cause.
3. 90s live demo narration, timed to the clicks in our demo script.
4. 30s impact + which of the 15 problems we address and how they connect.
5. 10s ask / what's next (including how this helps the path back to the surface).
Then list the 5 toughest judge questions (trust and spam, privacy, adoption, realism of the mesh, fairness definition) with strong 2-sentence answers.
Tone: urgent, grounded, no buzzword soup.
```

---

## Alternative concepts (if the team prefers)

- **Surface path:** "Proof of Air" — a community-verifiable chain of evidence for surface safety (sensor drones, signed readings, public audit trail) + a staged-return planner (problems 13, 14, 15).
- **Health-focused:** a lung-sickness early-warning + supply-routing tool with a tele-triage assistant for people far from clinics (problems 9, 10, 11).
- **Resource-focused:** a fairness dashboard that makes the Directorate's power allocation auditable and proposes a fairer one (problems 2, 3, 5).

To switch, replace the "Concept" and "problems" sections in Prompt 1; the rest works as is.
