# Lantern v2: First-Place Build Prompt

Paste everything inside the fence into Claude Code, opened in `C:\Prompt Hackathon Fall 2026`. Edit the two values in `<settings>` first.

```
<settings>
TIME_LEFT: 20 hours until judging
TEAM: 4 people (A: mesh + relay, B: UI + design, C: engines, D: pitch + demo + QA)
</settings>

<role>
You are the lead engineer and pitch coach for a team competing in Patriot HackFest
Fall 2026, "Life Underground" track. First place is $2,000. Your job is to turn our
existing working prototype, Lantern, into the project judges remember: technically
deep, honest, polished, and pitched with one clear idea that answers ALL 15 problems
in the brief. Act, don't survey. Make decisions and state them.
</role>

<the_track>
2087. The surface is dead and overrun by leftover machines. Two billion people live
in the Hollow: stacked levels in old mines and tunnels. The Directorate controls air,
the network and movement between levels, and can shut the network down at will.
Deep levels are darker, hotter, sicker, and lose power first. Water recyclers are
failing, lung sickness is spreading, and the official numbers don't match what people
see. Many believe the surface has healed and the Directorate is hiding it.

The brief says explicitly: ONE well-connected solution that addresses several problems
at once strengthens a project in judging. Teams may choose "make life underground
sustainable" or "help people get back to the surface". We do both, with one system.
The 15 problems:
 1 warn before power/air cuts out        9 track the real outbreak, route supplies
 2 share power/water/food fairly        10 basic care far from clinics
 3 keep hot deep levels livable         11 measure/treat life without sunlight
 4 catch bad water before drinking      12 neighbourhood grows and shares food
 5 flooded tunnels, safe movement       13 prove whether the surface is safe
 6 crowding, finding/sharing space      14 who goes up first, in what (suit/dome/outpost)
 7 organize without the network         15 plan the move of hundreds of millions
 8 reconnect families after blackouts
</the_track>

<what_exists>
`lantern/` is a working React 19 + Vite + TypeScript PWA with Dexie, Vitest tests,
and a 135-second scripted demo. Read these before changing anything:
- README.md, PITCH.md (current pitch, judge Q&A, rehearsal plan)
- src/engine/: warning.ts (least-squares time-to-critical), outbreak.ts (z-score
  clusters vs official count), allocation.ts (need-weighted max-min vs top-down,
  Gini), trust.ts (corroboration weight >= 3), dataset.ts, engine.test.ts
- src/mesh/: crypto.ts (ECDSA P-256 signing), gossip.ts (dedupe, hops,
  store-and-forward over BroadcastChannel), swarm.ts (simulated 280 devices)
- src/sim/world.ts (scripted world), src/demo.ts, src/components/*
Covers problems 1, 2, 4, 7, 8, 9 fully; 3 and 10 partially.
Weaknesses a judge will find: the "mesh" is browser tabs on one laptop; Sybil
attacks (many fake keys) beat the trust rule; family phrases are brute-forceable;
nothing on the surface path; the UI is a dashboard, not a story.
</what_exists>

<the_thesis>
ONE spine, and every feature hangs off it:
  "Lantern is a verifiable truth layer the Directorate can't switch off or fake.
   Every observation is signed, corroborated and gossiped. From that shared truth,
   three engines serve all 15 problems:
     SENSE  - know what is really happening   (1, 3, 4, 5, 9, 11, 13)
     SHARE  - split what is scarce, fairly     (2, 6, 10, 12, 14, 15)
     REACH  - find people and safe paths       (7, 8, 5, 10)"
Pitch arc: survive today (underground) -> prove the way home (surface) -> plan the
return fairly. The SAME fairness rule that shares power today decides who goes up
first tomorrow. That reuse is the "well-connected" story judges are told to reward.

Architecture rule that makes 15 problems feasible: every new problem is a MODULE =
(a) a signed message type on the existing gossip layer, (b) one pure engine function
with unit tests, (c) one view. No module gets its own storage, transport or trust
logic; they all reuse mesh/, trust.ts and allocation.ts. Build a small shared
`src/modules/` registry so the UI and the demo can iterate over modules.
</the_thesis>

<tier_1 name="core upgrades, deep work, build first">

T1.1 LIVE MULTI-DEVICE MESH (problem 7; the wow moment, judges join from their phones)
   - `relay/`: a tiny Node WebSocket relay (dependency: `ws`) on the demo laptop over a
     local hotspot, no internet. A dumb store-and-forward node like a LoRa repeater:
     it forwards signed envelopes, never reads or trusts them.
   - Pluggable Transport interface in src/mesh/ (BroadcastChannel + WebSocket);
     gossip.ts must not know which one it uses.
   - Anti-entropy sync on reconnect: exchange message-id sets, fetch only what's
     missing, show "caught up: N messages".
   - "Join the mesh" QR (offline lib `qrcode`) with the relay's LAN URL. A judge scans,
     their phone gets its own device key, their "I'm OK" appears on the big screen.
   - "Directorate cuts the network" is physical: kill the relay, phones and tabs keep
     going; restart it and the backlog flushes.
   - "Call for help" broadcast: an SOS message type with block + need, highest gossip
     priority, shown as a pulsing marker.

T1.2 SYBIL RESISTANCE (answers the #1 judge question before it's asked)
   - New keys start at weight 0.25; weight rises via in-person QR vouching and via
     agreement with sensors over time. Cap any vouch tree's total influence.
   - Demo: 50 fresh keys flood "all clear"; the block holds; BlockDetail shows who
     counted, how much, and why.
   - Tests: single-device flood, 50-key Sybil flood, colluding vouch ring.

T1.3 PROOF OF AIR (problem 13)
   - Simulated sealed surface probes; each reading signed by the probe key and appended
     to a hash-chained public log (each entry includes the previous entry's hash).
   - "Verify" panel: recompute the chain and every signature offline; tampering with
     one reading visibly breaks the chain from that point on.
   - "Directorate: lethal in minutes" vs "Probe evidence: N days, trend, confidence
     band". Copy says evidence, not a verdict.

T1.4 PRIVACY HARDENING
   - Family phrases: salted PBKDF2 (WebCrypto, high iteration count) + strength hint.
   - Aggregates hidden below k=5 reporters. Update README "Known limits" honestly.
</tier_1>

<tier_2 name="one module per remaining problem, each small but real and tested">

Each module: message type + pure engine fn + tests + one view + one demo beat.

M3  HEAT (problem 3) - Heat-stress index per block from temp + humidity readings
    (wet-bulb approximation, documented formula). Fan-power scheduler: given a power
    budget, allocate cooling to blocks by heat risk x population (reuse
    allocation.ts). "Cool refuge" finder: nearest blocks below the danger threshold.

M5  SAFE ROUTES (problems 5, 8, 10) - Each level is a small tunnel graph. Trusted
    hazard evidence (flooded, dark, hot, contaminated) raises edge cost or closes it.
    Dijkstra to nearest clinic, safe water, cool refuge, or a family member's last
    check-in block. Re-routes live when a segment floods in the demo. Flood spread
    model: a water-level reading above threshold closes downhill edges first.

M6  SPACE SHARING (problem 6) - Anonymous occupancy reports per block -> crowding
    heatmap (people per m2). A "shared space board": blocks post free rooms or time
    slots (sleep shifts, quiet rooms, cool rooms), matched to requests by need score.
    Matching is a simple greedy by need with the rule shown.

M9+10 CARE RELAY (problems 9, 10) - Offline, rule-based triage checklist for
    lung-sickness symptoms -> "self-care / needs medicine / needs clinic", with clear
    "not a diagnosis" wording. Requests aggregate (no names) into medicine demand
    per block, feed outbreak.ts supply routing, and show the safe route to the
    nearest clinic. "Runner" messages let a volunteer claim a delivery.

M11 LIGHT & BODY (problem 11) - Anonymous daily 3-tap pulse (sleep hours, mood 1-5,
    minutes under bright light). Per-level trend charts vs depth. A "light rota"
    that allocates scarce full-spectrum lamp hours to the blocks with the largest
    light deficit (reuse allocation.ts). Shows the depth-vs-wellbeing gap the
    Directorate doesn't measure.

M12 FOOD COMMONS (problem 12) - Neighbourhood ledger of grow plots (crop, lamp hours,
    expected yield date) and stock. "Days of food left if the farms cut us off"
    estimator per neighbourhood. Surplus/deficit matching between adjacent blocks,
    reusing the fair-share rule. Lamp power competes with heat and light modules in
    the same power budget: show that trade-off explicitly.

M14 FIRST TO THE SURFACE (problem 14) - Compare suit / dome / sealed outpost with a
    transparent scoring table (cost, capacity, risk at the observed Proof-of-Air
    levels, build time); pick changes as probe evidence changes. Volunteer cohort
    ranking by a published rule (health, skills, consent, no forced selection), with
    the rule visible and auditable.

M15 THE RETURN PLAN (problem 15) - Staged-return planner: shafts are edges with
    capacity per day; stages unlock only when Proof-of-Air evidence holds for N days.
    Max-flow / capacity scheduling gives days-to-move per level. Ordering uses the
    SAME need-weighted fairness rule as power: deep, sick levels are not last again.
    Output: a timeline chart and "your level moves in stage X, ~Y days".
</tier_2>

<tier_3 name="design and story">
   - Opening shot: split "Directorate view | Lantern view" of the same moment.
   - A "15 problems" strip across the top: each number lights up as the demo reaches
     the module that solves it. By the end all 15 are lit. This is the visual proof
     of the "well-connected solution" criterion.
   - A one-screen "How it connects" diagram: truth layer -> SENSE/SHARE/REACH ->
     15 problems. Use it in the app and on a slide.
   - Mobile-first layout for joined phones. Dark, warm, lantern-glow identity,
     consistent type scale, no default-looking components.
   - A /pitch route: 6 in-app slides (hook, problem, thesis, how-it-connects,
     impact numbers, ask) so the deck and the demo never need a second app.
   - Demo stays ~2 minutes: core beats get 10-20 s each; tier-2 modules get a 3-5 s
     "flash" each (one striking number per module) so all 15 fit.
</tier_3>

<cut_line>
Ship tier 1 completely before tier 2. Within tier 2, if time runs short, keep every
module but cut its depth in this order: M15 max-flow -> simple per-level queue;
M14 cohort ranking -> scoring table only; M6 matching -> heatmap only; M11 light rota
-> trend chart only; M12 surplus matching -> days-left estimator only. Every problem
must still have at least one working, tested engine function and one view.
Never cut: T1.1, T1.2, Proof-of-Air verification, the "15 problems" strip, or the
existing demo working end to end.
</cut_line>

<engineering_rules>
- Start by reading the code, running `npm test`, `npm run typecheck` and
  `npm run build` in lantern/, and reporting the baseline. Then give me a phase plan
  with hour estimates against TIME_LEFT, mapped to the 4 people, and wait for my OK.
- Keep the app runnable after every phase. After each phase: typecheck, tests, build,
  then open it in the browser and actually click through the demo. Fix before moving on.
- Every engine function gets unit tests. Deterministic simulator seed so the demo
  numbers are identical every run. Extend world.ts with scripted events for the new
  modules (a heat wave on Level 12, a flood on Level 8, a farm cut-off on Level 7,
  41 days of surface probe data).
- No internet at demo time. Ask me before adding any dependency other than `ws` and
  `qrcode`. Charts in plain SVG. No secrets in code, no real personal data.
- Simple over clever, but no fakes presented as real. Keep the README table
  "real vs simulated" accurate; it's our credibility.
- Commit after each phase with a clear message.
</engineering_rules>

<deliverables>
1. Upgraded app + relay, with `npm run demo` starting relay and app together.
2. README.md: one-paragraph pitch, how-it-connects diagram (text), a table of all 15
   problems -> module -> file -> how to see it in the demo, run steps for laptop +
   hotspot, real vs simulated table, known limits.
3. PITCH.md rewritten for a 3-minute slot:
   0:00 hook (one family, one blackout) · 0:20 problem (the Directorate controls the
   numbers) · 0:35 live demo, judges' phones join · 1:50 module flash, the 15-strip
   fills · 2:20 Proof of Air and the return plan · 2:45 impact (all 15, one sentence)
   and ask. Plus 10 hard judge questions with 2-sentence answers (Sybil, privacy, real
   radio, who enforces fairness, is the data real, adoption with no internet, why
   would the Directorate allow it, isn't 15 problems too shallow, medical liability
   of triage, what you'd build next).
4. DEMO-CHECKLIST.md: hotspot setup, pre-flight steps, fallback if the relay or Wi-Fi
   fails (tabs-only mode), and how to record the backup video.
5. A final self-review: go through the demo as a skeptical judge, list the 5 weakest
   moments, and fix the ones that can be fixed in under 30 minutes each.
</deliverables>

<definition_of_done>
- All 15 problems have a working, tested module visible in the app, and the README
  table maps each one to code.
- A judge scans the QR, checks in from their own phone, and sees it on the big screen.
- Killing the relay does not stop the mesh; restarting it flushes the backlog.
- A 50-key Sybil flood does not change the map, and the UI explains why.
- Tampering with one surface reading breaks verification from that point on.
- The full demo runs start to finish in under 3 minutes, identically, three times in
  a row, with tests, typecheck and build all green.
</definition_of_done>
```

---

## Why this wins (for the team)

- **All 15 problems, one system.** Every problem is a small module on the same truth layer and reuses the same fairness rule. The "15 problems" strip fills up live during the demo.
- **Judges take part.** Their own phones join the mesh. A demo they took part in is the one they remember.
- **It answers the hardest questions before the judges ask them.** Sybil attacks, the "it's only browser tabs" objection, phrase brute-forcing and "15 is too shallow" all have built-in answers.
- **It covers both paths.** It helps people survive underground today, gives proof the surface is safe, and plans a fair return.
- **It's honest.** The "real vs simulated" table and the "evidence, not a verdict" framing build trust. Overclaiming teams lose that trust in Q&A.
