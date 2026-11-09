// Realtime hub: keeps one in-memory "room" per campaign that has sockets on this
// server instance, pushes per-viewer state, and keeps instances in sync.
//
// Cross-instance sync: Netlify can run several server instances, each with its
// own sockets. Every change bumps campaigns.version in Postgres and sends a
// NOTIFY. Instances LISTEN for those and also poll versions every few seconds
// as a fallback, so a missed notification only delays an update, never loses it.
import type { WebSocket } from 'ws'
import type pg from 'pg'
import { getDatabase } from '@netlify/database'
import type { ChatMessage, ParticipantView, PingEvent, ServerMessage, CampaignMeta } from '../shared/types.ts'
import {
  type CampaignRow, type MessageRow, type ParticipantRow,
  loadCampaign, loadParticipants, maxMessageId, messagesAfter, pollVersions, toChatMessage,
} from './store.ts'
import { boardView, tokenVisibleToPlayer, type Viewer } from './views.ts'
import { shortId } from './util.ts'

export const INSTANCE_ID = shortId(8)
const CHANNEL = 'vtt_sync'
const POLL_MS = 2500
const ONLINE_WINDOW_MS = 90_000

export interface Client {
  ws: WebSocket
  id: string
  participantId: string
  role: 'dm' | 'player'
  campaignId: string
  viewSceneId: string | null
  lastState: string
  rate: { pings: number[]; drags: number[]; ops: number[] }
}

export interface Room {
  id: string
  row: CampaignRow
  participants: ParticipantRow[]
  clients: Set<Client>
  lastMsgId: number
  syncing: Promise<void> | null
  resyncRequested: boolean
}

const rooms = new Map<string, Room>()
const loading = new Map<string, Promise<Room | null>>()

export function getLoadedRoom(id: string): Room | undefined {
  return rooms.get(id)
}

export async function getRoom(id: string): Promise<Room | null> {
  const existing = rooms.get(id)
  if (existing) return existing
  const pending = loading.get(id)
  if (pending) return pending
  const p = (async () => {
    const row = await loadCampaign(id)
    if (!row) return null
    const [parts, lastMsgId] = await Promise.all([loadParticipants(id), maxMessageId(id)])
    const room: Room = { id, row, participants: parts, clients: new Set(), lastMsgId, syncing: null, resyncRequested: false }
    rooms.set(id, room)
    ensureSyncLoops()
    return room
  })()
  loading.set(id, p)
  try {
    return await p
  } finally {
    loading.delete(id)
  }
}

export function releaseRoomIfEmpty(room: Room) {
  if (room.clients.size === 0) rooms.delete(room.id)
  if (rooms.size === 0) stopSyncLoops()
}

export function send(client: Client, msg: ServerMessage) {
  if (client.ws.readyState === 1) client.ws.send(JSON.stringify(msg))
}

function viewerOf(c: Client): Viewer {
  return { participantId: c.participantId, role: c.role, viewSceneId: c.viewSceneId }
}

export function campaignMeta(row: CampaignRow, role: 'dm' | 'player'): CampaignMeta {
  return {
    id: row.id,
    name: row.name,
    status: row.status as CampaignMeta['status'],
    sessionNumber: row.sessionNumber,
    isDemo: row.isDemo,
    ...(role === 'dm' ? { inviteCode: row.inviteCode } : {}),
  }
}

export function participantViews(room: Room): ParticipantView[] {
  const localOnline = new Set([...room.clients].map((c) => c.participantId))
  const now = Date.now()
  return room.participants
    .filter((p) => !p.removed)
    .map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role as 'dm' | 'player',
      avatar: p.avatar,
      color: p.color,
      online: localOnline.has(p.id) || (p.online && now - new Date(p.lastSeen).getTime() < ONLINE_WINDOW_MS),
      canMove: p.canMove,
      canChat: p.canChat,
    }))
}

export function buildState(room: Room, c: Client) {
  return {
    campaign: campaignMeta(room.row, c.role),
    board: boardView(room.row.board, viewerOf(c), room.id, room.row.mapSecret),
    participants: participantViews(room),
  }
}

/** Sends each client its own filtered view, skipping clients whose view did not change. */
export function pushState(room: Room, force = false) {
  for (const c of room.clients) {
    const p = room.participants.find((x) => x.id === c.participantId)
    if (!p || p.removed) {
      send(c, { type: 'kicked' })
      c.ws.close(4003, 'removed')
      continue
    }
    const state = buildState(room, c)
    const json = JSON.stringify(state)
    if (!force && json === c.lastState) continue
    c.lastState = json
    send(c, { type: 'state', ...state, version: room.row.version })
  }
}

export function visibleMessages(msgs: MessageRow[], role: 'dm' | 'player'): ChatMessage[] {
  return msgs.filter((m) => role === 'dm' || !m.dmOnly).map(toChatMessage)
}

export function deliverMessages(room: Room, msgs: MessageRow[]) {
  const fresh = msgs.filter((m) => m.id > room.lastMsgId)
  if (fresh.length === 0) return
  room.lastMsgId = Math.max(room.lastMsgId, ...fresh.map((m) => m.id))
  for (const c of room.clients) {
    const list = visibleMessages(fresh, c.role)
    if (list.length) send(c, { type: 'messages', messages: list })
  }
}

/** Called after this instance changed the campaign row. */
export function applyLocalChange(room: Room, row: CampaignRow | null, opts: { participants?: ParticipantRow[] } = {}) {
  if (row && row.version >= room.row.version) room.row = row
  if (opts.participants) room.participants = opts.participants
  pushState(room)
  notify({ k: 'sync', c: room.id })
}

