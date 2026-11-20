# Demo checklist

## The night before
- [ ] `cd lantern && npm install && npm run check`: all green.
- [ ] Test with two real phones on the same setup you'll use on stage (below). Do one full run.
- [ ] Record a backup video of one clean run (Win+Alt+R with Xbox Game Bar, or OBS). Keep it on the desktop.

## Network: use the laptop's own hotspot
Venue Wi-Fi often blocks devices from reaching each other ("client isolation"). Your own hotspot avoids that, and needs no internet.

1. Windows **Settings → Network & internet → Mobile hotspot**: turn it on. Note the name and password. (It may need *some* connection to share; if it refuses, use a phone hotspot that both the laptop and the judges' phones join.)
2. Allow the relay through Windows Firewall once. Run this in an **admin** PowerShell:
   ```
   New-NetFirewallRule -DisplayName "Lantern relay" -Direction Inbound -Protocol TCP -LocalPort 8787 -Action Allow
   ```
3. `cd lantern && npm run demo`. The terminal prints the address phones will use, for example `http://192.168.137.1:8787/?phone`. That address is also in the app's QR code.
4. On your own phone, join the hotspot and scan the QR (**📱 Join** in the app). You should see "relay ✓" on the phone and "1 phone" in the app.

## Pre-flight (5 minutes before)
- [ ] `npm run demo` running; laptop on the hotspot; a teammate's phone joined.
- [ ] Reload the laptop page: 0/15 problems, network online, trust rule on.
- [ ] Browser full screen (F11), zoom so the map and right panel are both readable from the back.
- [ ] Hotspot name and password written on a card for the judges, next to the QR.
- [ ] Laptop on power, notifications off (Focus assist), sleep disabled.

## During the pitch
- Show the QR at 0:20 (Slides → slide 4, or **📱 Join**).
- Click **▶ Run demo** at about 0:30.
- If a judge's phone checks in, point at the green **LIVE** bar.

## Fallbacks
| Situation | Do this |
|---|---|
| Relay won't start: "port in use" | Another copy is running. Close it, or `set PORT=8788` then `npm run relay`, and use that port. |
| Phones can't connect | Firewall (step 2) or client isolation: switch to the hotspot. Last resort: open `http://localhost:8787/?phone` in a second tab and say so. |
| QR shows the wrong address | The terminal lists all adapters; open `http://<hotspot-ip>:8787` on the laptop and the QR updates to that host. |
| Demo freezes | Stop demo → Reset → Run demo. Or switch to the backup video. |
| Want to show relay resilience | In the relay terminal press Ctrl+C, send something from a phone (it says "queued"), run `npm run relay` again: it arrives, and Mesh & trust shows "Caught up". |
