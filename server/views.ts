// Per-viewer projections of the authoritative board.
// Everything a player client receives passes through these functions; anything
// not copied here (hidden tokens, fogged monsters, DM notes, guide, private
// rolls, other scenes, exact monster HP/AC) never leaves the server for them.
import type {
  Board, BoardView, CharacterView, InitiativeView, Role, Scene, SceneView, Token, TokenView,
} from '../shared/types.ts'
import { sign } from './util.ts'

export interface Viewer {
  participantId: string
  role: Role
  viewSceneId?: string | null // DM may look at a scene other than the active one
}

export function isRevealed(scene: Scene, x: number, y: number): boolean {
  if (!scene.fogEnabled) return true
  if (x < 0 || y < 0 || x >= scene.cols || y >= scene.rows) return false
  return scene.revealed[y * scene.cols + x] === '1'
}

export function controlsToken(board: Board, token: Token, participantId: string): boolean {
  if (token.ownerId && token.ownerId === participantId) return true
  if (token.kind === 'pc' && token.characterId) {
    const ch = board.characters.find((c) => c.id === token.characterId)
    return !!ch && ch.ownerId === participantId
  }
  return false
}

// Can a player see this token at the given position?
export function tokenVisibleToPlayer(board: Board, scene: Scene, token: Token, viewerId: string, at?: { x: number; y: number }): boolean {
  if (controlsToken(board, token, viewerId)) return true
  if (token.hidden) return false
  if (token.kind === 'pc') return true // party members are always visible to each other
  const x = at?.x ?? token.x
  const y = at?.y ?? token.y
  for (let dy = 0; dy < token.size; dy++) for (let dx = 0; dx < token.size; dx++) if (isRevealed(scene, x + dx, y + dy)) return true
  return false
}

function healthBucket(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 4
  if (hp <= 0) return 0
  const r = hp / maxHp
  if (r > 0.75) return 4
  if (r > 0.5) return 3
  if (r > 0.25) return 2
  return 1
}

function tokenStats(board: Board, t: Token) {
  if (t.kind === 'pc' && t.characterId) {
    const ch = board.characters.find((c) => c.id === t.characterId)
    if (ch) return { hp: ch.hp, maxHp: ch.maxHp, ac: ch.ac, conditions: ch.conditions }
  }
  return { hp: t.hp, maxHp: t.maxHp, ac: t.ac, conditions: t.conditions }
}

function tokenView(board: Board, t: Token, viewer: Viewer): TokenView {
  const s = tokenStats(board, t)
  const exact = viewer.role === 'dm' || t.kind === 'pc' || controlsToken(board, t, viewer.participantId)
  const { dmNotes, hp, maxHp, ac, ...rest } = t
  const v: TokenView = {
    ...rest,
    conditions: s.conditions,
    hp: exact ? s.hp : null,
    maxHp: exact ? s.maxHp : null,
    ac: exact ? s.ac : null,
    health: healthBucket(s.hp, s.maxHp),
  }
  if (viewer.role === 'dm') v.dmNotes = dmNotes
  return v
}

export function mapUrl(campaignId: string, secret: string, scene: Scene, variant: 'full' | 'player', role: Role): string {
  const rev = variant === 'full' ? (scene.bg.kind === 'image' ? scene.bg.rev : 0) : scene.playerMapRev
  // Expiry is rounded to 6-hour windows so the URL stays stable between state pushes
  // (a changing URL would make every client re-download the map on each update).
  const exp = (Math.floor(Date.now() / 1000 / 21600) + 2) * 21600
  const r = role === 'dm' ? 'd' : 'p'
  const payload = `${campaignId}.${scene.id}.${variant}.${rev}.${r}.${exp}`
  return `/api/maps/${campaignId}/${scene.id}/${variant}/${rev}?r=${r}&exp=${exp}&sig=${sign(secret, payload)}`
}

export function playerMapSafe(scene: Scene): boolean {
  return scene.playerMapRev >= 0 && scene.playerMapRev >= scene.hideRev
}

function sceneView(board: Board, scene: Scene, viewer: Viewer, campaignId: string, secret: string): SceneView {
  const isDm = viewer.role === 'dm'
  let url: string | null = null
  let pending = false
  if (scene.bg.kind === 'image') {
    if (isDm || !scene.fogEnabled) url = mapUrl(campaignId, secret, scene, 'full', viewer.role)
    else if (playerMapSafe(scene)) url = mapUrl(campaignId, secret, scene, 'player', viewer.role)
    else pending = true
  }
  const tokens = scene.tokens
    .filter((t) => isDm || tokenVisibleToPlayer(board, scene, t, viewer.participantId))
    .map((t) => tokenView(board, t, viewer))
  return {
    id: scene.id,
    name: scene.name,
    cols: scene.cols,
    rows: scene.rows,
    bg: scene.bg,
    fogEnabled: scene.fogEnabled,
    revealed: scene.fogEnabled ? scene.revealed : '',
    fogRev: scene.fogRev,
    playerMapRev: scene.playerMapRev,
    hideRev: scene.hideRev,
    mapUrl: url,
    mapPending: pending,
    tokens,
    ...(isDm ? { brief: scene.brief ?? null } : {}),
  }
}

function initiativeView(board: Board, viewer: Viewer): InitiativeView {
  const active = board.scenes.find((s) => s.id === board.activeSceneId)
  const isDm = viewer.role === 'dm'
  const visible = (tokenId: string | null) => {
    if (isDm || !tokenId) return true
    for (const s of board.scenes) {
      const t = s.tokens.find((tk) => tk.id === tokenId)
      if (t) return s === active && tokenVisibleToPlayer(board, s, t, viewer.participantId)
    }
    return true
  }
  const current = board.initiative.entries[board.initiative.turn] ?? null
  const entries = board.initiative.entries.filter((e) => visible(e.tokenId))
  const currentVisible = current ? entries.some((e) => e.id === current.id) : false
  return {
    round: board.initiative.round,
    entries,
    currentId: current && currentVisible ? current.id : null,
    hiddenTurn: !!current && !currentVisible,
  }
}

export function boardView(board: Board, viewer: Viewer, campaignId: string, secret: string): BoardView {
  const isDm = viewer.role === 'dm'
  const sceneId = isDm && viewer.viewSceneId && board.scenes.some((s) => s.id === viewer.viewSceneId) ? viewer.viewSceneId : board.activeSceneId
  const scene = board.scenes.find((s) => s.id === sceneId) ?? null
  const characters: CharacterView[] = board.characters.map((c) => {
    const { dmNotes, ...rest } = c
    return isDm ? { ...rest, dmNotes } : rest
  })
  const view: BoardView = {
    scene: scene ? sceneView(board, scene, viewer, campaignId, secret) : null,
    characters,
    initiative: initiativeView(board, viewer),
  }
  if (isDm) {
    view.scenes = board.scenes.map((s) => ({
      id: s.id, name: s.name, cols: s.cols, rows: s.rows, hasImage: s.bg.kind === 'image', fogEnabled: s.fogEnabled, tokenCount: s.tokens.length, hasBrief: !!s.brief,
    }))
    view.activeSceneId = board.activeSceneId
    view.sessionNotes = board.sessionNotes
    view.guide = board.guide
    view.editingSceneId = sceneId
    view.mapJobs = board.mapJobs ?? []
  }
  return view
}
