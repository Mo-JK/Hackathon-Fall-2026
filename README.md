# Lantern: Patriot HackFest Fall 2026

**Track:** Life Underground · **Goal:** 1st place ($2,000)

Lantern is a truth layer the Directorate can't switch off or fake. Every observation is signed, cross-checked against independent evidence and passed device to device. From that shared truth, three engines answer **all 15 problems** in the brief:

| Engine | What it does | Problems |
|---|---|---|
| **SENSE** | Know what is really happening | 1, 3, 4, 5, 9, 11, 13 |
| **SHARE** | Split what is scarce, fairly | 2, 6, 10, 12, 14, 15 |
| **REACH** | Find people and safe paths | 5, 7, 8, 10 |

Judges scan a QR code and their own phones join the mesh live. The full details are in [lantern/README.md](lantern/README.md).

## Quick start (teammates)

You need [Node.js](https://nodejs.org) 20+ and Git.

```bash
git clone https://github.com/Mo-JK/Hackathon-Fall-2026.git
cd Hackathon-Fall-2026/lantern
npm install
npm run dev
```

Open http://localhost:5173 and click **▶ Run demo**.

**In VS Code:** File → Open Folder → `Hackathon-Fall-2026`, then Terminal → Run Task… and pick:

| Task | What it does |
|---|---|
| Lantern: install | `npm install` |
| Lantern: dev (hot reload) | App at http://localhost:5173 for editing |
| Lantern: demo (build + relay, phones can join) | The real demo at http://localhost:8787 |
| Lantern: test | 68 tests |
| Lantern: check | Typecheck + tests + build (run before pushing) |

## What's in this repo

| Path | What it is |
|---|---|
| `lantern/` | The app: React + Vite + TypeScript PWA, relay, 68 tests |
| `lantern/README.md` | How it works, all 15 problems mapped to code, real vs simulated, known limits |
| `lantern/PITCH.md` | 3-minute script, 10 hard judge questions, rehearsal plan |
| `lantern/DEMO-CHECKLIST.md` | Hotspot setup, firewall, pre-flight, fallbacks |
| `lantern/PLAN-v2.md` | The v2 build plan |
| `lantern-v2-prompt.md` | The prompt that drove the v2 build |
| `lantern-plan.md`, `hollow-prompt.md` | Original plan and prompt kit |

## Team workflow

1. `git pull` before you start.
2. Work on a branch: `git checkout -b your-name/what-you-are-doing`.
3. Run **Lantern: check** before pushing. It must pass.
4. Open a pull request into `main`; one teammate reviews, then merge.
5. Never commit `node_modules/`, `dist/`, `.env` or real personal data.

| Person | Area |
|---|---|
| A | Mesh + relay (`src/mesh`, `relay/`) |
| B | UI + design (`src/components`, `styles.css`) |
| C | Engines (`src/engine`, `src/modules`) |
| D | Pitch, demo, QA (`PITCH.md`, `DEMO-CHECKLIST.md`) |

## Submission checklist

- [ ] `npm run check` green on `main`
- [ ] Two real phones joined over the hotspot in a full rehearsal
- [ ] `PITCH.md` rehearsed 3 times, under 3:00
- [ ] Backup demo video recorded
- [ ] Repo switched to **Public** if the judges need a public link
- [ ] Submission form filled in with the repo link, video and team names
