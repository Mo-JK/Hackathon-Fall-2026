# Lantern: 3-minute pitch and rehearsal kit

Setup before you speak: laptop on its own hotspot, `npm run demo` running, app open full screen, the **📱 Join** QR ready. The in-app demo runs **about 2 min 19 s** across 17 beats. Open the laptop at `http://localhost:8787/?fresh` so nothing from rehearsal shows as live. Captions carry the structure; your voice adds the meaning.

Quote the numbers on screen, not the ones written here. The demo is deterministic, but read what you see.

---

## Script

### 0:00–0:15 Hook (Slides, slide 1)
> Level 9. 3 a.m. The lights go out, and the network goes with them. A mother, two kids, one room. Her sister is four levels up. The Directorate's bulletin says: all systems normal.

### 0:15–0:25 Problem (slide 2 → slide 4, the QR)
> One set of hands holds the air, the grid, the network and the numbers. When the numbers are wrong, nobody sees the failure coming. Lantern is a truth layer nobody can switch off or fake. **Take out your phones and scan this.** You're about to be part of the demo.

Give the room ~10 seconds to scan. Then **back to the app** and click **▶ Run demo** at about 0:30.

### 0:30–2:47 Live demo (say these on the caption changes)

| Beat | Say |
|---|---|
| 1 Two views | "Left: what the Directorate publishes. Right: what people and sensors report, signed and cross-checked." |
| 2 Numbers | "The Directorate says about a dozen cases. Lantern estimates hundreds." |
| 3 Warnings | "Warnings before the lights go out, each one saying why. See this one: bad water on Level 11, *warned 70 minutes ahead*." (point at the green "warned … ahead" tag) |
| 4 Heat | "Heat plus humidity: where bodies can't cool themselves. Fans go to the most people at most risk." |
| 5 Network cut | "Now they pull the plug. The feed dies. Your phones are still connected." (point at the LIVE bar if a judge checked in) |
| 6 Sybil attack | "Their obvious move: flood the map with lies. Fifty fake identities. The block holds. New keys together count as half a stranger." |
| 7 Rule off | "Turn the rule off and the lie wins. That rule is the product." |
| 8 Fair share | "Upper levels first leaves the deepest blocks with nothing. We equalise coverage of need. The same rule runs everything that follows." |
| 9 Flood | "Sewage floods Level 8. Gauges close tunnels and flag the stairs below before they go under, so the route to the clinic re-plans around them. And an SOS two blocks away that nobody has answered: one tap, *I'm on my way*, and everyone sees it's covered." |
| 10–13 Flash | Let the captions run. One line: "Care, space, light, food: every one a small, tested engine on the same truth layer." |
| 14 Family | "The mother taps I'm OK. Her sister already did. No account, no name: a stretched hash and a block." |
| 15 Proof of Air | "Forty-one days of signed probe readings. Someone forges one to make the air look deadly. The chain breaks at exactly that entry." |
| 16 The way up | "The honest copy comes back from other devices. Verified evidence chooses suits for the first wave, and the deepest level reaches the surface weeks sooner under the fair plan." |
| 17 Close | (silent for the caption) |

### 2:47–3:00 Close
> Fifteen problems, one idea: a picture of reality nobody can switch off and nobody can easily fake. Real signing, real gossip, real trust rule, simulated sensors and radio, and we say so. Next: calibrate with real clinics and sensors, and take it to the lowest levels first.

---

## Ten hard questions

1. **"Can't an attacker make thousands of fake identities?"** They can make the keys, but every newcomer key together counts for at most half a person, and you need 3 to change the map. Trust comes from in-person vouching (3 per member, one level deep, capped per vouch tree) or from many hours of agreeing with sensors. That's slow and expensive to fake.
2. **"The Directorate is the adversary. What stops it tracking people?"** Reports carry a block, never a name. Family check-ins share only a PBKDF2-stretched hash, and sensitive totals are hidden until 5 devices contribute. Honest gap: device keys are stable pseudonyms; production rotates them.
3. **"Your mesh is browser tabs and a laptop. Is it real?"** The judges' phones in this room are real devices with their own keys, talking through a relay that can't forge anything. The radio is the simulated part. BLE, LoRa or Wi-Fi Direct plug in behind the same transport interface, and nothing above it changes.
4. **"Who enforces your fair share?"** Nobody has to. It's an auditable proposal: "what was given" next to "what a fair rule would give" is evidence for negotiation and for showing neglect.
5. **"Is any of this real data?"** No, and the footer says so. The claim is that the engines behave correctly, checked by 69 tests, not that the numbers describe a population.
6. **"How does it spread with no internet?"** The app is a web page served from any relay laptop. Scan a QR code and you're in, with no store and no account. Each device carries messages for others.
7. **"Why would the Directorate allow it?"** It wouldn't have to. Nothing here needs its network, its servers or its permission. The relay is a laptop; the probes sign their own data.
8. **"Isn't 15 problems too shallow?"** Each is a real engine with tests, on one shared base: the same trust layer, the same fairness rule. The README maps every problem to a file and a test, and the *Your block* card joins all of them into plain advice for one resident.
9. **"Triage is medical advice. Liability?"** It's a checklist that sorts urgency and says plainly it's not a diagnosis. Only the outcome leaves the device. Clinicians must review the rules before real use.
10. **"What would you build next?"** Real radio transport (LoRa), clinician-reviewed triage rules, key rotation, and calibrating the reporting rates with one real clinic on the lowest level.

---

## Rehearsal

**Before you start:** follow [DEMO-CHECKLIST.md](DEMO-CHECKLIST.md). Reload the app so state is fresh (network online, trust on, 0/15).

**Three run-throughs**
1. Read the script aloud with a timer: target 3:00, hard stop 3:10. If you run long, shorten beats 2, 8 and 10–13. Never cut beats 6, 7 or 15.
2. With the demo running, check that your lines land on the caption changes.
3. Cold, no notes, with a teammate on a phone joining at 0:20 and another playing a judge asking two of the questions above.

**If something goes wrong**
| Problem | Fix |
|---|---|
| Phones can't load the page | Say "venue Wi-Fi blocks devices from talking to each other; here's a second tab as a phone," and open `/?phone` in a new tab. |
| Demo stalls | **Stop demo**, **Reset**, **Run demo** again; or narrate from the backup video. |
| Numbers differ from the script | Say the numbers on screen. |
| A question you can't answer | "We haven't tested that; here's what we'd do first." |

**Roles (4 people):** one speaks, one drives the laptop, one watches the clock (signals at 1:30 and 2:30) and helps judges scan, one handles Q&A alongside the speaker.
