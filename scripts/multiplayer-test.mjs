// Multiplayer integration test: runs a DM and several player clients against a running
// server and checks sync, permissions, hidden-information filtering, dice, reconnects and kicks.
// Usage: BASE=http://localhost:8889 node scripts/multiplayer-test.mjs
const BASE = process.env.BASE || 'http://localhost:8889'
const WS = BASE.replace(/^http/, 'ws') + '/ws'
let failures = 0
const ok = (cond, label) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const api = async (path, opts = {}) => { const r = await fetch(BASE + path, { ...opts, headers: { 'content-type': 'application/json', ...(opts.headers || {}) } }); return { status: r.status, body: await r.json().catch(() => null) } }

function connect(campaignId, token, name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS)
    const c = { ws, name, state: null, welcome: null, messages: [], pings: [], drags: [], errors: [], acks: new Map(), kicked: false, reqId: 0 }
    c.op = (op) => new Promise((res) => { const id = ++c.reqId; c.acks.set(id, res); ws.send(JSON.stringify({ type: 'op', reqId: id, op })) })
    ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', campaignId, token }))
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.type === 'welcome') { c.welcome = m; c.state = m; c.messages = [...m.messages]; resolve(c) }
      else if (m.type === 'state') c.state = m
      else if (m.type === 'messages') c.messages.push(...m.messages)
      else if (m.type === 'ping') c.pings.push(m.ping)
      else if (m.type === 'drag') c.drags.push(m)
      else if (m.type === 'ack') { const f = c.acks.get(m.reqId); c.acks.delete(m.reqId); f && f(m) }
      else if (m.type === 'kicked') { c.kicked = true; resolve(c) }
      else if (m.type === 'error') { c.errors.push(m.message); if (m.fatal) resolve(c) }
    }
    ws.onerror = (e) => reject(new Error('ws error ' + name))
    setTimeout(() => reject(new Error('timeout ' + name)), 10000)
  })
}
const tokensOf = (c) => c.state.board.scene.tokens
const raw = (c) => JSON.stringify(c.state)

// ---- setup
const created = await api('/api/campaigns', { method: 'POST', body: JSON.stringify({ demo: true, dmName: 'Morgan' }) })
ok(created.status === 201, 'DM creates demo campaign')
const { campaignId, token: dmToken } = created.body
const dm = await connect(campaignId, dmToken, 'dm')
ok(dm.welcome.you.role === 'dm', 'DM welcomed with dm role')
const code = dm.state.campaign.inviteCode
ok(!!code, 'DM sees invite code')
ok(tokensOf(dm).length === 10, `DM sees all 10 tokens (got ${tokensOf(dm).length})`)
ok(!!dm.state.board.guide && dm.state.board.scenes.length === 2, 'DM sees guide and scene list')
ok(dm.state.board.scene.mapUrl?.includes('/full/'), 'DM gets full map url')

const info = await api('/api/invite/' + code)
ok(info.status === 200 && info.body.characters.length === 4, 'invite info lists 4 characters')
ok(!raw({state: info.body}).includes('dmNotes') && !JSON.stringify(info.body).includes('Owes a debt'), 'invite info has no DM notes')
const pip = info.body.characters.find((c) => c.name.startsWith('Pip'))
const joined = await api(`/api/invite/${code}/join`, { method: 'POST', body: JSON.stringify({ name: 'Alex', avatar: 'feather', characterId: pip.id }) })
ok(joined.status === 201, 'player joins via invite and claims Pip')
const bad = await api(`/api/invite/nope/join`, { method: 'POST', body: JSON.stringify({ name: 'x' }) })
ok(bad.status === 404, 'invalid invite rejected')

const p1 = await connect(campaignId, joined.body.token, 'p1')
ok(p1.welcome.you.role === 'player', 'player welcomed with player role')
await sleep(300)
ok(dm.state.participants.find((p) => p.name === 'Alex')?.online === true, 'DM sees player online (presence)')

