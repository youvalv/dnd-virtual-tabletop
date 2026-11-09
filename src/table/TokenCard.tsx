import { useState } from 'react'
import { Eye, EyeOff, Swords, Trash2, X } from 'lucide-react'
import type { BoardView, CharacterView, ParticipantView, TokenView, YouInfo } from '../../shared/types.ts'
import type { GameClient } from '../lib/game.ts'
import { Avatar } from '../lib/icons.tsx'
import { AutoSaveText, ConditionPicker, HpBar, NumberField, healthLabel } from '../components/ui.tsx'
import { controls } from './MapView.tsx'

export function TokenCard({ token, board, you, isDm, participants, client, onClose, onError }: {
  token: TokenView
  board: BoardView
  you: YouInfo
  isDm: boolean
  participants: ParticipantView[]
  client: GameClient
  onClose: () => void
  onError: (m: string) => void
}) {
  const ch: CharacterView | undefined = token.characterId ? board.characters.find((c) => c.id === token.characterId) : undefined
  const mine = controls(token, you, board.characters)
  const canEdit = isDm || mine
  const [amount, setAmount] = useState('')
  const run = async (p: Promise<{ ok: boolean; error?: string }>) => {
    const r = await p
    if (!r.ok && r.error) onError(r.error)
  }
  const updateStats = (patch: { hp?: number; maxHp?: number; ac?: number; conditions?: string[] }) =>
    ch ? run(client.op({ type: 'character.update', characterId: ch.id, patch })) : run(client.op({ type: 'token.update', tokenId: token.id, patch }))
  const hp = ch ? ch.hp : token.hp
  const maxHp = ch ? ch.maxHp : token.maxHp
  const applyHp = (sign: 1 | -1) => {
    const n = Math.abs(Math.round(Number(amount)))
    if (!n || hp === null || maxHp === null) return
    void updateStats({ hp: sign < 0 ? Math.max(0, hp - n) : Math.min(maxHp, hp + n) })
    setAmount('')
  }
  const inInit = board.initiative.entries.some((e) => e.tokenId === token.id)

  return (
    <div className="token-card" role="dialog" aria-label={`Token: ${token.name}`}>
      <div className="row">
        <Avatar icon={token.icon} color={token.color} size={36} />
        <div className="grow">
          <strong>{ch?.name ?? token.name}</strong>
          <div className="tiny muted">
            {token.kind === 'pc' ? (ch?.summary || 'Player character') : token.kind === 'npc' ? 'NPC' : 'Monster'}
            {token.hidden && isDm ? ' · hidden from players' : ''}
          </div>
        </div>
        <button className="btn ghost icon sm" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>

      <div className="stack tight">
        <div className="row between small">
          <span>{hp !== null ? `${hp} / ${maxHp} HP` : healthLabel(token.health)}</span>
          {token.ac !== null && <span className="pill">AC {token.ac}</span>}
        </div>
        <HpBar hp={hp} max={maxHp} health={token.health} />
        {canEdit && hp !== null && (
          <div className="hp-ctrl">
            <input className="input sm num" inputMode="numeric" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyHp(-1)} aria-label="Amount" />
            <button className="btn sm danger" onClick={() => applyHp(-1)}>Damage</button>
            <button className="btn sm" onClick={() => applyHp(1)}>Heal</button>
          </div>
        )}
      </div>

      {isDm && (
        <div className="inline-stats">
          <label>HP <NumberField value={hp ?? 0} onCommit={(v) => updateStats({ hp: v })} /></label>
          <label>Max <NumberField value={maxHp ?? 0} min={0} onCommit={(v) => updateStats({ maxHp: v })} /></label>
          <label>AC <NumberField value={(ch ? ch.ac : token.ac) ?? 10} min={0} max={40} onCommit={(v) => updateStats({ ac: v })} /></label>
        </div>
      )}

      <div className="stack tight">
        <span className="sub-title" style={{ margin: 0 }}>Conditions</span>
        {canEdit ? (
          <ConditionPicker value={ch ? ch.conditions : token.conditions} onChange={(conditions) => updateStats({ conditions })} compact />
        ) : (
          <div className="row wrap">{token.conditions.length ? token.conditions.map((c) => <span key={c} className="chip">{c}</span>) : <span className="tiny faint">None</span>}</div>
        )}
      </div>

      {isDm && (
        <>
          <div className="row wrap" style={{ gap: '0.3rem' }}>
            <button className="btn sm" onClick={() => run(client.op({ type: 'token.update', tokenId: token.id, patch: { hidden: !token.hidden } }))}>
              {token.hidden ? <><Eye size={14} /> Show to players</> : <><EyeOff size={14} /> Hide from players</>}
            </button>
            {!inInit && (
              <button className="btn sm" onClick={() => run(client.op({ type: 'initiative.add', tokenIds: [token.id] }))}><Swords size={14} /> Add to initiative</button>
            )}
          </div>
          {token.kind !== 'pc' && (
            <>
              <label className="field">
                <span>Name</span>
                <input className="input sm" defaultValue={token.name} key={token.id + token.name} maxLength={40} onBlur={(e) => e.target.value !== token.name && run(client.op({ type: 'token.update', tokenId: token.id, patch: { name: e.target.value } }))} />
              </label>
              <div className="row">
                <label className="field grow">
                  <span>Size</span>
                  <select className="select" value={token.size} onChange={(e) => run(client.op({ type: 'token.update', tokenId: token.id, patch: { size: Number(e.target.value) } }))}>
                    <option value={1}>Medium or smaller (1 square)</option>
                    <option value={2}>Large (2x2)</option>
                    <option value={3}>Huge (3x3)</option>
                    <option value={4}>Gargantuan (4x4)</option>
                  </select>
                </label>
              </div>
              <label className="field">
                <span>Controlled by</span>
                <select className="select" value={token.ownerId ?? ''} onChange={(e) => run(client.op({ type: 'token.update', tokenId: token.id, patch: { ownerId: e.target.value || null } }))}>
                  <option value="">DM only</option>
                  {participants.filter((p) => p.role === 'player').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Private DM notes</span>
                <AutoSaveText value={token.dmNotes ?? ''} onSave={(dmNotes) => run(client.op({ type: 'token.update', tokenId: token.id, patch: { dmNotes } }))} rows={3} maxLength={2000} placeholder="Tactics, stats, loot..." />
              </label>
            </>
          )}
          <button className="btn sm danger" style={{ justifySelf: 'start' }} onClick={() => { if (confirm(`Remove ${token.name} from the map?`)) { void run(client.op({ type: 'token.remove', tokenId: token.id })); onClose() } }}>
            <Trash2 size={14} /> Remove token
          </button>
        </>
      )}
    </div>
  )
}
