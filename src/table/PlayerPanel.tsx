import { useState } from 'react'
import { Dices, Heart, Pencil, Shield, Footprints, Zap } from 'lucide-react'
import type { BoardView, CharacterView, ParticipantView, YouInfo } from '../../shared/types.ts'
import type { GameClient } from '../lib/game.ts'
import { Avatar } from '../lib/icons.tsx'
import { AutoSaveText, ConditionPicker, HpBar, NumberField } from '../components/ui.tsx'
import { ownerName } from './Initiative.tsx'

const ABILITY_NAMES: Record<string, string> = { Str: 'Strength', Dex: 'Dexterity', Con: 'Constitution', Int: 'Intelligence', Wis: 'Wisdom', Cha: 'Charisma' }

interface QuickRoll {
  label: string
  expr: string
  title: string
}

/** Turns lines like "Longsword: +5 to hit, 1d8+3 slashing" into one-click roll buttons. */
export function quickRolls(sheet: string): { abilities: QuickRoll[]; actions: QuickRoll[] } {
  const abilities: QuickRoll[] = []
  const actions: QuickRoll[] = []
  for (const m of sheet.matchAll(/\b(Str|Dex|Con|Int|Wis|Cha)\s+\d+\s*\(([+-]\d+)\)/g)) {
    abilities.push({ label: `${m[1]} ${m[2]}`, expr: `1d20${m[2]}`, title: `${ABILITY_NAMES[m[1]]} check` })
  }
  for (const line of sheet.split('\n')) {
    const name = line.split(/[:(]/)[0].trim()
    if (!name || name.length > 40 || /^(Str|Skills|Plays well)/.test(name)) continue
    const hit = line.match(/([+-]\d+) to hit/)
    if (hit) actions.push({ label: `${name}: attack`, expr: `1d20${hit[1]}`, title: `${name} attack roll` })
    const dice = line.match(/\b(\d+d\d+(?:\s*[+-]\s*\d+)?)\b/)
    if (dice) actions.push({ label: hit ? `${name}: damage` : name, expr: dice[1].replace(/\s+/g, ''), title: hit ? `${name} damage` : name })
  }
  return { abilities, actions: actions.slice(0, 10) }
}

export function CharacterSheet({ ch, client, editable, isDm, onError }: { ch: CharacterView; client: GameClient; editable: boolean; isDm: boolean; onError: (m: string) => void }) {
  const [amount, setAmount] = useState('')
  const [editingSheet, setEditingSheet] = useState(false)
  const update = async (patch: Partial<CharacterView>) => {
    const r = await client.op({ type: 'character.update', characterId: ch.id, patch })
    if (!r.ok && r.error) onError(r.error)
  }
  const roll = async (expr: string, label: string) => {
    const r = await client.op({ type: 'dice.roll', expr, label: `${label} (${ch.name.split(' ')[0]})` })
    if (!r.ok && r.error) onError(r.error)
  }
  const applyHp = (sign: 1 | -1) => {
    const n = Math.abs(Math.round(Number(amount)))
    if (!n) return
    if (sign < 0) {
      // Temporary hit points absorb damage first.
      const fromTemp = Math.min(ch.tempHp, n)
      void update({ tempHp: ch.tempHp - fromTemp, hp: Math.max(0, ch.hp - (n - fromTemp)) })
    } else void update({ hp: Math.min(ch.maxHp, ch.hp + n) })
    setAmount('')
  }
  const { abilities, actions } = quickRolls(ch.sheet)

  return (
    <div className="stack">
      <div className="row">
        <Avatar icon={ch.icon} color={ch.color} size={44} />
        <div className="grow">
          <h3 style={{ margin: 0, fontSize: '1.35rem' }}>{ch.name}</h3>
          <span className="small muted">{ch.summary || 'Adventurer'}</span>
        </div>
      </div>
      <div className="stack tight">
        <div className="row between small">
          <span><Heart size={13} style={{ verticalAlign: '-2px' }} /> Hit points</span>
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
            {ch.hp} / {ch.maxHp}{ch.tempHp > 0 ? <span className="muted"> (+{ch.tempHp} temp)</span> : null}
          </strong>
        </div>
        <HpBar hp={ch.hp} max={ch.maxHp} />
        {editable && (
          <div className="hp-ctrl">
            <input className="input sm num" inputMode="numeric" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" onKeyDown={(e) => e.key === 'Enter' && applyHp(-1)} />
            <button className="btn sm danger" onClick={() => applyHp(-1)} title="Subtract from HP (temp HP first)">Damage</button>
            <button className="btn sm" onClick={() => applyHp(1)} title="Add to HP, up to max">Heal</button>
            <span className="grow" />
            <label className="tiny muted row" style={{ gap: '0.25rem' }}>
              Temp <NumberField value={ch.tempHp} min={0} max={999} onCommit={(v) => update({ tempHp: v })} ariaLabel="Temporary hit points" />
            </label>
          </div>
        )}
        {ch.hp <= 0 && (
          <p className="tiny" style={{ color: '#f3a194', margin: 0 }}>
            At 0 HP you are unconscious. On each of your turns, roll a death saving throw (d20, 10 or higher is a success).
            <button className="btn xs" style={{ marginLeft: '0.4rem' }} onClick={() => roll('1d20', 'Death save')}>Roll death save</button>
          </p>
        )}
      </div>
      <div className="stat-row">
        <div className="stat"><div className="k"><Shield size={11} /> AC</div><div className="v">{ch.ac}</div></div>
        <div className="stat"><div className="k"><Footprints size={11} /> Speed</div><div className="v">{ch.speed}</div></div>
        <div className="stat"><div className="k"><Zap size={11} /> Init</div><div className="v">{ch.initiativeBonus >= 0 ? `+${ch.initiativeBonus}` : ch.initiativeBonus}</div></div>
      </div>
      {(abilities.length > 0 || actions.length > 0) && editable && (
        <div className="stack tight">
          <div className="sub-title" style={{ margin: 0 }}><Dices size={12} style={{ verticalAlign: '-1px' }} /> One-click rolls</div>
          {abilities.length > 0 && (
            <div className="row wrap" style={{ gap: '0.3rem' }}>
              {abilities.map((a) => <button key={a.label} className="btn xs" title={`${a.title}: ${a.expr}`} onClick={() => roll(a.expr, a.title)}>{a.label}</button>)}
            </div>
          )}
          <div className="row wrap" style={{ gap: '0.3rem' }}>
            {actions.map((a) => <button key={a.label} className="btn xs" title={a.expr} onClick={() => roll(a.expr, a.title)}>{a.label} <span className="faint">{a.expr}</span></button>)}
            <button className="btn xs" onClick={() => roll(`1d20${ch.initiativeBonus >= 0 ? '+' : ''}${ch.initiativeBonus}`, 'Initiative')}>Initiative</button>
          </div>
        </div>
      )}
      <div className="stack tight">
        <div className="sub-title" style={{ margin: 0 }}>Conditions</div>
        {editable ? <ConditionPicker value={ch.conditions} onChange={(conditions) => update({ conditions })} compact /> : (
          <div className="row wrap">{ch.conditions.length ? ch.conditions.map((c) => <span key={c} className="chip">{c}</span>) : <span className="tiny faint">None</span>}</div>
        )}
      </div>
      <div className="stack tight">
        <div className="row between">
          <div className="sub-title" style={{ margin: 0 }}>Character sheet</div>
          {editable && <button className="btn xs ghost" onClick={() => setEditingSheet(!editingSheet)}><Pencil size={11} /> {editingSheet ? 'Done' : 'Edit'}</button>}
        </div>
        {editingSheet ? (
          <AutoSaveText value={ch.sheet} onSave={(sheet) => update({ sheet })} rows={8} maxLength={4000} placeholder="Abilities, attacks, spells, gear..." />
        ) : ch.sheet ? (
          <pre className="sheet">{ch.sheet}</pre>
        ) : (
          <div className="empty small">No sheet yet. {editable ? 'Click Edit to jot down attacks and abilities.' : ''}</div>
        )}
      </div>
      {isDm && null}
    </div>
  )
}

export function PlayerPanel({ board, you, participants, client, tab, onError }: { board: BoardView; you: YouInfo; participants: ParticipantView[]; client: GameClient; tab: 'character' | 'party'; onError: (m: string) => void }) {
  const mine = board.characters.find((c) => c.ownerId === you.participantId)
  const free = board.characters.filter((c) => !c.ownerId)
  const myEntry = mine ? board.initiative.entries.find((e) => e.characterId === mine.id) : null

  if (tab === 'party') {
    return (
      <div className="stack">
        <h3 className="section-title">The party</h3>
        {board.characters.length === 0 && <div className="empty">No characters yet. The DM can add some from the Party tab.</div>}
        {board.characters.map((c) => (
          <div key={c.id} className={`card char-card ${c.id === mine?.id ? 'mine' : ''}`}>
            <div className="row">
              <Avatar icon={c.icon} color={c.color} size={32} />
              <div className="grow">
                <strong>{c.name}</strong>
                <div className="tiny muted">{c.summary}{ownerName(c, participants) ? ` · played by ${ownerName(c, participants)}` : ' · unclaimed'}</div>
              </div>
              <span className="pill" title="Armor Class"><Shield size={11} /> {c.ac}</span>
            </div>
            <div className="row small"><span className="grow"><HpBar hp={c.hp} max={c.maxHp} /></span><span className="tiny muted">{c.hp}/{c.maxHp}</span></div>
            {c.conditions.length > 0 && <div className="row wrap">{c.conditions.map((x) => <span key={x} className="chip">{x}</span>)}</div>}
          </div>
        ))}
        <h3 className="section-title" style={{ marginTop: '0.5rem' }}>At the table</h3>
        {participants.map((p) => (
          <div key={p.id} className="person">
            <Avatar icon={p.avatar} color={p.color} online={p.online} />
            <span className="grow">{p.name}{p.id === you.participantId ? <span className="faint"> (you)</span> : null}</span>
            {p.role === 'dm' && <span className="pill dm">DM</span>}
            {!p.online && <span className="tiny faint">away</span>}
          </div>
        ))}
      </div>
    )
  }

  if (!mine) {
    return (
      <div className="stack">
        <h3 className="section-title">Choose your hero</h3>
        <p className="small muted">Pick a ready-made character to play. Each one has a short sheet with one-click rolls, so you can play without knowing the rules.</p>
        {free.length === 0 && <div className="empty">All characters are taken. Ask the DM to add one for you from their Party tab.</div>}
        {free.map((c) => (
          <div key={c.id} className="card char-card">
            <div className="row">
              <Avatar icon={c.icon} color={c.color} size={36} />
              <div className="grow">
                <strong>{c.name}</strong>
                <div className="tiny muted">{c.summary}</div>
              </div>
              <button className="btn sm primary" onClick={async () => { const r = await client.op({ type: 'character.claim', characterId: c.id }); if (!r.ok && r.error) onError(r.error) }}>Play</button>
            </div>
            {c.sheet && <p className="tiny muted" style={{ margin: 0 }}>{c.sheet.split('\n').find((l) => l.startsWith('Plays well for')) ?? ''}</p>}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="stack">
      {myEntry && myEntry.value === 0 && (
        <div className="callout" style={{ margin: 0 }}>
          <h4>Roll for initiative!</h4>
          <p className="small">Combat is starting. Roll to see when you act.</p>
          <button className="btn primary sm" style={{ marginTop: '0.4rem' }} onClick={async () => { const r = await client.op({ type: 'initiative.rollSelf', entryId: myEntry.id }); if (!r.ok && r.error) onError(r.error) }}>
            <Dices size={14} /> Roll initiative (d20{mine.initiativeBonus >= 0 ? '+' : ''}{mine.initiativeBonus})
          </button>
        </div>
      )}
      <div className="card char-card mine">
        <CharacterSheet ch={mine} client={client} editable isDm={false} onError={onError} />
      </div>
      <details className="card" style={{ padding: '0.7rem 0.8rem' }}>
        <summary className="small" style={{ cursor: 'pointer' }}><strong>What can I do on my turn?</strong></summary>
        <ul className="small" style={{ paddingLeft: '1.1em', margin: '0.5rem 0 0', color: '#dccfbb' }}>
          <li><strong>Move</strong> up to your Speed (each square is 5 feet): drag your token.</li>
          <li><strong>Take one action</strong>, usually an attack: click an "attack" button. If the total meets or beats the target's AC, click the matching "damage" button.</li>
          <li>Not sure? Just tell the DM what you want to do. They will tell you what to roll.</li>
        </ul>
      </details>
      <button className="btn ghost xs" style={{ justifySelf: 'start' }} onClick={() => client.op({ type: 'character.release', characterId: mine.id })}>Switch character</button>
    </div>
  )
}