// ---- hidden information
const pr = JSON.stringify(p1.state.board) + JSON.stringify(p1.state.campaign)
ok(tokensOf(p1).every((t) => t.kind === 'pc'), `player sees only PC tokens under fog (got ${tokensOf(p1).map((t) => t.name).join(',')})`)
ok(!pr.includes('Goblin') && !pr.includes('Skeleton') && !pr.includes('Grisk'), 'no monster names leak to player')
ok(!pr.includes('dmNotes') && !pr.includes('Owes a debt') && !pr.includes('sessionNotes'), 'no DM notes leak to player')
ok(!pr.includes('guide') && !pr.includes('readAloud') && p1.state.board.scenes === undefined, 'no guide or scene list for player')
ok(!pr.includes('Crypt'), 'other scene names hidden from player')
ok(p1.state.board.scene.mapUrl === null && p1.state.board.scene.mapPending === true, 'player has no map url until DM renders masked map')
ok(p1.state.campaign.inviteCode === undefined, 'player does not get invite code')

// ---- permissions before session start
const myTok = tokensOf(p1).find((t) => t.name === 'Pip')
let r = await p1.op({ type: 'token.move', tokenId: myTok.id, x: 12, y: 15 })
ok(!r.ok, 'player cannot move before session starts: ' + r.error)
r = await dm.op({ type: 'session.start' })
ok(r.ok, 'DM starts session')
await sleep(200)
ok(p1.state.campaign.status === 'live', 'player sees live status')
r = await p1.op({ type: 'token.move', tokenId: myTok.id, x: 12, y: 15 })
ok(r.ok, 'player moves own token')
await sleep(200)
ok(tokensOf(dm).find((t) => t.id === myTok.id)?.y === 15, 'DM sees moved token')
const brenna = tokensOf(p1).find((t) => t.name === 'Brenna')
r = await p1.op({ type: 'token.move', tokenId: brenna.id, x: 5, y: 16 })
ok(!r.ok, 'player cannot move another PC: ' + r.error)
const sentryId = tokensOf(dm).find((t) => t.name === 'Goblin Sentry').id
r = await p1.op({ type: 'token.move', tokenId: sentryId, x: 1, y: 1 })
ok(!r.ok, 'player cannot move a monster')
for (const op of [{ type: 'fog.all', sceneId: dm.state.board.scene.id, reveal: true }, { type: 'token.update', tokenId: sentryId, patch: { hidden: false } }, { type: 'notes.update', text: 'hack' }, { type: 'scene.activate', sceneId: dm.state.board.scenes[1].id }, { type: 'initiative.next' }, { type: 'participant.remove', participantId: dm.welcome.you.participantId }]) {
  r = await p1.op(op)
  ok(!r.ok, `player blocked from ${op.type}`)
}
r = await p1.op({ type: 'dice.roll', expr: '1d20', private: true })
ok(!r.ok, 'player cannot make private rolls')

// ---- chat & dice
await p1.op({ type: 'chat.send', text: 'Hello from Alex!' })
await dm.op({ type: 'chat.send', text: '/roll 2d6+3 # damage' })
await dm.op({ type: 'chat.send', text: '/pr 1d20+4 # secret perception' })
await p1.op({ type: 'dice.roll', expr: '1d20+5 adv', label: 'Stealth' })
await sleep(400)
ok(dm.messages.some((m) => m.text === 'Hello from Alex!'), 'DM receives player chat')
const dmg = p1.messages.find((m) => m.roll?.label === 'damage')
ok(!!dmg && dmg.roll.total >= 5 && dmg.roll.total <= 15, 'player sees DM public roll with valid total')
ok(dm.messages.some((m) => m.private && m.roll?.label === 'secret perception'), 'DM sees own private roll')
ok(!p1.messages.some((m) => m.private || m.roll?.label === 'secret perception'), 'player never receives DM private roll')
const adv = dm.messages.find((m) => m.roll?.label === 'Stealth')
ok(!!adv && adv.roll.terms[0].rolls.length === 2 && adv.roll.terms[0].rolls.filter((x) => x.kept).length === 1, 'advantage roll keeps highest of 2d20')
r = await p1.op({ type: 'dice.roll', expr: '1d20+banana' })
ok(!r.ok, 'invalid dice notation rejected')

// ---- fog reveal exposes the sentry, but not its stats
const scene = dm.state.board.scene
const cell = (x, y) => y * scene.cols + x
r = await dm.op({ type: 'fog.paint', sceneId: scene.id, reveal: true, cells: [cell(10, 13), cell(11, 13), cell(11, 14), cell(12, 14)] })
ok(r.ok, 'DM reveals fog around gate')
await sleep(300)
const seen = tokensOf(p1).find((t) => t.name === 'Goblin Sentry')
ok(!!seen, 'player now sees revealed sentry')
ok(seen && seen.hp === null && seen.ac === null && seen.dmNotes === undefined && seen.health === 4, 'monster exact HP/AC/notes withheld from player')
ok(!raw(p1).includes('Goblin Cook'), 'still-fogged monsters stay hidden')

