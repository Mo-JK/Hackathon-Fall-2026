# Lantern: 3-minute pitch and rehearsal kit

The in-app demo (**Run 3-min demo**) now lasts **135 seconds** (9 steps). The pitch wraps 30 seconds of setup before it and 15 seconds of close after it, which makes 3:00. Start the demo on the beat marked below and let the on-screen captions carry the structure; your voice adds the meaning.

Numbers: the demo is deterministic, but quote them as approximate ("about 2,000 versus about 35"). Check them in your last run-through and say what the screen shows.

---

## Script

### 0:00 - 0:20 Hook (demo not started; show the map, all green)
> Level 9. A mother, two kids, one room. At 3 a.m. the lights go out and the network goes with them. Her sister is four levels up. Neither knows if the other is alive. The Directorate's bulletin says: all systems normal.

### 0:20 - 0:30 Problem
> Everything in the Hollow runs through one set of hands: the air, the grid, the network, and the numbers. When the numbers are wrong, nobody can see the failure coming. We built Lantern so the people living it can.

**Click "Run 3-min demo" at 0:30.**

### 0:30 - 2:45 Live demo (captions run automatically; say these lines on the beats)

| Time | Demo step | Say |
|---|---|---|
| 0:30 | 1. Level 9, Block 2 | "Same family. Official status: normal." |
| 0:37 | 2. The numbers do not match | "Residents on Level 10 start reporting symptoms. Lantern compares each block with its own normal and flags a cluster. The Directorate says about 35 cases. Lantern estimates about 2,000." |
| 0:59 | 3. Warnings before the lights go out | "Trends in power, water, heat and air give warnings with minutes to spare, and every one says *why*. Here, bad water on Level 11 is caught before it crosses the safe line." |
| 1:21 | 4. The Directorate cuts the network | "Now they pull the plug. The official feed goes dark. Lantern doesn't notice: every report is signed and passed device to device." |
| 1:35 | 5. An attack on the truth | "Their obvious move is to flood the system with lies. One device, a hundred fake outage reports, aimed at a healthy block. The map doesn't move. A device counts once, and a block only changes when independent evidence adds up." |
| 1:49 | 6. Without the trust rule | "Turn the rule off and the same lie turns the block red. That rule is the product." |
| 1:57 | 7. Fair shares of scarce power | "Today the upper levels are served first. At 55% supply, the worst-off block gets nothing. Lantern equalises coverage of need, weighted by depth and by live hazards: everyone gets 55%, and the people left under half drop from about 180,000 to zero. This is an auditable proposal, so a neighbourhood can show exactly who is being left out." |
| 2:17 | 8. Finding family in a blackout | "And the mother? She taps *I'm OK* with a phrase the family agreed on. Her sister searches the same phrase and sees her: Level 9, block 2. No account, no name, only a hash and a block." |
| 2:39 | 9. The truth, shared by the people living it | (stay quiet for the caption, 6 seconds) |

### 2:45 - 3:00 Close
> Six of the fifteen problems, one idea: a picture of reality that no one can switch off and no one can easily fake. Real signing, real gossip, real trust rule, simulated sensors and radio, and we say so. The next step is the part that matters: calibrate it with real clinics and real sensors, and take it to the lower levels first.

---

## Toughest judge questions

**1. "Can't an attacker just create thousands of fake devices?"**
Today, no: the trust rule stops one noisy device, not an attacker who controls many keys, and we say that openly. The next layer is device attestation and reputation, so new keys carry little weight until they agree with sensors and long-standing neighbours.

**2. "If the Directorate is the adversary, what stops it from tracking people?"**
Reports carry a block-level location and no name, and check-ins share only a hash of the family phrase. The honest gaps: a device key is a stable pseudonym, and a short phrase can be brute-forced, so production needs rotating keys and long phrases.

**3. "Your mesh is just browser tabs. Is it real?"**
The protocol is real: signed messages, dedupe, hop budgets, store-and-forward, tested. The radio is simulated; production would carry the same messages over Bluetooth, LoRa or Wi-Fi Direct, and nothing above the transport changes.

**4. "Who enforces your fair share? The Directorate won't."**
Nobody has to: it is deliberately advisory. Publishing "what was given" next to "what a fair rule would give" gives neighbourhoods evidence to negotiate, share informally and prove neglect. The rule is simple enough to argue about: equal coverage of need, adjusted for depth and live hazards.

**5. "Is any of this real data?"**
No, and the footer says so. The simulator is scripted to show the mechanics; the claim is that the engines behave correctly on it, which the tests check, not that the numbers describe a real population. Calibrating the reporting rate and hardship weights with real clinics is the first real-world step.

---

## Rehearsal plan

**Before you start**
- [ ] Production-like run: `npm run build` then `npm run preview`, or `npm run dev`. Open the page, wait for "Generating device keys..." to disappear.
- [ ] Reload the page (fresh state): network **online**, trust rule **on**, tab on Warnings.
- [ ] Browser zoom so the map and the right panel are both readable from the back of the room.
- [ ] Record a backup screen capture of one clean run.

**Three run-throughs**
1. **Read-through, no screen.** Time the script aloud: target 3:00, hard stop 3:10. If you run long, cut the sentences in rows 2 and 7; never cut rows 5 and 6.
2. **With the demo, reading from the table.** Check you start the demo exactly at 0:30 and that your voice lands on each caption change.
3. **Cold run, no notes**, with one teammate playing a judge who asks two questions from the list above.

**If something goes wrong**
| Problem | Fix |
|---|---|
| Demo stalls or looks wrong | Click **Stop demo**, **Reset**, then **Start** at 8x and narrate the finished state; the end screen shows every effect. |
| Numbers differ from your script | Say the numbers on screen. Never quote a number you aren't looking at. |
| Page freezes | Reload; the pitch continues from the backup video. |
| Question you can't answer | "We haven't tested that; here is what we'd do first." Then the plan. |

**Who does what (4 people)**: one speaks, one drives the keyboard, one watches the clock and signals at 1:30 and 2:30, one handles questions with the speaker.
