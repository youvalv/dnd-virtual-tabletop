// Authoritative handlers for every client operation. Each handler validates
// input and permissions on the server; clients are never trusted.
import type { Board, Character, ClientOp, InitiativeEntry, Scene, Token, TokenKind } from '../shared/types.ts'
import { rollDice } from '../shared/dice.ts'
import { CONDITIONS } from '../shared/presets.ts'
import {
  NoChange, bumpVersion, endSessionRow, getSnapshot, insertMessage, loadParticipants, mutateCampaign,
  resumeSessionRow, saveSnapshot, startSessionRow, updateParticipant,
} from './store.ts'
import { type Client, type Room, applyLocalChange, broadcastDrag, broadcastPing, notifyMessages, pushState, send } from './hub.ts'
import { controlsToken } from './views.ts'
import { makeCharacter, makeToken, blankScene, emptyFog } from './content.ts'
import { clampInt, cleanColor, cleanIcon, cleanText, rollDie, shortId } from './util.ts'

export class OpError extends Error {}

const MAX_SCENES = 12
const MAX_TOKENS = 120
const MAX_CHARACTERS = 16

function requireDm(c: Client) {
  if (c.role !== 'dm') throw new OpError('Only the DM can do that.')
}

function me(room: Room, c: Client) {
  const p = room.participants.find((x) => x.id === c.participantId)
  if (!p || p.removed) throw new OpError('You are no longer in this campaign.')
  return p
}

function findScene(board: Board, id: string): Scene {
  const s = board.scenes.find((x) => x.id === id)
  if (!s) throw new OpError('Scene not found.')
  return s
}

function findToken(board: Board, tokenId: string): { scene: Scene; token: Token } {
  for (const scene of board.scenes) {
    const token = scene.tokens.find((t) => t.id === tokenId)
    if (token) return { scene, token }
  }
  throw new OpError('Token not found.')
}

function editingScene(board: Board, c: Client): Scene {
  return board.scenes.find((s) => s.id === c.viewSceneId) ?? findScene(board, board.activeSceneId)
}

function cleanConditions(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return [...new Set(v.filter((x): x is string => typeof x === 'string' && CONDITIONS.includes(x)))]
}

function cleanKind(v: unknown, fallback: TokenKind): TokenKind {
  return v === 'pc' || v === 'monster' || v === 'npc' ? v : fallback
}

function sortInitiative(board: Board) {
  const current = board.initiative.entries[board.initiative.turn]?.id
  board.initiative.entries.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
  const idx = current ? board.initiative.entries.findIndex((e) => e.id === current) : 0
  board.initiative.turn = Math.max(0, idx)
}

function canPlayerMoveToken(room: Room, c: Client, board: Board, token: Token) {
  if (c.role === 'dm') return
  const p = me(room, c)
  if (room.row.status !== 'live') throw new OpError('The session has not started yet.')
  if (!p.canMove) throw new OpError('The DM has paused token movement for you.')
  if (!controlsToken(board, token, c.participantId)) throw new OpError('You can only move your own token.')
}

function resizeFog(scene: Scene, cols: number, rows: number) {
  const next: string[] = []
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const inOld = x < scene.cols && y < scene.rows
      next.push(inOld ? scene.revealed[y * scene.cols + x] : scene.fogEnabled ? '0' : '1')
    }
  scene.revealed = next.join('')
  scene.cols = cols
  scene.rows = rows
  scene.fogRev += 1
  scene.hideRev = scene.fogRev // cell geometry changed: any masked player image is stale
  for (const t of scene.tokens) {
    t.x = Math.min(t.x, cols - t.size)
    t.y = Math.min(t.y, rows - t.size)
  }
}

async function systemMessage(room: Room, text: string, dmOnly = false) {
  const m = await insertMessage({ campaignId: room.id, participantId: null, authorName: 'Table', kind: 'system', text, dmOnly })
  notifyMessages(room, [m])
}