// ---- masked player map
const fogRev = dm.state.board.scene.fogRev
const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c40000000049454e44ae426082', 'hex')
let up = await fetch(`${BASE}/api/campaigns/${campaignId}/scenes/${scene.id}/player-map?fogRev=${fogRev}`, { method: 'POST', headers: { authorization: 'Bearer ' + joined.body.token }, body: png })
ok(up.status === 403, 'player cannot upload player map')
up = await fetch(`${BASE}/api/campaigns/${campaignId}/scenes/${scene.id}/player-map?fogRev=${fogRev}`, { method: 'POST', headers: { authorization: 'Bearer ' + dmToken }, body: png })
ok(up.status === 200, 'DM uploads masked player map')
await sleep(300)
const purl = p1.state.board.scene.mapUrl
ok(!!purl && purl.includes('/player/'), 'player receives masked map url')
ok((await fetch(BASE + purl)).status === 200, 'player can load masked map')
const forged = purl.replace('/player/', '/full/')
ok((await fetch(BASE + forged)).status === 403, 'forged full-map url rejected')
const dmUrl = dm.state.board.scene.mapUrl
ok((await fetch(BASE + dmUrl.replace('r=d', 'r=p'))).status === 403, 'tampered role in map url rejected')
await dm.op({ type: 'fog.paint', sceneId: scene.id, reveal: false, cells: [cell(10, 13)] })
await sleep(300)
ok(p1.state.board.scene.mapUrl === null && p1.state.board.scene.mapPending, 'hiding fog withdraws stale masked map from players')
ok((await fetch(BASE + purl)).status === 404, 'stale masked map no longer served')
ok(!tokensOf(p1).some((t) => t.name === 'Goblin Sentry'), 'sentry disappears for player when re-fogged')

// ---- initiative with hidden monsters
await dm.op({ type: 'initiative.add', tokenIds: tokensOf(dm).map((t) => t.id) })
await sleep(300)
ok(dm.state.board.initiative.entries.length === 10, 'DM initiative has all 10 combatants')
ok(p1.state.board.initiative.entries.every((e) => e.kind === 'pc'), 'player initiative omits unseen monsters')
const mine = p1.state.board.initiative.entries.find((e) => e.name.startsWith('Pip'))
r = await p1.op({ type: 'initiative.rollSelf', entryId: mine.id })
ok(r.ok, 'player rolls own initiative')
r = await p1.op({ type: 'initiative.rollSelf', entryId: p1.state.board.initiative.entries.find((e) => e.name.startsWith('Brenna')).id })
ok(!r.ok, "player cannot roll someone else's initiative")
await dm.op({ type: 'initiative.next' })
await sleep(300)
ok(dm.state.board.initiative.round === 1 && !!dm.state.board.initiative.currentId, 'DM starts round 1')
ok(p1.state.board.initiative.currentId !== null || p1.state.board.initiative.hiddenTurn, 'player sees current turn or hidden-turn marker')

// ---- second player + concurrent moves
const joined2 = await api(`/api/invite/${code}/join`, { method: 'POST', body: JSON.stringify({ name: 'Sam', avatar: 'hammer', characterId: info.body.characters.find((c) => c.name.startsWith('Tomas')).id }) })
const p2 = await connect(campaignId, joined2.body.token, 'p2')
const tomas = tokensOf(p2).find((t) => t.name === 'Tomas')
const pipTok = tokensOf(p1).find((t) => t.name === 'Pip')
const moves = []
for (let i = 0; i < 12; i++) {
  moves.push(p1.op({ type: 'token.move', tokenId: pipTok.id, x: 2 + i, y: 16 }))
  moves.push(p2.op({ type: 'token.move', tokenId: tomas.id, x: 2 + i, y: 17 }))
  moves.push(dm.op({ type: 'token.move', tokenId: brenna.id, x: 2 + i, y: 15 }))
}
const results = await Promise.all(moves)
ok(results.every((x) => x.ok), 'all 36 concurrent moves accepted')
await sleep(600)
const pos = (c, id) => { const t = tokensOf(c).find((x) => x.id === id); return t && `${t.x},${t.y}` }
const conv = [dm, p1, p2].map((c) => [pos(c, pipTok.id), pos(c, tomas.id), pos(c, brenna.id)].join(' '))
ok(conv.every((x) => x === '13,16 13,17 13,15'), 'all clients converge on final positions ' + conv.join(' | '))