export function notifyMessages(room: Room, msgs: MessageRow[]) {
  deliverMessages(room, msgs)
  notify({ k: 'sync', c: room.id })
}

// ---------- ephemeral events (pings, drag previews) ----------

export function broadcastPing(room: Room, ping: PingEvent, fromInstance = INSTANCE_ID) {
  for (const c of room.clients) {
    const viewing = c.role === 'dm' ? c.viewSceneId ?? room.row.board.activeSceneId : room.row.board.activeSceneId
    if (viewing === ping.sceneId) send(c, { type: 'ping', ping })
  }
  if (fromInstance === INSTANCE_ID) notify({ k: 'ping', c: room.id, ping })
}

export function broadcastDrag(room: Room, sceneId: string, tokenId: string, x: number, y: number, exceptClientId: string | null, fromInstance = INSTANCE_ID) {
  const board = room.row.board
  const scene = board.scenes.find((s) => s.id === sceneId)
  const token = scene?.tokens.find((t) => t.id === tokenId)
  if (!scene || !token) return
  for (const c of room.clients) {
    if (c.id === exceptClientId) continue
    const viewing = c.role === 'dm' ? c.viewSceneId ?? board.activeSceneId : board.activeSceneId
    if (viewing !== sceneId) continue
    if (c.role !== 'dm' && !tokenVisibleToPlayer(board, scene, token, c.participantId, { x, y })) continue
    send(c, { type: 'drag', sceneId, tokenId, x, y })
  }
  if (fromInstance === INSTANCE_ID) notify({ k: 'drag', c: room.id, s: sceneId, t: tokenId, x, y })
}

// ---------- cross-instance sync ----------

type Notice =
  | { k: 'sync'; c: string }
  | { k: 'ping'; c: string; ping: PingEvent }
  | { k: 'drag'; c: string; s: string; t: string; x: number; y: number }

const pgdb = getDatabase()
let listenClient: pg.PoolClient | null = null
let listenStarting = false
let pollTimer: ReturnType<typeof setInterval> | null = null
let pingTimer: ReturnType<typeof setInterval> | null = null

function notify(n: Notice) {
  const payload = JSON.stringify({ ...n, i: INSTANCE_ID })
  if (payload.length > 7900) return
  pgdb.pool.query('select pg_notify($1, $2)', [CHANNEL, payload]).catch((e: unknown) => console.warn('[hub] notify failed', (e as Error).message))
}

async function startListening() {
  if (listenClient || listenStarting || rooms.size === 0) return
  listenStarting = true
  try {
    const client = (await pgdb.pool.connect()) as pg.PoolClient
    client.on('notification', (msg) => {
      if (!msg.payload) return
      try {
        const n = JSON.parse(msg.payload) as Notice & { i: string }
        if (n.i === INSTANCE_ID) return
        const room = rooms.get(n.c)
        if (!room) return
        if (n.k === 'sync') void syncRoom(room)
        else if (n.k === 'ping') broadcastPing(room, n.ping, n.i)
        else if (n.k === 'drag') broadcastDrag(room, n.s, n.t, n.x, n.y, null, n.i)
      } catch {
        /* ignore malformed */
      }
    })
    client.on('error', () => {
      try { client.release(true) } catch { /* already released */ }
      if (listenClient === client) listenClient = null
    })
    await client.query(`LISTEN ${CHANNEL}`)
    listenClient = client
  } catch (e) {
    console.warn('[hub] LISTEN unavailable, relying on polling', (e as Error).message)
  } finally {
    listenStarting = false
  }
}

function ensureSyncLoops() {
  void startListening()
  if (!pollTimer) {
    pollTimer = setInterval(() => void pollAll(), POLL_MS)
  }
  if (!pingTimer) {
    // Keep sockets healthy and detect dead connections.
    pingTimer = setInterval(() => {
      for (const room of rooms.values()) for (const c of room.clients) if (c.ws.readyState === 1) c.ws.ping()
      if (!listenClient) void startListening()
    }, 25_000)
  }
}

function stopSyncLoops() {
  if (pollTimer) clearInterval(pollTimer)
  if (pingTimer) clearInterval(pingTimer)
  pollTimer = null
  pingTimer = null
  if (listenClient) {
    const c = listenClient
    listenClient = null
    c.query(`UNLISTEN ${CHANNEL}`).catch(() => {}).finally(() => c.release())
  }
}

async function pollAll() {
  if (rooms.size === 0) return
  try {
    const versions = await pollVersions([...rooms.keys()])
    for (const v of versions) {
      const room = rooms.get(v.id)
      if (!room) continue
      if (v.version > room.row.version || v.maxMsg > room.lastMsgId) void syncRoom(room)
    }
  } catch (e) {
    console.warn('[hub] poll failed', (e as Error).message)
  }
}

/** Reloads a room from the database and pushes any changes to its clients. */
export async function syncRoom(room: Room): Promise<void> {
  if (room.syncing) {
    room.resyncRequested = true
    return room.syncing
  }
  room.syncing = (async () => {
    try {
      do {
        room.resyncRequested = false
        const [row, parts, msgs] = await Promise.all([loadCampaign(room.id), loadParticipants(room.id), messagesAfter(room.id, room.lastMsgId)])
        if (!row) return
        if (row.version >= room.row.version) room.row = row
        room.participants = parts
        deliverMessages(room, msgs)
        pushState(room)
      } while (room.resyncRequested)
    } finally {
      room.syncing = null
    }
  })()
  return room.syncing
}

export function allRooms() {
  return rooms.values()
}