async function postRoll(room: Room, c: Client, expr: string, label: string | undefined, isPrivate: boolean) {
  const p = me(room, c)
  if (!p.canChat) throw new OpError('The DM has muted chat for you.')
  if (isPrivate && c.role !== 'dm') throw new OpError('Only the DM can make private rolls.')
  const roll = rollDice(expr, rollDie, label)
  if (!roll) throw new OpError(`"${expr}" is not a dice roll I understand. Try 1d20+5 or 2d6.`)
  const m = await insertMessage({
    campaignId: room.id, participantId: p.id, authorName: p.name, authorColor: p.color, authorRole: p.role,
    kind: 'roll', text: '', roll, dmOnly: isPrivate,
  })
  notifyMessages(room, [m])
  return roll
}

async function mutate(room: Room, fn: Parameters<typeof mutateCampaign>[1]) {
  const row = await mutateCampaign(room.id, fn)
  if (row) applyLocalChange(room, row)
  return row
}

function rateLimit(list: number[], max: number, windowMs: number): boolean {
  const now = Date.now()
  while (list.length && now - list[0] > windowMs) list.shift()
  if (list.length >= max) return false
  list.push(now)
  return true
}

export async function handleOp(room: Room, c: Client, op: ClientOp): Promise<void> {
  if (!op || typeof op !== 'object' || typeof op.type !== 'string') throw new OpError('Malformed request.')

  // Ephemeral, high-frequency operations: no database writes.
  if (op.type === 'token.drag') {
    if (!rateLimit(c.rate.drags, 30, 1000)) return
    const board = room.row.board
    const { scene, token } = findToken(board, String(op.tokenId))
    canPlayerMoveToken(room, c, board, token)
    const x = clampInt(op.x * 100, 0, scene.cols * 100) / 100
    const y = clampInt(op.y * 100, 0, scene.rows * 100) / 100
    broadcastDrag(room, scene.id, token.id, x, y, c.id)
    return
  }
  if (op.type === 'ping') {
    if (!rateLimit(c.rate.pings, 4, 2000)) return
    const p = me(room, c)
    const board = room.row.board
    const sceneId = c.role === 'dm' ? editingScene(board, c).id : board.activeSceneId
    const scene = findScene(board, sceneId)
    const x = clampInt(op.x * 100, 0, scene.cols * 100) / 100
    const y = clampInt(op.y * 100, 0, scene.rows * 100) / 100
    broadcastPing(room, { sceneId, x, y, color: p.color, name: p.name })
    return
  }
  if (!rateLimit(c.rate.ops, 40, 5000)) throw new OpError('Slow down a little.')

  switch (op.type) {
    // ---------------- tokens ----------------
    case 'token.move': {
      await mutate(room, (board) => {
        const { scene, token } = findToken(board, String(op.tokenId))
        canPlayerMoveToken(room, c, board, token)
        if (c.role !== 'dm' && scene.id !== board.activeSceneId) throw new OpError('That token is not on the current scene.')
        const x = clampInt(op.x, 0, scene.cols - token.size)
        const y = clampInt(op.y, 0, scene.rows - token.size)
        if (x === token.x && y === token.y) throw new NoChange()
        token.x = x
        token.y = y
      })
      return
    }
    case 'token.update': {
      await mutate(room, (board) => {
        const { token } = findToken(board, String(op.tokenId))
        const patch = op.patch ?? {}
        const isDm = c.role === 'dm'
        if (!isDm && !controlsToken(board, token, c.participantId)) throw new OpError('You can only edit your own token.')
        if (patch.hp !== undefined) token.hp = clampInt(patch.hp, -999, 9999)
        if (patch.conditions !== undefined) token.conditions = cleanConditions(patch.conditions)
        if (!isDm) return
        if (patch.name !== undefined) token.name = cleanText(patch.name, 40, token.name) || token.name
        if (patch.maxHp !== undefined) token.maxHp = clampInt(patch.maxHp, 0, 9999)
        if (patch.ac !== undefined) token.ac = clampInt(patch.ac, 0, 40)
        if (patch.hidden !== undefined) token.hidden = !!patch.hidden
        if (patch.size !== undefined) token.size = clampInt(patch.size, 1, 4)
        if (patch.color !== undefined) token.color = cleanColor(patch.color, token.color)
        if (patch.icon !== undefined) token.icon = cleanIcon(patch.icon, token.icon)
        if (patch.dmNotes !== undefined) token.dmNotes = cleanText(patch.dmNotes, 2000)
        if (patch.kind !== undefined && token.kind !== 'pc') token.kind = cleanKind(patch.kind, token.kind)
        if (patch.ownerId !== undefined) {
          const owner = patch.ownerId ? room.participants.find((p) => p.id === patch.ownerId && !p.removed && p.role === 'player') : null
          token.ownerId = owner ? owner.id : null
        }
        for (const e of board.initiative.entries) if (e.tokenId === token.id) e.name = token.name
      })
      return
    }
    case 'token.add': {
      requireDm(c)
      await mutate(room, (board) => {
        const scene = editingScene(board, c)
        const list = Array.isArray(op.tokens) ? op.tokens.slice(0, 20) : []
        if (scene.tokens.length + list.length > MAX_TOKENS) throw new OpError('This scene has too many tokens.')
        for (const t of list) {
          const size = clampInt(t.size, 1, 4, 1)
          const maxHp = clampInt(t.maxHp ?? t.hp, 0, 9999, 10)
          scene.tokens.push(
            makeToken({
              name: cleanText(t.name, 40, 'Monster') || 'Monster',
              kind: cleanKind(t.kind, 'monster') === 'pc' ? 'npc' : cleanKind(t.kind, 'monster'),
              x: clampInt(t.x, 0, scene.cols - size, 0),
              y: clampInt(t.y, 0, scene.rows - size, 0),
              size,
              color: cleanColor(t.color, '#b4443a'),
              icon: cleanIcon(t.icon, 'skull'),
              hp: clampInt(t.hp ?? maxHp, -999, 9999, maxHp),
              maxHp,
              ac: clampInt(t.ac, 0, 40, 12),
              hidden: !!t.hidden,
              dmNotes: cleanText(t.dmNotes, 2000),
            }),
          )
        }
      })
      return
    }
    case 'token.remove': {
      requireDm(c)
      await mutate(room, (board) => {
        const { scene, token } = findToken(board, String(op.tokenId))
        scene.tokens = scene.tokens.filter((t) => t.id !== token.id)
        removeInitiative(board, (e) => e.tokenId === token.id)
      })
      return
    }

    // ---------------- characters ----------------
    case 'character.update': {
      await mutate(room, (board) => {
        const ch = board.characters.find((x) => x.id === op.characterId)
        if (!ch) throw new OpError('Character not found.')
        const isDm = c.role === 'dm'
        if (!isDm && ch.ownerId !== c.participantId) throw new OpError('You can only edit your own character.')
        const p = op.patch ?? {}
        if (p.hp !== undefined) ch.hp = clampInt(p.hp, -999, 9999)
        if (p.tempHp !== undefined) ch.tempHp = clampInt(p.tempHp, 0, 999)
        if (p.conditions !== undefined) ch.conditions = cleanConditions(p.conditions)
        if (p.sheet !== undefined) ch.sheet = cleanText(p.sheet, 4000)
        if (!isDm) return
        if (p.name !== undefined) ch.name = cleanText(p.name, 40, ch.name) || ch.name
        if (p.summary !== undefined) ch.summary = cleanText(p.summary, 80)
        if (p.maxHp !== undefined) ch.maxHp = clampInt(p.maxHp, 0, 9999)
        if (p.ac !== undefined) ch.ac = clampInt(p.ac, 0, 40)
        if (p.speed !== undefined) ch.speed = clampInt(p.speed, 0, 200)
        if (p.initiativeBonus !== undefined) ch.initiativeBonus = clampInt(p.initiativeBonus, -10, 20)
        if (p.dmNotes !== undefined) ch.dmNotes = cleanText(p.dmNotes, 4000)
        if (p.color !== undefined) ch.color = cleanColor(p.color, ch.color)
        if (p.icon !== undefined) ch.icon = cleanIcon(p.icon, ch.icon)
        if (p.ownerId !== undefined) {
          const owner = p.ownerId ? room.participants.find((x) => x.id === p.ownerId && !x.removed && x.role === 'player') : null
          ch.ownerId = owner ? owner.id : null
        }
        syncCharacterTokens(board, ch)
      })
      return
    }
    case 'character.add': {
      requireDm(c)
      await mutate(room, (board) => {
        if (board.characters.length >= MAX_CHARACTERS) throw new OpError('That is a big party! Remove a character first.')
        const src = op.character ?? {}
        const maxHp = clampInt(src.maxHp, 1, 9999, 10)
        const ch = makeCharacter({
          name: cleanText(src.name, 40, 'New hero') || 'New hero',
          summary: cleanText(src.summary, 80),
          maxHp,
          hp: maxHp,
          ac: clampInt(src.ac, 0, 40, 12),
          speed: clampInt(src.speed, 0, 200, 30),
          initiativeBonus: clampInt(src.initiativeBonus, -10, 20, 0),
          color: cleanColor(src.color, '#d9822b'),
          icon: cleanIcon(src.icon, 'sword'),
          sheet: cleanText(src.sheet, 4000),
        })
        board.characters.push(ch)
        if (op.place !== false) {
          const scene = editingScene(board, c)
          scene.tokens.push(makeToken({ name: ch.name.split(' ')[0], kind: 'pc', characterId: ch.id, x: Math.floor(scene.cols / 2), y: Math.floor(scene.rows / 2), color: ch.color, icon: ch.icon }))
        }
      })
      return
    }
    case 'character.remove': {
      requireDm(c)
      await mutate(room, (board) => {
        const ch = board.characters.find((x) => x.id === op.characterId)
        if (!ch) throw new OpError('Character not found.')
        board.characters = board.characters.filter((x) => x.id !== ch.id)
        const removedTokens = new Set<string>()
        for (const s of board.scenes) {
          s.tokens = s.tokens.filter((t) => {
            if (t.characterId === ch.id) removedTokens.add(t.id)
            return t.characterId !== ch.id
          })
        }
        removeInitiative(board, (e) => e.characterId === ch.id || (!!e.tokenId && removedTokens.has(e.tokenId)))
      })
      return
    }
    case 'character.claim': {
      await mutate(room, (board) => {
        const ch = board.characters.find((x) => x.id === op.characterId)
        if (!ch) throw new OpError('Character not found.')
        if (c.role === 'dm') throw new OpError('Assign characters to players from the Party tab.')
        if (ch.ownerId && ch.ownerId !== c.participantId) throw new OpError('Someone else is already playing that character.')
        if (board.characters.some((x) => x.ownerId === c.participantId && x.id !== ch.id)) throw new OpError('You already have a character. Release it first.')
        if (ch.ownerId === c.participantId) throw new NoChange()
        ch.ownerId = c.participantId
      })
      return
    }
    case 'character.release': {
      await mutate(room, (board) => {
        const ch = board.characters.find((x) => x.id === op.characterId)
        if (!ch) throw new OpError('Character not found.')
        if (c.role !== 'dm' && ch.ownerId !== c.participantId) throw new OpError('That is not your character.')
        ch.ownerId = null
      })
      return
    }

    // ---------------- fog of war ----------------
    case 'fog.paint': {
      requireDm(c)
      await mutate(room, (board) => {
        const scene = findScene(board, String(op.sceneId))
        if (!scene.fogEnabled) throw new NoChange()
        const cells = Array.isArray(op.cells) ? op.cells.slice(0, scene.cols * scene.rows) : []
        const arr = scene.revealed.split('')
        let changed = false
        let hid = false
        for (const raw of cells) {
          const i = Math.floor(Number(raw))
          if (!Number.isInteger(i) || i < 0 || i >= arr.length) continue
          const v = op.reveal ? '1' : '0'
          if (arr[i] !== v) {
            changed = true
            if (!op.reveal) hid = true
            arr[i] = v
          }
        }
        if (!changed) throw new NoChange()
        scene.revealed = arr.join('')
        scene.fogRev += 1
        if (hid) scene.hideRev = scene.fogRev
      })
      return
    }
    case 'fog.all': {
      requireDm(c)
      await mutate(room, (board) => {
        const scene = findScene(board, String(op.sceneId))
        scene.revealed = emptyFog(scene.cols, scene.rows, !!op.reveal)
        scene.fogRev += 1
        if (!op.reveal) scene.hideRev = scene.fogRev
      })
      return
    }
    case 'fog.enable': {
      requireDm(c)
      await mutate(room, (board) => {
        const scene = findScene(board, String(op.sceneId))
        if (scene.fogEnabled === !!op.enabled) throw new NoChange()
        scene.fogEnabled = !!op.enabled
        scene.fogRev += 1
        if (scene.fogEnabled) scene.hideRev = scene.fogRev
      })
      return
    }

    // ---------------- scenes ----------------
    case 'scene.add': {
      requireDm(c)
      let newId = ''
      await mutate(room, (board) => {
        if (board.scenes.length >= MAX_SCENES) throw new OpError('You have reached the scene limit.')
        const s = blankScene(cleanText(op.name, 60, 'New scene') || 'New scene', clampInt(op.cols, 4, 60, 24), clampInt(op.rows, 4, 60, 18))
        board.scenes.push(s)
        newId = s.id
      })
      c.viewSceneId = newId
      pushState(room)
      return
    }
    case 'scene.update': {
      requireDm(c)
      await mutate(room, (board) => {
        const scene = findScene(board, String(op.sceneId))
        const p = op.patch ?? {}
        if (p.name !== undefined) scene.name = cleanText(p.name, 60, scene.name) || scene.name
        const cols = p.cols !== undefined ? clampInt(p.cols, 4, 80, scene.cols) : scene.cols
        const rows = p.rows !== undefined ? clampInt(p.rows, 4, 80, scene.rows) : scene.rows
        if (cols !== scene.cols || rows !== scene.rows) resizeFog(scene, cols, rows)
      })
      return
    }
    case 'scene.activate': {
      requireDm(c)
      await mutate(room, (board) => {
        const scene = findScene(board, String(op.sceneId))
        if (board.activeSceneId === scene.id) throw new NoChange()
        board.activeSceneId = scene.id
      })
      c.viewSceneId = null
      pushState(room)
      return
    }
    case 'scene.edit': {
      requireDm(c)
      findScene(room.row.board, String(op.sceneId))
      c.viewSceneId = op.sceneId === room.row.board.activeSceneId ? null : op.sceneId
      pushState(room)
      return
    }
    case 'scene.remove': {
      requireDm(c)
      await mutate(room, (board) => {
        const scene = findScene(board, String(op.sceneId))
        if (board.activeSceneId === scene.id) throw new OpError('Switch players to another scene before deleting this one.')
        board.scenes = board.scenes.filter((s) => s.id !== scene.id)
        const ids = new Set(scene.tokens.map((t) => t.id))
        removeInitiative(board, (e) => !!e.tokenId && ids.has(e.tokenId))
      })
      if (c.viewSceneId === op.sceneId) c.viewSceneId = null
      pushState(room)
      return
    }

    // ---------------- initiative ----------------
    case 'initiative.add': {
      requireDm(c)
      await mutate(room, (board) => {
        const scene = editingScene(board, c)
        const existing = new Set(board.initiative.entries.map((e) => e.tokenId).filter(Boolean))
        const add = (e: Omit<InitiativeEntry, 'id'>) => board.initiative.entries.push({ id: shortId(), ...e })
        const tokenIds = Array.isArray(op.tokenIds) ? op.tokenIds : []
        for (const t of scene.tokens) {
          if (!tokenIds.includes(t.id) || existing.has(t.id)) continue
          const ch = t.characterId ? board.characters.find((x) => x.id === t.characterId) : null
          const bonus = ch ? ch.initiativeBonus : 0
          add({ name: ch ? ch.name : t.name, value: t.kind === 'pc' ? 0 : rollDie(20) + bonus, tokenId: t.id, characterId: t.characterId ?? null, kind: t.kind })
        }
        if (op.name) add({ name: cleanText(op.name, 40, 'Combatant'), value: clampInt(op.value, -10, 99, 10), tokenId: null, characterId: null, kind: 'npc' })
        if (board.initiative.entries.length > 60) throw new OpError('Too many combatants.')
        sortInitiative(board)
      })
      return
    }
    case 'initiative.set': {
      await mutate(room, (board) => {
        const e = board.initiative.entries.find((x) => x.id === op.entryId)
        if (!e) throw new OpError('Not in initiative.')
        if (c.role !== 'dm') {
          const ch = e.characterId ? board.characters.find((x) => x.id === e.characterId) : null
          if (!ch || ch.ownerId !== c.participantId) throw new OpError('You can only set your own initiative.')
        }
        e.value = clampInt(op.value, -10, 99, 0)
        sortInitiative(board)
      })
      return
    }
    case 'initiative.remove': {
      requireDm(c)
      await mutate(room, (board) => removeInitiative(board, (e) => e.id === op.entryId))
      return
    }
    case 'initiative.rollMonsters': {
      requireDm(c)
      await mutate(room, (board) => {
        let any = false
        for (const e of board.initiative.entries) {
          if (e.kind === 'pc') continue
          e.value = rollDie(20)
          any = true
        }
        if (!any) throw new NoChange()
        sortInitiative(board)
      })
      return
    }
    case 'initiative.next':
    case 'initiative.prev': {
      requireDm(c)
      let newRound = 0
      await mutate(room, (board) => {
        const ini = board.initiative
        if (ini.entries.length === 0) throw new OpError('Add combatants to initiative first.')
        if (op.type === 'initiative.next') {
          if (ini.round === 0) {
            ini.round = 1
            ini.turn = 0
            newRound = 1
          } else if (ini.turn + 1 >= ini.entries.length) {
            ini.turn = 0
            ini.round += 1
            newRound = ini.round
          } else ini.turn += 1
        } else {
          if (ini.round === 0) throw new NoChange()
          if (ini.turn === 0) {
            if (ini.round > 1) {
              ini.round -= 1
              ini.turn = ini.entries.length - 1
            }
          } else ini.turn -= 1
        }
      })
      if (newRound) await systemMessage(room, newRound === 1 ? 'Combat begins! Round 1.' : `Round ${newRound} begins.`)
      return
    }
    case 'initiative.clear': {
      requireDm(c)
      await mutate(room, (board) => {
        if (board.initiative.entries.length === 0) throw new NoChange()
        board.initiative = { round: 0, turn: 0, entries: [] }
      })
      await systemMessage(room, 'Combat is over.')
      return
    }

    // ---------------- chat & dice ----------------
    case 'chat.send': {
      const p = me(room, c)
      if (!p.canChat) throw new OpError('The DM has muted chat for you.')
      const text = cleanText(op.text, 1000).trim()
      if (!text) return
      const cmd = text.match(/^\/(r|roll|pr|dmroll|gmroll|proll)\s+(.+)$/i)
      if (cmd) {
        const isPrivate = /^(pr|dmroll|gmroll|proll)$/i.test(cmd[1])
        const [expr, ...labelParts] = cmd[2].split(/\s+#\s*|\s+for\s+/i)
        await postRoll(room, c, expr.trim(), labelParts.join(' ').trim() || undefined, isPrivate)
        return
      }
      if (text.startsWith('/')) throw new OpError('Unknown command. Try /roll 1d20+3 or /pr 1d20 (DM only, private).')
      const m = await insertMessage({ campaignId: room.id, participantId: p.id, authorName: p.name, authorColor: p.color, authorRole: p.role, kind: 'chat', text })
      notifyMessages(room, [m])
      return
    }
    case 'dice.roll': {
      await postRoll(room, c, cleanText(op.expr, 80), cleanText(op.label, 60) || undefined, !!op.private)
      return
    }

    // ---------------- DM notes ----------------
    case 'notes.update': {
      requireDm(c)
      await mutate(room, (board) => {
        const text = cleanText(op.text, 20000)
        if (board.sessionNotes === text) throw new NoChange()
        board.sessionNotes = text
      })
      return
    }

    // ---------------- sessions ----------------
    case 'session.start': {
      requireDm(c)
      let number = 0
      await mutate(room, (_board, row) => {
        if (row.status === 'live') throw new NoChange()
        number = row.sessionNumber + 1
        return { status: 'live', sessionNumber: number }
      })
      if (number) {
        await startSessionRow(room.id, number)
        await systemMessage(room, `Session ${number} has started. Good luck, adventurers!`)
      }
      return
    }
    case 'session.resume': {
      requireDm(c)
      let number = 0
      await mutate(room, (_board, row) => {
        if (row.status === 'live') throw new NoChange()
        if (row.sessionNumber === 0) throw new OpError('There is no earlier session to resume. Start one instead.')
        number = row.sessionNumber
        return { status: 'live' }
      })
      if (number) {
        await resumeSessionRow(room.id, number)
        await systemMessage(room, `Session ${number} resumed.`)
      }
      return
    }
    case 'session.end': {
      requireDm(c)
      let number = 0
      await mutate(room, (_board, row) => {
        if (row.status !== 'live') throw new NoChange()
        number = row.sessionNumber
        return { status: 'ended' }
      })
      if (number) {
        await endSessionRow(room.id, number)
        await systemMessage(room, `Session ${number} has ended. Everything is saved for next time.`)
      }
      return
    }

    // ---------------- participants ----------------
    case 'participant.update': {
      requireDm(c)
      const target = room.participants.find((p) => p.id === op.participantId && p.role === 'player')
      if (!target) throw new OpError('Player not found.')
      const patch: { canMove?: boolean; canChat?: boolean } = {}
      if (op.patch?.canMove !== undefined) patch.canMove = !!op.patch.canMove
      if (op.patch?.canChat !== undefined) patch.canChat = !!op.patch.canChat
      await updateParticipant(target.id, patch)
      const row = await bumpVersion(room.id)
      applyLocalChange(room, row, { participants: await loadParticipants(room.id) })
      return
    }
    case 'participant.remove': {
      requireDm(c)
      const target = room.participants.find((p) => p.id === op.participantId && p.role === 'player')
      if (!target) throw new OpError('Player not found.')
      await updateParticipant(target.id, { removed: true, online: false })
      const row = await mutateCampaign(room.id, (board) => {
        for (const ch of board.characters) if (ch.ownerId === target.id) ch.ownerId = null
        for (const s of board.scenes) for (const t of s.tokens) if (t.ownerId === target.id) t.ownerId = null
      })
      applyLocalChange(room, row, { participants: await loadParticipants(room.id) })
      await systemMessage(room, `${target.name} was removed from the table.`)
      return
    }
    case 'invite.regenerate': {
      requireDm(c)
      await mutate(room, () => ({ inviteCode: shortId(8) }))
      return
    }
    case 'campaign.rename': {
      requireDm(c)
      const name = cleanText(op.name, 80).trim()
      if (!name) throw new OpError('Give the campaign a name.')
      await mutate(room, () => ({ name }))
      return
    }
    case 'me.update': {
      const p = me(room, c)
      const patch: { name?: string; avatar?: string; color?: string } = {}
      if (op.name !== undefined) patch.name = cleanText(op.name, 32, p.name).trim() || p.name
      if (op.avatar !== undefined) patch.avatar = cleanIcon(op.avatar, p.avatar)
      if (op.color !== undefined) patch.color = cleanColor(op.color, p.color)
      await updateParticipant(p.id, patch)
      const row = await bumpVersion(room.id)
      applyLocalChange(room, row, { participants: await loadParticipants(room.id) })
      return
    }

    // ---------------- save points ----------------
    case 'snapshot.save': {
      requireDm(c)
      const label = cleanText(op.label, 80).trim() || `Save point ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`
      await saveSnapshot(room.id, label, room.row.board)
      await systemMessage(room, `Saved "${label}".`, true)
      return
    }
    case 'snapshot.restore': {
      requireDm(c)
      const snap = await getSnapshot(room.id, clampInt(op.snapshotId, 0, 2 ** 31 - 1))
      if (!snap) throw new OpError('Save point not found.')
      await mutate(room, (board) => {
        const restored = snap.board
        for (const s of restored.scenes) {
          const current = board.scenes.find((x) => x.id === s.id)
          // Keep current map images; force the masked player map to be re-rendered.
          if (current) s.bg = current.bg
          else if (s.bg.kind === 'image') s.bg = { kind: 'blank' }
          s.fogRev = Math.max(s.fogRev, current?.fogRev ?? 0) + 1
          s.hideRev = s.fogRev
          s.playerMapRev = current ? current.playerMapRev : -1
        }
        // Players keep the characters they currently control.
        for (const ch of restored.characters) {
          const cur = board.characters.find((x) => x.id === ch.id)
          ch.ownerId = cur ? cur.ownerId : null
        }
        Object.assign(board, restored)
      })
      await systemMessage(room, `The DM restored the save point "${snap.label}".`)
      return
    }

    case 'initiative.rollSelf': {
      const board = room.row.board
      const e = board.initiative.entries.find((x) => x.id === op.entryId)
      if (!e || !e.characterId) throw new OpError('Not in initiative.')
      const ch = board.characters.find((x) => x.id === e.characterId)
      if (!ch || (c.role !== 'dm' && ch.ownerId !== c.participantId)) throw new OpError('You can only roll your own initiative.')
      const bonus = ch.initiativeBonus
      const roll = await postRoll(room, c, `1d20${bonus >= 0 ? '+' : ''}${bonus}`, `Initiative (${ch.name})`, false)
      await mutate(room, (b) => {
        const entry = b.initiative.entries.find((x) => x.id === e.id)
        if (!entry) throw new NoChange()
        entry.value = roll.total
        sortInitiative(b)
      })
      return
    }
    default:
      throw new OpError('Unknown action.')
  }
}

function removeInitiative(board: Board, pred: (e: InitiativeEntry) => boolean) {
  const ini = board.initiative
  const current = ini.entries[ini.turn]?.id
  ini.entries = ini.entries.filter((e) => !pred(e))
  const idx = current ? ini.entries.findIndex((e) => e.id === current) : -1
  ini.turn = idx >= 0 ? idx : Math.min(ini.turn, Math.max(0, ini.entries.length - 1))
  if (ini.entries.length === 0) {
    ini.round = 0
    ini.turn = 0
  }
}

function syncCharacterTokens(board: Board, ch: Character) {
  for (const s of board.scenes)
    for (const t of s.tokens)
      if (t.characterId === ch.id) {
        t.color = ch.color
        t.icon = ch.icon
      }
  for (const e of board.initiative.entries) if (e.characterId === ch.id) e.name = ch.name
}

export { send }
