// Lantern community relay.
//
// One process on the demo laptop, reachable over its hotspot with no internet:
//   - serves the built app (dist/) so phones can open it,
//   - runs a WebSocket at /mesh that forwards gossip frames between devices.
//
// It stands in for a LoRa repeater: it stores and forwards signed envelopes and never
// verifies or trusts them. Every device checks every signature itself, so a hostile relay
// can drop messages but cannot forge them. Kill it and restart it: devices reconnect and
// catch up (anti-entropy).
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { networkInterfaces } from 'node:os'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT ?? 8787)
const DIST = resolve(fileURLToPath(new URL('../dist', import.meta.url)))
const MAX_STORED = 5000

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

// Adapters phones can never reach (VMs, containers, WSL). Listed last, after the real ones.
const VIRTUAL = /vmware|virtualbox|vbox|vethernet|hyper-v|wsl|docker|loopback|tailscale|zerotier|bluetooth/i

function lanUrls() {
  const found = []
  for (const [name, list] of Object.entries(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal) found.push({ name, url: `http://${a.address}:${PORT}`, address: a.address })
    }
  }
  // Windows Mobile Hotspot (192.168.137.x) first, then Wi-Fi, then wired, then anything virtual.
  const rank = (x) =>
    x.address.startsWith('192.168.137.') ? 0 : VIRTUAL.test(x.name) ? 9 : /wi-?fi|wlan|wireless/i.test(x.name) ? 1 : /ethernet|eth|en\d/i.test(x.name) ? 2 : 3
  return found.sort((a, b) => rank(a) - rank(b)).map((x) => x.url)
}

function adapterNames() {
  return Object.entries(networkInterfaces()).flatMap(([name, list]) =>
    (list ?? []).filter((a) => a.family === 'IPv4' && !a.internal).map((a) => `${a.address} (${name})`),
  )
}

/** Store-and-forward buffer: signed user messages by id, oldest dropped first. */
const stored = new Map()

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  if (url.pathname === '/api/info') {
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' })
    res.end(JSON.stringify({ urls: lanUrls(), clients: wss.clients.size, stored: stored.size }))
    return
  }
  try {
    let file = normalize(join(DIST, decodeURIComponent(url.pathname)))
    if (!file.startsWith(DIST)) throw new Error('outside dist')
    const st = await stat(file).catch(() => null)
    if (!st || st.isDirectory()) file = join(DIST, 'index.html')
    const body = await readFile(file)
    const type = MIME[extname(file)] ?? 'application/octet-stream'
    res.writeHead(200, { 'content-type': type, 'cache-control': file.endsWith('index.html') || file.endsWith('sw.js') ? 'no-cache' : 'public, max-age=3600' })
    res.end(body)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('Not found. Did you run "npm run build"? ("npm run demo" does both.)')
  }
})

const wss = new WebSocketServer({ server, path: '/mesh' })

wss.on('connection', (ws, req) => {
  const who = req.socket.remoteAddress
  console.log(`[relay] + device ${who} (${wss.clients.size} connected)`)
  // Hand the newcomer everything we are holding; it verifies each message itself.
  if (stored.size) ws.send(JSON.stringify({ t: 'msgs', from: 'relay', msgs: [...stored.values()] }))

  ws.on('message', (raw) => {
    let frame
    try {
      frame = JSON.parse(String(raw))
    } catch {
      return
    }
    if (frame?.t === 'msgs' && Array.isArray(frame.msgs)) {
      for (const m of frame.msgs) {
        if (m && typeof m.id === 'string' && !stored.has(m.id)) {
          stored.set(m.id, m)
          if (stored.size > MAX_STORED) stored.delete(stored.keys().next().value)
        }
      }
    }
    const text = String(raw)
    for (const c of wss.clients) if (c !== ws && c.readyState === 1) c.send(text)
  })
  ws.on('close', () => console.log(`[relay] - device ${who} (${wss.clients.size} connected)`))
})

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  Lantern relay running. No internet needed.\n')
  console.log(`  This laptop:  http://localhost:${PORT}`)
  const urls = lanUrls()
  if (urls.length) {
    console.log(`  Phones:       ${urls[0]}/?phone   <- shown in the app's QR code`)
    console.log(`  All adapters: ${adapterNames().join(', ')}`)
  } else console.log('  Phones:       (no network found: turn on the laptop hotspot)')
  console.log('\n  Ctrl+C to stop (devices keep working and catch up when it is back).\n')
})
