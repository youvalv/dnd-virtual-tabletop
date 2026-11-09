// HTTP API: campaign creation, invites/joining, map image upload and serving.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { getStore } from '@netlify/blobs'
import { AVATARS, TOKEN_COLORS } from '../shared/presets.ts'
import {
  findParticipantByToken, insertCampaign, insertMessage, insertParticipant, listSessions, listSnapshots,
  loadCampaign, loadCampaignByInvite, loadParticipants, mutateCampaign, NoChange, bumpVersion,
} from './store.ts'
import { applyLocalChange, getLoadedRoom, notifyMessages, syncRoom } from './hub.ts'
import { blankBoard, demoBoard } from './content.ts'
import { playerMapSafe } from './views.ts'
import { WATCHTOWER_MAP_WEBP_BASE64 } from './demo-map.ts'
import { HttpError, cleanColor, cleanIcon, cleanText, clampInt, hashToken, safeEqual, secretToken, shortId, sign } from './util.ts'

const MAX_PLAYERS = 10
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

const maps = () => getStore({ name: 'maps', consistency: 'strong' })

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > limit) throw new HttpError(413, 'That file is too large (8 MB max).')
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const buf = await readBody(req, 64 * 1024)
  if (buf.length === 0) return {}
  try {
    const v = JSON.parse(buf.toString('utf8'))
    return v && typeof v === 'object' ? v : {}
  } catch {
    throw new HttpError(400, 'Invalid JSON body.')
  }
}

function sniffImage(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return 'image/png'
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  if (buf.toString('ascii', 0, 3) === 'GIF') return 'image/gif'
  return null
}

async function authParticipant(req: IncomingMessage, campaignId: string) {
  const auth = req.headers.authorization ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) throw new HttpError(401, 'Missing credentials.')
  const p = await findParticipantByToken(campaignId, hashToken(token))
  if (!p || p.removed) throw new HttpError(403, 'Not allowed.')
  return p
}

async function requireDm(req: IncomingMessage, campaignId: string) {
  const p = await authParticipant(req, campaignId)
  if (p.role !== 'dm') throw new HttpError(403, 'Only the DM can do that.')
  return p
}

async function afterChange(campaignId: string, row: Awaited<ReturnType<typeof bumpVersion>>) {
  const room = getLoadedRoom(campaignId)
  if (room) applyLocalChange(room, row, { participants: await loadParticipants(campaignId) })
}

// ---------------------------------------------------------------------------

async function createCampaign(req: IncomingMessage, res: ServerResponse) {
  const body = await readJson(req)
  const demo = body.demo === true
  const name = cleanText(body.name, 80).trim() || (demo ? 'The Ruined Watchtower' : 'Untitled campaign')
  const dmName = cleanText(body.dmName, 32).trim() || 'Dungeon Master'
  const id = shortId(10)
  const token = secretToken()
  const board = demo ? demoBoard() : blankBoard()
  if (demo) {
    const tower = board.scenes[0]
    await maps().set(`${id}/${tower.id}/full/1`, Buffer.from(WATCHTOWER_MAP_WEBP_BASE64, 'base64'))
  }
  await insertCampaign({ id, name, inviteCode: shortId(8), board, mapSecret: secretToken(), isDemo: demo })
  const dm = await insertParticipant({
    id: shortId(12), campaignId: id, role: 'dm', name: dmName, avatar: 'crown', color: '#c9a24a', tokenHash: hashToken(token),
  })
  await insertMessage({
    campaignId: id, participantId: null, authorName: 'Table', kind: 'system',
    text: demo
      ? 'Welcome to The Ruined Watchtower! DM: your guide is in the Session tab. Share the invite link so players can join.'
      : `${name} is ready. Share the invite link so players can join.`,
  })
  json(res, 201, { campaignId: id, participantId: dm.id, token, role: 'dm', name })
}

