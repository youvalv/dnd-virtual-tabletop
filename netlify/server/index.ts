// Netlify Server entrypoint: one long-running Node.js process that serves the
// JSON API under /api/* and the realtime WebSocket endpoint at /ws.
// The React frontend is static files in the publish directory (dist/).
import { createServer } from 'node:http'
import { WebSocketServer, type WebSocket } from 'ws'
import { onShutdown } from '@netlify/server'
import type { ClientMessage } from '../../shared/types.ts'
import { handleHttp } from '../../server/http.ts'
import {
  type Client, type Room, allRooms, buildState, getRoom, releaseRoomIfEmpty, send, applyLocalChange, visibleMessages,
} from '../../server/hub.ts'
import { bumpVersion, findParticipantByToken, loadParticipants, recentMessages, updateParticipant } from '../../server/store.ts'
import { handleOp, OpError } from '../../server/ops.ts'
import { hashToken, shortId, HttpError } from '../../server/util.ts'

export const config = {
  path: ['/api/*', '/ws'],
}

const server = createServer((req, res) => {
  void handleHttp(req, res)
})

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 })

wss.on('connection', (ws: WebSocket) => {
  let client: Client | null = null
  let room: Room | null = null
  let lastSeenWrite = 0
  // Messages are processed one at a time per socket, in order.
  let queue: Promise<void> = Promise.resolve()

  const helloTimer = setTimeout(() => {
    if (!client) ws.close(4001, 'hello timeout')
  }, 10_000)

  async function handleHello(msg: Extract<ClientMessage, { type: 'hello' }>) {
    if (client) return
    const campaignId = String(msg.campaignId ?? '')
    const token = String(msg.token ?? '')
    const r = await getRoom(campaignId)
    if (!r) {
      send({ ws } as Client, { type: 'error', message: 'This campaign does not exist.', fatal: true })
      return ws.close(4004, 'not found')
    }
    const p = await findParticipantByToken(campaignId, hashToken(token))
    if (!p || p.removed) {
      send({ ws } as Client, { type: p?.removed ? 'kicked' : 'error', message: 'You are not part of this campaign. Ask the DM for an invite link.', fatal: true } as never)
      releaseRoomIfEmpty(r)
      return ws.close(4003, 'unauthorized')
    }
    clearTimeout(helloTimer)
    room = r
    client = {
      ws, id: shortId(8), participantId: p.id, role: p.role as 'dm' | 'player', campaignId, viewSceneId: null, lastState: '',
      rate: { pings: [], drags: [], ops: [] },
    }
    r.clients.add(client)
    await updateParticipant(p.id, { online: true, lastSeen: new Date() })
    const row = await bumpVersion(campaignId)
    r.participants = await loadParticipants(campaignId)
    const msgs = await recentMessages(campaignId)
    const state = buildState(r, client)
    client.lastState = JSON.stringify(state)
    send(client, {
      type: 'welcome',
      you: { participantId: p.id, role: client.role, name: p.name },
      ...state,
      messages: visibleMessages(msgs, client.role),
      version: r.row.version,
    })
    applyLocalChange(r, row) // tell everyone else this player is online
  }

  ws.on('message', (data) => {
    queue = queue.then(async () => {
      let msg: ClientMessage
      try {
        msg = JSON.parse(String(data))
      } catch {
        return
      }
      try {
        if (msg.type === 'hello') return await handleHello(msg)
        if (!client || !room) return
        if (msg.type === 'heartbeat') {
          if (Date.now() - lastSeenWrite > 45_000) {
            lastSeenWrite = Date.now()
            await updateParticipant(client.participantId, { online: true, lastSeen: new Date() })
          }
          return
        }
        if (msg.type === 'op') {
          try {
            await handleOp(room, client, msg.op)
            if (msg.reqId) send(client, { type: 'ack', reqId: msg.reqId, ok: true })
          } catch (e) {
            const message = e instanceof OpError || e instanceof HttpError ? e.message : 'Something went wrong. Please try again.'
            if (!(e instanceof OpError) && !(e instanceof HttpError)) console.error('[op]', msg.op?.type, e)
            if (msg.reqId) send(client, { type: 'ack', reqId: msg.reqId, ok: false, error: message })
            else send(client, { type: 'error', message })
          }
        }
      } catch (e) {
        console.error('[ws]', e)
      }
    })
  })

  ws.on('close', () => {
    clearTimeout(helloTimer)
    const c = client
    const r = room
    if (!c || !r) return
    r.clients.delete(c)
    queue = queue.then(async () => {
      try {
        const stillHere = [...r.clients].some((x) => x.participantId === c.participantId)
        if (!stillHere) {
          await updateParticipant(c.participantId, { online: false, lastSeen: new Date() })
          const row = await bumpVersion(r.id)
          r.participants = await loadParticipants(r.id)
          applyLocalChange(r, row)
        }
      } catch (e) {
        console.warn('[ws] presence update failed', (e as Error).message)
      } finally {
        releaseRoomIfEmpty(r)
      }
    })
  })

  ws.on('error', () => {})
})

onShutdown(async ({ drained }) => {
  // Ask clients to reconnect right away; they will land on a healthy instance.
  for (const room of allRooms()) for (const c of room.clients) c.ws.close(1012, 'server restarting')
  await drained
})

export default server