// ---- drag preview + ping
p2.drags = []; dm.drags = []
p1.op({ type: 'token.drag', tokenId: pipTok.id, x: 9.5, y: 16.2 })
await p1.op({ type: 'ping', x: 4, y: 5 })
await sleep(300)
ok(dm.drags.some((d) => d.tokenId === pipTok.id) && p2.drags.some((d) => d.tokenId === pipTok.id), 'drag preview reaches other clients')
ok(dm.pings.length > 0 && p2.pings.length > 0, 'ping reaches other clients')
const goblinCook = tokensOf(dm).find((t) => t.name === 'Goblin Cook')
dm.op({ type: 'token.drag', tokenId: goblinCook.id, x: 6, y: 9 })
await sleep(300)
ok(!p1.drags.some((d) => d.tokenId === goblinCook.id), 'drag preview of fogged monster not sent to players')

// ---- character edits
const pipChar = p1.state.board.characters.find((c) => c.name.startsWith('Pip'))
r = await p1.op({ type: 'character.update', characterId: pipChar.id, patch: { hp: 4, conditions: ['Prone'], maxHp: 999, ac: 30 } })
await sleep(300)
const pipAfter = dm.state.board.characters.find((c) => c.id === pipChar.id)
ok(pipAfter.hp === 4 && pipAfter.conditions.includes('Prone') && pipAfter.maxHp === 9 && pipAfter.ac === 14, 'player edits own HP/conditions but not max HP/AC')
r = await p1.op({ type: 'character.update', characterId: tomas.characterId, patch: { hp: 1 } })
ok(!r.ok, "player cannot edit someone else's character")
await dm.op({ type: 'character.update', characterId: pipChar.id, patch: { dmNotes: 'TOPSECRET-77', ac: 15 } })
await sleep(300)
ok(!raw(p1).includes('TOPSECRET-77') && raw(dm).includes('TOPSECRET-77'), 'DM character notes stay private')

// ---- reconnect & persistence
const beforeMsgs = p1.messages.length
p1.ws.close()
await sleep(500)
ok(dm.state.participants.find((p) => p.name === 'Alex')?.online === false, 'DM sees player go offline')
const p1b = await connect(campaignId, joined.body.token, 'p1b')
ok(p1b.welcome.you.participantId === joined.body.participantId, 'player reconnects with same identity')
ok(p1b.messages.length >= beforeMsgs - 1 && p1b.messages.some((m) => m.text === 'Hello from Alex!'), 'chat history restored on reconnect')
ok(pos(p1b, pipTok.id) === '13,16', 'token positions restored on reconnect ' + pos(p1b, pipTok.id))
ok(p1b.state.board.characters.find((c) => c.id === pipChar.id).ownerId === joined.body.participantId, 'character ownership persisted')

// everyone leaves -> room unloads -> reload from DB
dm.ws.close(); p1b.ws.close(); p2.ws.close()
await sleep(800)
const dm2 = await connect(campaignId, dmToken, 'dm2')
ok(dm2.state.campaign.status === 'live' && pos(dm2, brenna.id) === '13,15' && dm2.state.board.initiative.entries.length === 10, 'state persisted after all clients left')

// ---- kick
const p2b = await connect(campaignId, joined2.body.token, 'p2b')
r = await dm2.op({ type: 'participant.remove', participantId: joined2.body.participantId })
await sleep(400)
ok(r.ok && p2b.kicked, 'removed player is kicked')
const p2c = await connect(campaignId, joined2.body.token, 'p2c').catch(() => ({ kicked: true }))
ok(p2c.kicked || !p2c.welcome, 'removed player cannot reconnect')
ok(dm2.state.board.characters.find((c) => c.name.startsWith('Tomas')).ownerId === null, "removed player's character released")
const bogus = await connect(campaignId, 'not-a-real-token', 'bogus').catch(() => ({}))
ok(!bogus.welcome, 'unknown token rejected')

dm2.ws.close()
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASSED')
process.exit(failures ? 1 : 0)
