# Lantern: Patriot HackFest Fall 2026

**Track:** Life Underground · **Goal:** 1st place ($2,000)

Lantern is an offline-first, tamper-resistant truth layer for the Hollow. Every observation is signed, cross-checked against independent reports and passed device to device, so the Directorate can't switch it off or fake it. That shared truth feeds three engines covering all 15 problems in the brief:

| Engine | What it does | Problems |
|---|---|---|
| **SENSE** | Know what is really happening | 1, 3, 4, 5, 9, 11, 13 |
| **SHARE** | Split what is scarce, fairly | 2, 6, 10, 12, 14, 15 |
| **REACH** | Find people and safe paths | 5, 7, 8, 10 |

## What's in this repo

| Path | What it is |
|---|---|
| `lantern/` | The app: React + Vite + TypeScript PWA, Dexie, Vitest (added once finalized) |
| `lantern-v2-prompt.md` | The build prompt for the v2 upgrade (all 15 problems) |
| `lantern-plan.md` | Original plan: critique, MVP, architecture, algorithms |
| `hollow-prompt.md` | The prompt kit that produced the plan |

## Run it

```bash
cd lantern
npm install
npm run dev        # http://localhost:5173
npm test           # engine + mesh tests
```

Open two tabs to see peer-to-peer sync. Click **Run 3-min demo** for the scripted story.

## Team workflow

1. Clone: `git clone https://github.com/Mo-JK/Hackathon-Fall-2026.git`
2. Work on a branch named after you or your area: `git checkout -b mesh-relay`
3. Before pushing, run `npm run typecheck` and `npm test` in `lantern/`. Both must pass.
4. Open a pull request into `main`. One teammate reviews it, then merge.
5. Never commit `node_modules/`, `dist/`, `.env` or real personal data.

| Person | Area |
|---|---|
| A | Mesh + relay |
| B | UI + design |
| C | Engines |
| D | Pitch, demo, QA |

## Submission checklist

- [ ] All tests, typecheck and build green on `main`
- [ ] README in `lantern/` maps all 15 problems to code
- [ ] `PITCH.md` rehearsed 3 times, under 3:00
- [ ] Backup demo video recorded
- [ ] Repo visibility switched to **Public** if the judges require a public link
- [ ] Submission form filled in with the repo link, video and team names
