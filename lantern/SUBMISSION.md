# Submission: 3-minute video and demo URL

The video is what most judges will actually watch. It has one job: show, in under 3:00, that **real phones join a mesh nobody can switch off**, that **lies can't move the map**, and that **one system answers all 15 problems**.

## What you need
- The laptop running `npm run demo` on its hotspot (see [DEMO-CHECKLIST.md](DEMO-CHECKLIST.md)).
- One real phone on that hotspot, held by a teammate.
- **Laptop recording:** OBS Studio (free), recording the full screen at 1920×1080 with your mic. Xbox Game Bar (Win+Alt+R) also works but records only one window.
- **Phone recording:** iPhone: Control Center → Screen Recording. Android: Quick Settings → Screen record.
- **Editing:** Clipchamp (built into Windows 11, free), to place the phone recording over the laptop recording.

## Before you hit record
1. Stop the relay (Ctrl+C) and start it again with `npm run demo`, so it holds no rehearsal messages.
2. On the laptop open **`http://localhost:8787/?fresh`** in Chrome, then press F11. Check: 0/15, no LIVE bar, "Directorate network: online", "Trust rule: on".
3. On the phone, clear Lantern's site data if it was used in rehearsal (Chrome → Settings → Site settings → All sites → the laptop's address → Delete), so it starts as a newcomer.
4. Start the phone's screen recording, then OBS.

## Shot list (target 2:50, hard limit 3:00)

| Time | Screen | Say (voiceover) |
|---|---|---|
| **0:00–0:12** | Slides → slide 1 | "Level 9, 3 a.m. The lights go out and the network goes with them. A mother, two kids, one room. Her sister is four levels up. The official bulletin says: all systems normal." |
| **0:12–0:22** | Slide 3 (the diagram) | "Lantern is a truth layer nobody can switch off or fake. Every report is signed, cross-checked and passed device to device. Three engines on top of it answer all fifteen problems in the brief." |
| **0:22–0:48** | App, **📱 Join** open. Phone recording overlaid bottom-right. | "This is a real phone. It scans the code, makes its own key, and joins: no app, no account." Phone taps **I'm OK** → green **LIVE** bar on the laptop. Phone taps **Send SOS** → the laptop's *Your block* card says "Nobody has answered yet", you click **I'll go** → the phone shows **"Your SOS was heard: 1 person is on the way."** "Two devices, no internet, no server we don't control." |
| **0:48–0:50** | Close Join, click **▶ Run demo** | (silence; let it start) |
| **0:50–2:45** | The in-app demo, beats 2–16 | Read the beat lines from [PITCH.md](PITCH.md). In the edit, **cut beat 1** (you already did the intro) and speed **beats 10–13** (care, space, light, food) to 1.5×. That brings the demo from 2:19 to about 1:55. |
| **2:45–2:55** | Last beat, 15/15 lit | "Fifteen problems, one idea: a picture of reality nobody can switch off and nobody can easily fake. Real signing, real mesh, real trust rule; simulated sensors and radio, and we say so." |

**Must keep, never cut:** the phone joining (0:22), beat 6 (fifty fake identities, block holds), beat 7 (rule off, lie wins), and beat 15 (forged reading caught at exactly that entry). These four moments are the proof.

**In the edit (Clipchamp):**
1. Put the laptop recording on track 1. Add the phone recording on track 2, resize it to about a quarter of the screen, and place it bottom-right.
2. Sync the two recordings on the moment the LIVE bar appears.
3. Show the phone overlay only for 0:22–0:48, then remove it.
4. Add the captions "Real phone, no internet" at 0:22 and "Simulated: sensors and radio" at the end. Honesty scores.
5. Export at 1080p and check the length is under 3:00.

**Tips:** narrate slower than feels natural. Never say a number that isn't on screen. If a take goes wrong, keep recording and start that beat again; you can cut it later.

## Demo URL

The same build runs from any static host. A hosted copy runs the whole demo, the slides, and phone mode in a second browser tab. Only real phones joining needs the laptop relay; the Join card says so.

**Option A: GitHub Pages (same repo the judges see)**
1. The repo must be **public** (Settings → General → Danger Zone → Change visibility). Pages on a private repo needs a paid plan.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Actions** tab → **Deploy demo to GitHub Pages** → **Run workflow**. It runs the 69 tests, builds, and publishes.
4. Your URL: **https://mo-jk.github.io/Hackathon-Fall-2026/**. Add `#/pitch` for the slides, and `?phone` (in a second tab) for phone mode.

**Option B: Netlify (works with a private repo)**
1. `cd lantern && npm run build`
2. Go to https://app.netlify.com/drop (free account) and drag the `lantern/dist` folder onto the page.
3. You get a URL like `https://something.netlify.app`. Rename it under Site settings.

**What to write in the submission form**
- **Video:** the 3-minute recording.
- **Demo URL:** the hosted link, plus one line: "Click ▶ Run demo (2 min). For phone mode, open the same link with ?phone in a second tab. Real phones join over a laptop relay, as shown in the video."
- **Repo:** https://github.com/Mo-JK/Hackathon-Fall-2026
