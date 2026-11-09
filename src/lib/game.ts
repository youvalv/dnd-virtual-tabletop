// Realtime client: one WebSocket per open table, with automatic reconnection
// (exponential backoff + jitter). The server is authoritative: on every
// (re)connect it sends a full "welcome" snapshot, so nothing is lost when the
// network drops, the tab sleeps, or the server instance is replaced.
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type {
  BoardView, CampaignMeta, ChatMessage, ClientOp, ParticipantView, PingEvent, ServerMessage, YouInfo,
} from '../../shared/types.ts'

export type ConnStatus = 'connecting' | 'open' | 'reconnecting' | 'fatal' | 'kicked'

export interface GameState {
  status: ConnStatus
  error: string | null
  you: YouInfo | null
  campaign: CampaignMeta | null
  board: BoardView | null
  participants: ParticipantView[]
  messages: ChatMessage[]
  version: number
}

export interface DragEvent {
  sceneId: string
  tokenId: string
  x: number
  y: number
}

type Listener = () => void

export class GameClient {
  state: GameState = { status: 'connecting', error: null, you: null, campaign: null, board: null, participants: [], messages: [], version: 0 }
  private ws: WebSocket | null = null
  private listeners = new Set<Listener>()
  private pingListeners = new Set<(p: PingEvent) => void>()
  private dragListeners = new Set<(d: DragEvent) => void>()
  private messageListeners = new Set<(m: ChatMessage[]) => void>()
  private pending = new Map<number, { resolve: (r: { ok: boolean; error?: string }) => void; timer: number }>()
  private reqId = 0
  private attempts = 0
  private retryTimer: number | null = null
  private heartbeat: number | null = null
  private closed = false
  constructor(
    private campaignId: string,
    private token: string,
  ) {}

  start() {
    this.closed = false
    this.connect()
    window.addEventListener('online', this.wake)
    document.addEventListener('visibilitychange', this.wake)
  }

  stop() {
    this.closed = true
    window.removeEventListener('online', this.wake)
    document.removeEventListener('visibilitychange', this.wake)
    if (this.retryTimer) clearTimeout(this.retryTimer)
    if (this.heartbeat) clearInterval(this.heartbeat)
    this.ws?.close()
  }

  private wake = () => {
    if (document.visibilityState === 'hidden' || this.closed) return
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      if (this.retryTimer) clearTimeout(this.retryTimer)
      this.attempts = 0
      this.connect()
    }
  }

  private set(patch: Partial<GameState>) {
    this.state = { ...this.state, ...patch }
    for (const l of this.listeners) l()
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
  getSnapshot = () => this.state
  onPing(fn: (p: PingEvent) => void) {
    this.pingListeners.add(fn)
    return () => this.pingListeners.delete(fn)
  }
  onDrag(fn: (d: DragEvent) => void) {
    this.dragListeners.add(fn)
    return () => this.dragListeners.delete(fn)
  }
  onMessages(fn: (m: ChatMessage[]) => void) {
    this.messageListeners.add(fn)
    return () => this.messageListeners.delete(fn)
  }

  private connect() {
    if (this.closed) return
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${location.host}/ws`)
    this.ws = ws
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'hello', campaignId: this.campaignId, token: this.token }))
    }
    ws.onmessage = (e) => this.handle(JSON.parse(e.data) as ServerMessage)
    ws.onclose = () => {
      if (this.ws !== ws) return
      if (this.heartbeat) clearInterval(this.heartbeat)
      for (const [, p] of this.pending) {
        clearTimeout(p.timer)
        p.resolve({ ok: false, error: 'Connection lost. Try again in a moment.' })
      }
      this.pending.clear()
      if (this.closed || this.state.status === 'fatal' || this.state.status === 'kicked') return
      this.set({ status: 'reconnecting' })
      const delay = Math.min(8000, 400 * 2 ** this.attempts) * (0.7 + Math.random() * 0.6)
      this.attempts++
      this.retryTimer = window.setTimeout(() => this.connect(), delay)
    }
    ws.onerror = () => {}
  }

  private handle(m: ServerMessage) {
    switch (m.type) {
      case 'welcome':
        this.attempts = 0
        if (this.heartbeat) clearInterval(this.heartbeat)
        this.heartbeat = window.setInterval(() => this.ws?.readyState === WebSocket.OPEN && this.ws.send(JSON.stringify({ type: 'heartbeat' })), 20_000)
        this.set({ status: 'open', error: null, you: m.you, campaign: m.campaign, board: m.board, participants: m.participants, messages: m.messages, version: m.version })
        break
      case 'state':
        this.set({ campaign: m.campaign, board: m.board, participants: m.participants, version: m.version })
        break
      case 'messages': {
        const known = new Set(this.state.messages.map((x) => x.id))
        const fresh = m.messages.filter((x) => !known.has(x.id))
        if (fresh.length) {
          this.set({ messages: [...this.state.messages, ...fresh].slice(-400) })
          for (const l of this.messageListeners) l(fresh)
        }
        break
      }
      case 'ping':
        for (const l of this.pingListeners) l(m.ping)
        break
      case 'drag':
        for (const l of this.dragListeners) l(m)
        break
      case 'ack': {
        const p = this.pending.get(m.reqId)
        if (p) {
          clearTimeout(p.timer)
          this.pending.delete(m.reqId)
          p.resolve({ ok: m.ok, error: m.error })
        }
        break
      }
      case 'error':
        if (m.fatal) this.set({ status: 'fatal', error: m.message })
        else this.set({ error: m.message })
        break
      case 'kicked':
        this.set({ status: 'kicked', error: 'The DM removed you from this table.' })
        break
    }
  }

  /** Sends an operation; resolves when the server accepted or rejected it. */
  op(op: ClientOp): Promise<{ ok: boolean; error?: string }> {
    const ws = this.ws
    if (!ws || ws.readyState !== WebSocket.OPEN || this.state.status !== 'open') {
      return Promise.resolve({ ok: false, error: 'Reconnecting to the table...' })
    }
    const id = ++this.reqId
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id)
        resolve({ ok: false, error: 'The server took too long to answer.' })
      }, 12_000)
      this.pending.set(id, { resolve, timer })
      ws.send(JSON.stringify({ type: 'op', reqId: id, op }))
    })
  }

  /** Fire-and-forget for high-frequency ephemeral ops (drag previews, pings). */
  fire(op: ClientOp) {
    if (this.ws?.readyState === WebSocket.OPEN && this.state.status === 'open') this.ws.send(JSON.stringify({ type: 'op', op }))
  }

  clearError() {
    this.set({ error: null })
  }
}

export function useGame(campaignId: string, token: string | null) {
  const client = useMemo(() => (token ? new GameClient(campaignId, token) : null), [campaignId, token])
  useEffect(() => {
    if (!client) return
    client.start()
    return () => client.stop()
  }, [client])
  const empty = useMemo(() => new GameClient('', '').state, [])
  const state = useSyncExternalStore(client ? client.subscribe : noopSubscribe, client ? client.getSnapshot : () => empty)
  return { client, state }
}

const noopSubscribe = () => () => {}