async function inviteInfo(res: ServerResponse, code: string) {
  const row = await loadCampaignByInvite(code)
  if (!row) throw new HttpError(404, 'This invite link is not valid anymore. Ask your DM for a new one.')
  const parts = await loadParticipants(row.id)
  const dm = parts.find((p) => p.role === 'dm')
  json(res, 200, {
    campaignId: row.id,
    name: row.name,
    status: row.status,
    isDemo: row.isDemo,
    dmName: dm?.name ?? 'the DM',
    players: parts.filter((p) => p.role === 'player' && !p.removed).length,
    maxPlayers: MAX_PLAYERS,
    characters: row.board.characters.map((c) => ({ id: c.id, name: c.name, summary: c.summary, icon: c.icon, color: c.color, claimed: !!c.ownerId })),
  })
}

async function joinCampaign(req: IncomingMessage, res: ServerResponse, code: string) {
  const body = await readJson(req)
  const row = await loadCampaignByInvite(code)
  if (!row) throw new HttpError(404, 'This invite link is not valid anymore. Ask your DM for a new one.')
  const name = cleanText(body.name, 32).trim()
  if (!name) throw new HttpError(400, 'Pick a display name.')
  const parts = await loadParticipants(row.id)
  if (parts.filter((p) => p.role === 'player' && !p.removed).length >= MAX_PLAYERS) throw new HttpError(409, 'This table is full (10 players).')
  const avatar = AVATARS.includes(String(body.avatar)) ? String(body.avatar) : cleanIcon(body.avatar, 'sword')
  const color = cleanColor(body.color, TOKEN_COLORS[parts.length % TOKEN_COLORS.length])
  const token = secretToken()
  const p = await insertParticipant({ id: shortId(12), campaignId: row.id, role: 'player', name, avatar, color, tokenHash: hashToken(token) })

  const characterId = typeof body.characterId === 'string' ? body.characterId : null
  let claimed: string | null = null
  const updated = await mutateCampaign(row.id, (board) => {
    if (!characterId) return
    const ch = board.characters.find((c) => c.id === characterId)
    if (!ch || ch.ownerId) return
    ch.ownerId = p.id
    claimed = ch.name
  }).catch((e) => (e instanceof NoChange ? null : Promise.reject(e)))
  await afterChange(row.id, updated)
  const msg = await insertMessage({
    campaignId: row.id, participantId: null, authorName: 'Table', kind: 'system',
    text: claimed ? `${name} joined the table as ${claimed}.` : `${name} joined the table.`,
  })
  const room = getLoadedRoom(row.id)
  if (room) notifyMessages(room, [msg])
  json(res, 201, { campaignId: row.id, participantId: p.id, token, role: 'player', name: row.name })
}

async function uploadMap(req: IncomingMessage, res: ServerResponse, campaignId: string, sceneId: string, url: URL) {
  await requireDm(req, campaignId)
  const buf = await readBody(req, MAX_IMAGE_BYTES)
  if (!sniffImage(buf)) throw new HttpError(415, 'Upload a PNG, JPEG, WebP or GIF image.')
  const width = clampInt(url.searchParams.get('width'), 16, 10000, 1000)
  const height = clampInt(url.searchParams.get('height'), 16, 10000, 1000)
  const cols = clampInt(url.searchParams.get('cols'), 4, 80, 24)
  const rows = clampInt(url.searchParams.get('rows'), 4, 80, 18)
  const row0 = await loadCampaign(campaignId)
  const scene0 = row0?.board.scenes.find((s) => s.id === sceneId)
  if (!scene0) throw new HttpError(404, 'Scene not found.')
  const rev = (scene0.bg.kind === 'image' ? scene0.bg.rev : 0) + 1
  await maps().set(`${campaignId}/${sceneId}/full/${rev}`, buf)
  const row = await mutateCampaign(campaignId, (board) => {
    const scene = board.scenes.find((s) => s.id === sceneId)
    if (!scene) throw new HttpError(404, 'Scene not found.')
    const nextRev = Math.max(rev, (scene.bg.kind === 'image' ? scene.bg.rev : 0) + 1)
    scene.bg = { kind: 'image', width, height, rev: nextRev }
    if (nextRev !== rev) throw new HttpError(409, 'Another upload happened at the same time. Try again.')
    scene.revealed = (scene.fogEnabled ? '0' : '1').repeat(cols * rows)
    scene.cols = cols
    scene.rows = rows
    scene.fogRev += 1
    scene.hideRev = scene.fogRev
    scene.playerMapRev = -1
    for (const t of scene.tokens) {
      t.x = Math.min(t.x, cols - t.size)
      t.y = Math.min(t.y, rows - t.size)
    }
  })
  await afterChange(campaignId, row)
  json(res, 200, { ok: true })
}

// The DM's browser renders the map with fog painted over unrevealed squares and
// uploads it here. Players only ever download this masked image.
async function uploadPlayerMap(req: IncomingMessage, res: ServerResponse, campaignId: string, sceneId: string, url: URL) {
  await requireDm(req, campaignId)
  const fogRev = clampInt(url.searchParams.get('fogRev'), 0, 2 ** 31 - 1, -1)
  const buf = await readBody(req, MAX_IMAGE_BYTES)
  if (!sniffImage(buf)) throw new HttpError(415, 'Invalid image.')
  const before = await loadCampaign(campaignId)
  const s0 = before?.board.scenes.find((s) => s.id === sceneId)
  if (!s0 || s0.bg.kind !== 'image') throw new HttpError(404, 'Scene not found.')
  if (fogRev < s0.hideRev || fogRev > s0.fogRev) return json(res, 409, { error: 'stale' })
  await maps().set(`${campaignId}/${sceneId}/player/${fogRev}`, buf)
  let previous = -1
  const row = await mutateCampaign(campaignId, (board) => {
    const scene = board.scenes.find((s) => s.id === sceneId)
    if (!scene || scene.bg.kind !== 'image') throw new NoChange()
    // Only accept a newer render that is still at least as restrictive as the current fog.
    if (fogRev <= scene.playerMapRev || fogRev < scene.hideRev || fogRev > scene.fogRev) throw new NoChange()
    previous = scene.playerMapRev
    scene.playerMapRev = fogRev
  }).catch((e) => (e instanceof NoChange ? null : Promise.reject(e)))
  if (!row) return json(res, 409, { error: 'stale' })
  if (previous >= 0) await maps().delete(`${campaignId}/${sceneId}/player/${previous}`).catch(() => {})
  await afterChange(campaignId, row)
  json(res, 200, { ok: true })
}

async function serveMap(res: ServerResponse, campaignId: string, sceneId: string, variant: string, revStr: string, url: URL) {
  const r = url.searchParams.get('r') ?? ''
  const exp = Number(url.searchParams.get('exp') ?? 0)
  const sig = url.searchParams.get('sig') ?? ''
  if (variant !== 'full' && variant !== 'player') throw new HttpError(404, 'Not found')
  if (!exp || exp * 1000 < Date.now()) throw new HttpError(403, 'Link expired')
  const room = getLoadedRoom(campaignId)
  const row = room?.row ?? (await loadCampaign(campaignId))
  if (!row) throw new HttpError(404, 'Not found')
  const expected = sign(row.mapSecret, `${campaignId}.${sceneId}.${variant}.${revStr}.${r}.${exp}`)
  if (!safeEqual(expected, sig)) throw new HttpError(403, 'Invalid signature')
  const scene = row.board.scenes.find((s) => s.id === sceneId)
  if (!scene || scene.bg.kind !== 'image') throw new HttpError(404, 'Not found')
  let key: string
  if (variant === 'full') {
    // Players may only load the unmasked image when fog is off on the active scene.
    if (r !== 'd' && (scene.fogEnabled || scene.id !== row.board.activeSceneId)) throw new HttpError(403, 'Not allowed')
    key = `${campaignId}/${sceneId}/full/${scene.bg.rev}`
  } else {
    if (r !== 'd' && scene.id !== row.board.activeSceneId) throw new HttpError(403, 'Not allowed')
    if (!playerMapSafe(scene)) throw new HttpError(404, 'Not ready')
    key = `${campaignId}/${sceneId}/player/${scene.playerMapRev}`
  }
  const data = await maps().get(key, { type: 'arrayBuffer' })
  if (!data) throw new HttpError(404, 'Not found')
  const buf = Buffer.from(data)
  res.writeHead(200, {
    'content-type': sniffImage(buf) ?? 'application/octet-stream',
    'cache-control': 'private, max-age=86400',
    'x-content-type-options': 'nosniff',
  })
  res.end(buf)
}

async function getSnapshots(req: IncomingMessage, res: ServerResponse, campaignId: string) {
  await requireDm(req, campaignId)
  const [snaps, sessions] = await Promise.all([listSnapshots(campaignId), listSessions(campaignId)])
  json(res, 200, { snapshots: snaps, sessions })
}

async function whoAmI(req: IncomingMessage, res: ServerResponse, campaignId: string) {
  const p = await authParticipant(req, campaignId)
  const row = await loadCampaign(campaignId)
  json(res, 200, { participantId: p.id, role: p.role, name: p.name, campaignName: row?.name })
}

// ---------------------------------------------------------------------------

// Local development only: `netlify dev` sends every non-static path to the
// server, so forward page and asset requests to the Vite dev server. In
// production the server only receives /api/* and /ws (see its config).
const IS_LOCAL_DEV = process.env.NETLIFY_DEV === 'true' || process.env.CONTEXT === 'dev'
async function proxyToVite(req: IncomingMessage, res: ServerResponse, url: URL) {
  const upstream = await fetch(`http://localhost:5173${url.pathname}${url.search}`, { headers: { accept: req.headers.accept ?? '*/*' } })
  const isPage = (upstream.headers.get('content-type') ?? '').includes('text/html') || upstream.status === 404
  const final = isPage && !/\.[a-z0-9]+$/i.test(url.pathname) ? await fetch('http://localhost:5173/index.html') : upstream
  res.writeHead(final.status, { 'content-type': final.headers.get('content-type') ?? 'application/octet-stream', 'cache-control': 'no-store' })
  res.end(Buffer.from(await final.arrayBuffer()))
}

export async function handleHttp(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const parts = url.pathname.split('/').filter(Boolean) // ['api', ...]
  const method = req.method ?? 'GET'
  if (IS_LOCAL_DEV && parts[0] !== 'api' && (method === 'GET' || method === 'HEAD')) {
    return proxyToVite(req, res, url).catch(() => json(res, 502, { error: 'Vite dev server is not running on port 5173' }))
  }
  try {
    if (parts[0] !== 'api') throw new HttpError(404, 'Not found')
    const [, a, b, c, d, e] = parts
    if (a === 'health') return json(res, 200, { ok: true })
    if (a === 'campaigns' && !b && method === 'POST') return await createCampaign(req, res)
    if (a === 'invite' && b && !c && method === 'GET') return await inviteInfo(res, b)
    if (a === 'invite' && b && c === 'join' && method === 'POST') return await joinCampaign(req, res, b)
    if (a === 'campaigns' && b && c === 'me' && method === 'GET') return await whoAmI(req, res, b)
    if (a === 'campaigns' && b && c === 'snapshots' && method === 'GET') return await getSnapshots(req, res, b)
    if (a === 'campaigns' && b && c === 'scenes' && d && e === 'map' && method === 'POST') return await uploadMap(req, res, b, d, url)
    if (a === 'campaigns' && b && c === 'scenes' && d && e === 'player-map' && method === 'POST') return await uploadPlayerMap(req, res, b, d, url)
    if (a === 'maps' && b && c && d && e && method === 'GET') return await serveMap(res, b, c, d, e, url)
    throw new HttpError(404, 'Not found')
  } catch (err) {
    if (err instanceof HttpError) return json(res, err.status, { error: err.message })
    console.error('[http]', err)
    json(res, 500, { error: 'Something went wrong on the server.' })
  }
}

export { syncRoom }
