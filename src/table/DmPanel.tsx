import { useEffect, useMemo, useState } from 'react'
import {
  BookMarked, Check, ChevronDown, ChevronUp, Copy, Eye, EyeOff, ImageUp, KeyRound, Play, Plus, RefreshCw, RotateCcw, Save,
  ScrollText, SkipBack, SkipForward, Square, Swords, Trash2, Users, Map as MapIcon, Dices,
} from 'lucide-react'
import type { BoardView, CampaignMeta, CharacterView, ParticipantView, YouInfo } from '../../shared/types.ts'
import { MONSTER_PRESETS, TOKEN_COLORS } from '../../shared/presets.ts'
import type { GameClient } from '../lib/game.ts'
import { api, inviteUrl } from '../lib/api.ts'
import { Avatar, ICONS, TOKEN_ICON_CHOICES } from '../lib/icons.tsx'
import { AutoSaveText, ConditionPicker, HpBar, Modal, NumberField } from '../components/ui.tsx'
import { CharacterSheet } from './PlayerPanel.tsx'

export type DmTab = 'guide' | 'party' | 'encounter' | 'scenes' | 'session'

interface Props {
  tab: DmTab
  board: BoardView
  campaign: CampaignMeta
  participants: ParticipantView[]
  you: YouInfo
  client: GameClient
  token: string
  onError: (m: string) => void
  onInfo: (m: string) => void
}

export const DM_TABS: { id: DmTab; label: string; icon: typeof Users }[] = [
  { id: 'guide', label: 'Guide', icon: BookMarked },
  { id: 'party', label: 'Party', icon: Users },
  { id: 'encounter', label: 'Encounter', icon: Swords },
  { id: 'scenes', label: 'Scenes', icon: MapIcon },
  { id: 'session', label: 'Session', icon: ScrollText },
]

export function DmPanel(props: Props) {
  const { tab } = props
  if (tab === 'guide') return <GuideTab {...props} />
  if (tab === 'party') return <PartyTab {...props} />
  if (tab === 'encounter') return <EncounterTab {...props} />
  if (tab === 'scenes') return <ScenesTab {...props} />
  return <SessionTab {...props} />
}

function useRun(client: GameClient, onError: (m: string) => void) {
  return async (op: Parameters<GameClient['op']>[0]) => {
    const r = await client.op(op)
    if (!r.ok && r.error) onError(r.error)
    return r.ok
  }
}

// ---------------------------------------------------------------------------

function GuideTab({ board, campaign, client, onError }: Props) {
  const g = board.guide
  const run = useRun(client, onError)
  if (!g) {
    return (
      <div className="stack">
        <h3 className="section-title">Running your first game</h3>
        <ol className="steps">
          <li><span><strong>Share the invite link</strong> from the Session tab. Players join with a name and avatar.</span></li>
          <li><span><strong>Add characters</strong> in the Party tab, or let players describe theirs and you fill in HP and AC.</span></li>
          <li><span><strong>Set the scene</strong>: upload a map image in Scenes, or play on the blank grid.</span></li>
          <li><span><strong>Start the session</strong>. Until you do, players can chat but not move tokens.</span></li>
          <li><span>When a fight starts, use the <strong>Encounter</strong> tab to add monsters and track initiative.</span></li>
        </ol>
        <p className="small muted">Want a ready-made adventure? Start the demo campaign from the home page.</p>
      </div>
    )
  }
  return (
    <div className="stack">
      <div>
        <p className="kicker">DM's guide · only you can see this</p>
        <h3 className="section-title" style={{ fontSize: '1.45rem' }}>{g.title}</h3>
        <p className="small" style={{ color: '#dccfbb' }}>{g.overview}</p>
      </div>
      {campaign.status !== 'live' && (
        <div className="callout" style={{ margin: 0 }}>
          <h4>Ready when you are</h4>
          <p className="small">Share the invite link (Session tab), wait for players to pick characters, then start the session.</p>
          <button className="btn gold sm" style={{ marginTop: '0.45rem' }} onClick={() => run({ type: campaign.sessionNumber > 0 ? 'session.resume' : 'session.start' })}>
            <Play size={14} /> {campaign.sessionNumber > 0 ? 'Resume session' : 'Start session'}
          </button>
        </div>
      )}
      <div className="stack tight">
        <div className="sub-title" style={{ margin: 0 }}>Read aloud to start</div>
        <div className="read-aloud small">{g.readAloud}</div>
      </div>
      <div className="stack tight">
        <div className="sub-title" style={{ margin: 0 }}>Encounter flow</div>
        {g.flow.map((f) => (
          <details key={f.title} className="guide-block" open={f === g.flow[0]}>
            <summary style={{ cursor: 'pointer' }}><strong>{f.title}</strong></summary>
            <p className="small" style={{ color: '#dccfbb', marginTop: '0.35rem' }}>{f.text}</p>
          </details>
        ))}
      </div>
      <div className="stack tight">
        <div className="sub-title" style={{ margin: 0 }}>Tips</div>
        <ul className="small" style={{ paddingLeft: '1.1em', margin: 0, color: '#dccfbb' }}>
          {g.tips.map((t) => <li key={t} style={{ marginBottom: '0.3em' }}>{t}</li>)}
        </ul>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function PartyTab({ board, participants, you, client, onError }: Props) {
  const run = useRun(client, onError)
  const players = participants.filter((p) => p.role === 'player')
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  return (
    <div className="stack">
      <h3 className="section-title">Players <span className="tiny faint">{players.filter((p) => p.online).length} online · {players.length}/10</span></h3>
      {players.length === 0 && <div className="empty">No players yet. Copy the invite link from the Session tab and share it with your group.</div>}
      {players.map((p) => {
        const ch = board.characters.find((c) => c.ownerId === p.id)
        return (
          <div key={p.id} className="dm-row">
            <div className="row">
              <Avatar icon={p.avatar} color={p.color} online={p.online} />
              <div className="grow">
                <strong>{p.name}</strong>
                <div className="tiny muted">{p.online ? 'Connected' : 'Away'} · {ch ? `playing ${ch.name}` : 'no character yet'}</div>
              </div>
            </div>
            <div className="row wrap" style={{ gap: '0.3rem' }}>
              <button className={`btn xs ${p.canMove ? '' : 'active'}`} onClick={() => run({ type: 'participant.update', participantId: p.id, patch: { canMove: !p.canMove } })} title="Allow this player to move their own token">
                {p.canMove ? 'Can move' : 'Movement paused'}
              </button>
              <button className={`btn xs ${p.canChat ? '' : 'active'}`} onClick={() => run({ type: 'participant.update', participantId: p.id, patch: { canChat: !p.canChat } })} title="Allow chat and dice">
                {p.canChat ? 'Can chat' : 'Muted'}
              </button>
              <span className="grow" />
              <button className="btn xs danger" onClick={() => confirm(`Remove ${p.name} from this campaign? They will need a new invite to come back.`) && run({ type: 'participant.remove', participantId: p.id })}>Remove</button>
            </div>
          </div>
        )
      })}

      <h3 className="section-title" style={{ marginTop: '0.5rem' }}>
        Characters
        <button className="btn xs" onClick={() => setAdding(!adding)}><Plus size={12} /> Add</button>
      </h3>
      {adding && <AddCharacter client={client} onError={onError} onDone={() => setAdding(false)} />}
      {board.characters.length === 0 && !adding && <div className="empty">No characters. Add one for each player, or let players claim the pre-made ones.</div>}
      {board.characters.map((c) => (
        <CharacterRow key={c.id} c={c} players={players} client={client} onError={onError} open={open === c.id} toggle={() => setOpen(open === c.id ? null : c.id)} you={you} />
      ))}
    </div>
  )
}

function CharacterRow({ c, players, client, onError, open, toggle }: { c: CharacterView; players: ParticipantView[]; client: GameClient; onError: (m: string) => void; open: boolean; toggle: () => void; you: YouInfo }) {
  const run = useRun(client, onError)
  const upd = (patch: Partial<CharacterView>) => run({ type: 'character.update', characterId: c.id, patch })
  return (
    <div className="dm-row">
      <div className="row">
        <Avatar icon={c.icon} color={c.color} size={30} />
        <div className="grow">
          <strong>{c.name}</strong>
          <div className="tiny muted">{c.summary || 'Adventurer'}</div>
        </div>
        <button className="btn ghost icon sm" onClick={toggle} aria-label={open ? 'Collapse' : 'Expand'}>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
      </div>
      <HpBar hp={c.hp} max={c.maxHp} />
      <div className="inline-stats">
        <label>HP <NumberField value={c.hp} onCommit={(hp) => upd({ hp })} /></label>
        <label>/ <NumberField value={c.maxHp} min={0} onCommit={(maxHp) => upd({ maxHp })} /></label>
        <label>AC <NumberField value={c.ac} min={0} max={40} onCommit={(ac) => upd({ ac })} /></label>
      </div>
      <ConditionPicker value={c.conditions} onChange={(conditions) => upd({ conditions })} compact />
      <label className="field">
        <span>Played by</span>
        <select className="select" value={c.ownerId ?? ''} onChange={(e) => upd({ ownerId: e.target.value || null })}>
          <option value="">Nobody yet</option>
          {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Private DM notes</span>
        <AutoSaveText value={c.dmNotes ?? ''} onSave={(dmNotes) => upd({ dmNotes })} rows={2} placeholder="Secrets, hooks, reminders. Players never see this." maxLength={4000} />
      </label>
      {open && (
        <div className="stack tight">
          <div className="row">
            <label className="field grow"><span>Name</span><input className="input sm" defaultValue={c.name} key={c.name} onBlur={(e) => e.target.value !== c.name && upd({ name: e.target.value })} /></label>
            <label className="field"><span>Init</span><NumberField value={c.initiativeBonus} min={-10} max={20} onCommit={(initiativeBonus) => upd({ initiativeBonus })} /></label>
            <label className="field"><span>Speed</span><NumberField value={c.speed} min={0} max={200} onCommit={(speed) => upd({ speed })} /></label>
          </div>
          <label className="field"><span>Summary</span><input className="input sm" defaultValue={c.summary} key={c.summary} placeholder="e.g. Elf Ranger, level 2" onBlur={(e) => e.target.value !== c.summary && upd({ summary: e.target.value })} /></label>
          <div className="swatches">
            {TOKEN_COLORS.map((col) => <button key={col} className={`swatch ${col === c.color ? 'on' : ''}`} style={{ background: col }} onClick={() => upd({ color: col })} aria-label={`Color ${col}`} />)}
          </div>
          <CharacterSheet ch={c} client={client} editable isDm onError={onError} />
          <button className="btn xs danger" style={{ justifySelf: 'start' }} onClick={() => confirm(`Delete ${c.name} and their tokens?`) && run({ type: 'character.remove', characterId: c.id })}><Trash2 size={12} /> Delete character</button>
        </div>
      )}
    </div>
  )
}

function AddCharacter({ client, onError, onDone }: { client: GameClient; onError: (m: string) => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [maxHp, setMaxHp] = useState(10)
  const [ac, setAc] = useState(12)
  const [initiativeBonus, setInit] = useState(0)
  const [color] = useState(TOKEN_COLORS[Math.floor(Math.random() * TOKEN_COLORS.length)])
  const run = useRun(client, onError)
  return (
    <form
      className="dm-row"
      onSubmit={async (e) => {
        e.preventDefault()
        if (await run({ type: 'character.add', character: { name, summary, maxHp, ac, initiativeBonus, color, icon: 'sword' }, place: true })) onDone()
      }}
    >
      <input className="input sm" placeholder="Character name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} />
      <input className="input sm" placeholder="Species and class, e.g. Human Bard 1" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={80} />
      <div className="inline-stats">
        <label>Max HP <NumberField value={maxHp} min={1} onCommit={setMaxHp} /></label>
        <label>AC <NumberField value={ac} min={0} max={40} onCommit={setAc} /></label>
        <label>Init <NumberField value={initiativeBonus} min={-10} max={20} onCommit={setInit} /></label>
      </div>
      <div className="row"><button className="btn sm primary">Add and place on map</button><button type="button" className="btn sm ghost" onClick={onDone}>Cancel</button></div>
    </form>
  )
}

// ---------------------------------------------------------------------------

function EncounterTab({ board, client, onError }: Props) {
  const run = useRun(client, onError)
  const ini = board.initiative
  const scene = board.scene
  const tokens = scene?.tokens ?? []
  const [preset, setPreset] = useState(MONSTER_PRESETS[0].key)
  const [count, setCount] = useState(1)
  const [customName, setCustomName] = useState('')
  const [hidden, setHidden] = useState(false)
  const [customHp, setCustomHp] = useState(10)
  const [customAc, setCustomAc] = useState(12)
  const [icon, setIcon] = useState('skull')
  const p = MONSTER_PRESETS.find((m) => m.key === preset)
  const isCustom = preset === 'custom'

  const addMonsters = async () => {
    if (!scene) return
    const taken = new Set(tokens.map((t) => `${t.x},${t.y}`))
    const cx = Math.floor(scene.cols / 2)
    const cy = Math.floor(scene.rows / 2)
    const spots: [number, number][] = []
    for (let r = 0; r < Math.max(scene.cols, scene.rows) && spots.length < count; r++)
      for (let dy = -r; dy <= r && spots.length < count; dy++)
        for (let dx = -r; dx <= r && spots.length < count; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
          const x = cx + dx
          const y = cy + dy
          if (x < 0 || y < 0 || x >= scene.cols || y >= scene.rows || taken.has(`${x},${y}`)) continue
          taken.add(`${x},${y}`)
          spots.push([x, y])
        }
    const base = customName.trim() || (isCustom ? 'Monster' : p!.name)
    await run({
      type: 'token.add',
      tokens: spots.map(([x, y], i) => ({
        name: count > 1 ? `${base} ${i + 1}` : base,
        kind: p?.key === 'commoner' ? 'npc' : 'monster',
        x, y,
        hp: isCustom ? customHp : p!.hp,
        maxHp: isCustom ? customHp : p!.hp,
        ac: isCustom ? customAc : p!.ac,
        icon: isCustom ? icon : p!.icon,
        color: isCustom ? '#b4443a' : p!.color,
        size: isCustom ? 1 : p!.size,
        hidden,
        dmNotes: isCustom ? '' : `${p!.name} (SRD 5.2.1): AC ${p!.ac}, HP ${p!.hp}. ${p!.note}`,
      })),
    })
    setCustomName('')
  }

  const current = ini.entries.find((e) => e.id === ini.currentId)
  return (
    <div className="stack">
      <h3 className="section-title">
        Initiative
        <span className="pill">{ini.round === 0 ? 'Not started' : `Round ${ini.round}`}</span>
      </h3>
      {ini.entries.length === 0 ? (
        <div className="empty">
          No one is in initiative. When combat starts, add everyone on the map, roll for the monsters, and ask players to roll theirs.
          <div className="row" style={{ justifyContent: 'center', marginTop: '0.6rem' }}>
            <button className="btn sm primary" onClick={() => run({ type: 'initiative.add', tokenIds: tokens.filter((t) => !t.hidden).map((t) => t.id) })} disabled={!tokens.length}>
              <Swords size={14} /> Add visible tokens
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="row wrap" style={{ gap: '0.3rem' }}>
            <button className="btn sm primary" onClick={() => run({ type: 'initiative.next' })}><SkipForward size={14} /> {ini.round === 0 ? 'Begin combat' : 'Next turn'}</button>
            <button className="btn sm" onClick={() => run({ type: 'initiative.prev' })} disabled={ini.round === 0} aria-label="Previous turn"><SkipBack size={14} /></button>
            <button className="btn sm" onClick={() => run({ type: 'initiative.rollMonsters' })}><Dices size={14} /> Reroll monsters</button>
            <button className="btn sm ghost" onClick={() => run({ type: 'initiative.add', tokenIds: tokens.map((t) => t.id) })}>Add all</button>
            <button className="btn sm ghost" onClick={() => confirm('End combat and clear initiative?') && run({ type: 'initiative.clear' })}>End combat</button>
          </div>
          {current && <p className="small" style={{ margin: 0 }}>Now acting: <strong style={{ color: 'var(--ember-2)' }}>{current.name}</strong></p>}
          <div className="init-list">
            {ini.entries.map((e) => {
              const t = tokens.find((x) => x.id === e.tokenId)
              return (
                <div key={e.id} className={`init-row ${e.id === ini.currentId ? 'cur' : ''}`}>
                  <NumberField value={e.value} min={-10} max={99} onCommit={(value) => run({ type: 'initiative.set', entryId: e.id, value })} ariaLabel={`Initiative for ${e.name}`} />
                  <span className="grow small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.name}
                    {e.kind === 'pc' && e.value === 0 && <span className="tiny faint"> · waiting for roll</span>}
                  </span>
                  {t?.hidden && <EyeOff size={13} className="faint" />}
                  {t && t.hp !== null && <span className="tiny muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{t.hp}/{t.maxHp}</span>}
                  <button className="btn ghost xs icon" onClick={() => run({ type: 'initiative.remove', entryId: e.id })} aria-label={`Remove ${e.name}`}><Trash2 size={12} /></button>
                </div>
              )
            })}
          </div>
        </>
      )}

      <h3 className="section-title" style={{ marginTop: '0.5rem' }}>Add monsters or NPCs</h3>
      <div className="dm-row">
        <select className="select" value={preset} onChange={(e) => setPreset(e.target.value)} aria-label="Monster type">
          {MONSTER_PRESETS.map((m) => <option key={m.key} value={m.key}>{m.name} · AC {m.ac}, HP {m.hp}</option>)}
          <option value="custom">Custom creature...</option>
        </select>
        {p && <span className="tiny muted">{p.note}</span>}
        {isCustom && (
          <>
            <div className="inline-stats">
              <label>HP <NumberField value={customHp} min={1} onCommit={setCustomHp} /></label>
              <label>AC <NumberField value={customAc} min={0} max={40} onCommit={setCustomAc} /></label>
            </div>
            <div className="row wrap" style={{ gap: '0.25rem' }}>
              {TOKEN_ICON_CHOICES.map((i) => {
                const I = ICONS[i]
                return <button key={i} className={`btn xs icon ${icon === i ? 'active' : ''}`} onClick={() => setIcon(i)} aria-label={i}><I size={14} /></button>
              })}
            </div>
          </>
        )}
        <div className="row">
          <input className="input sm grow" placeholder="Name (optional)" value={customName} onChange={(e) => setCustomName(e.target.value)} maxLength={36} />
          <span className="stepper"><button onClick={() => setCount(Math.max(1, count - 1))}>−</button><span>{count}</span><button onClick={() => setCount(Math.min(10, count + 1))}>+</button></span>
        </div>
        <label className="row small" style={{ gap: '0.4rem' }}>
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> Hidden from players (ambush!)
        </label>
        <button className="btn sm primary" onClick={addMonsters} disabled={!scene}><Plus size={14} /> Place on map</button>
        <span className="tiny faint">Stats from the SRD 5.2.1. Tokens appear in the middle of the map; drag them into place.</span>
      </div>

      <h3 className="section-title" style={{ marginTop: '0.5rem' }}>On this scene</h3>
      {tokens.filter((t) => t.kind !== 'pc').length === 0 && <div className="empty small">No monsters or NPCs on this scene.</div>}
      {tokens.filter((t) => t.kind !== 'pc').map((t) => (
        <div key={t.id} className="init-row">
          <Avatar icon={t.icon} color={t.color} size={22} />
          <span className="grow small">{t.name}</span>
          <NumberField value={t.hp ?? 0} onCommit={(hp) => run({ type: 'token.update', tokenId: t.id, patch: { hp } })} ariaLabel={`${t.name} HP`} />
          <span className="tiny faint">/{t.maxHp}</span>
          <button className="btn ghost xs icon" title={t.hidden ? 'Show to players' : 'Hide from players'} onClick={() => run({ type: 'token.update', tokenId: t.id, patch: { hidden: !t.hidden } })}>
            {t.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <button className="btn ghost xs icon" onClick={() => run({ type: 'token.remove', tokenId: t.id })} aria-label={`Remove ${t.name}`}><Trash2 size={12} /></button>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------

function ScenesTab({ board, campaign, client, token, onError, onInfo }: Props) {
  const run = useRun(client, onError)
  const scenes = board.scenes ?? []
  const scene = board.scene
  const [newName, setNewName] = useState('')
  const [cols, setCols] = useState(24)
  const [rows, setRows] = useState(18)
  const [upload, setUpload] = useState<{ file: File; url: string; w: number; h: number } | null>(null)
  const viewingLive = scene?.id === board.activeSceneId

  const pickFile = (f: File | undefined) => {
    if (!f) return
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => setUpload({ file: f, url, w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => onError('That file does not look like an image.')
    img.src = url
  }

  return (
    <div className="stack">
      <h3 className="section-title">Scenes</h3>
      <p className="tiny muted" style={{ margin: 0 }}>Players always see the <strong>live</strong> scene. You can open another scene to prepare it in secret.</p>
      <div className="stack tight">
        {scenes.map((s) => (
          <div key={s.id} className={`init-row ${s.id === scene?.id ? 'cur' : ''}`}>
            <span className="grow small">
              <strong>{s.name}</strong>
              <span className="tiny faint"> · {s.cols}x{s.rows}{s.hasImage ? ' · map' : ''}{s.fogEnabled ? ' · fog' : ''}</span>
            </span>
            {s.id === board.activeSceneId ? <span className="pill live">Live</span> : (
              <>
                {s.id !== scene?.id && <button className="btn xs" onClick={() => run({ type: 'scene.edit', sceneId: s.id })}>Open</button>}
                <button className="btn xs gold" onClick={() => run({ type: 'scene.activate', sceneId: s.id })} title="Move all players to this scene">Go live</button>
              </>
            )}
          </div>
        ))}
      </div>
      {!viewingLive && scene && (
        <div className="callout" style={{ margin: 0 }}>
          <h4>Preparing "{scene.name}"</h4>
          <p className="small">Players can't see this scene yet.</p>
          <div className="row" style={{ marginTop: '0.4rem' }}>
            <button className="btn xs gold" onClick={() => run({ type: 'scene.activate', sceneId: scene.id })}>Go live</button>
            <button className="btn xs" onClick={() => run({ type: 'scene.edit', sceneId: board.activeSceneId! })}>Back to live scene</button>
          </div>
        </div>
      )}

      {scene && (
        <>
          <h3 className="section-title" style={{ marginTop: '0.5rem' }}>This scene</h3>
          <div className="dm-row">
            <label className="field"><span>Name</span><input className="input sm" defaultValue={scene.name} key={scene.id + scene.name} maxLength={60} onBlur={(e) => e.target.value !== scene.name && run({ type: 'scene.update', sceneId: scene.id, patch: { name: e.target.value } })} /></label>
            <div className="inline-stats">
              <label>Columns <NumberField value={scene.cols} min={4} max={80} onCommit={(v) => run({ type: 'scene.update', sceneId: scene.id, patch: { cols: v } })} /></label>
              <label>Rows <NumberField value={scene.rows} min={4} max={80} onCommit={(v) => run({ type: 'scene.update', sceneId: scene.id, patch: { rows: v } })} /></label>
            </div>
            <span className="tiny faint">Each square is 5 feet. With a map image, match the squares to the grid drawn on the image.</span>
            <label className="btn sm" style={{ justifySelf: 'start' }}>
              <ImageUp size={14} /> {scene.bg.kind === 'image' ? 'Replace map image' : 'Upload map image'}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
            </label>
          </div>
          <div className="dm-row">
            <label className="row small" style={{ gap: '0.45rem' }}>
              <input type="checkbox" checked={scene.fogEnabled} onChange={(e) => run({ type: 'fog.enable', sceneId: scene.id, enabled: e.target.checked })} />
              <strong>Fog of war</strong>
            </label>
            <span className="tiny muted">With fog on, players only see squares you reveal, and monsters standing in fog are invisible to them. Use the brush tools on the left edge of the map.</span>
            {scene.fogEnabled && (
              <div className="row">
                <button className="btn xs" onClick={() => run({ type: 'fog.all', sceneId: scene.id, reveal: true })}>Reveal everything</button>
                <button className="btn xs" onClick={() => run({ type: 'fog.all', sceneId: scene.id, reveal: false })}>Cover everything</button>
              </div>
            )}
          </div>
        </>
      )}

      <h3 className="section-title" style={{ marginTop: '0.5rem' }}>New scene</h3>
      <form className="dm-row" onSubmit={async (e) => { e.preventDefault(); if (await run({ type: 'scene.add', name: newName || 'New scene', cols, rows })) { setNewName(''); onInfo('Scene created. It stays hidden until you press Go live.') } }}>
        <input className="input sm" placeholder="Scene name, e.g. Goblin caves" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} />
        <div className="inline-stats">
          <label>Columns <NumberField value={cols} min={4} max={60} onCommit={setCols} /></label>
          <label>Rows <NumberField value={rows} min={4} max={60} onCommit={setRows} /></label>
        </div>
        <button className="btn sm"><Plus size={14} /> Create blank scene</button>
      </form>

      {upload && scene && (
        <UploadMapModal
          upload={upload}
          onClose={() => { URL.revokeObjectURL(upload.url); setUpload(null) }}
          onUpload={async (c, r) => {
            try {
              const { blob, w, h } = await prepareImage(upload.file, upload.w, upload.h)
              await api(`/api/campaigns/${campaign.id}/scenes/${scene.id}/map?width=${w}&height=${h}&cols=${c}&rows=${r}`, { method: 'POST', body: blob, token, headers: { 'content-type': blob.type } })
              onInfo(scene.fogEnabled ? 'Map uploaded. It is covered by fog; reveal areas with the brush.' : 'Map uploaded.')
              URL.revokeObjectURL(upload.url)
              setUpload(null)
            } catch (e) {
              onError((e as Error).message)
            }
          }}
        />
      )}
    </div>
  )
}

async function prepareImage(file: File, w: number, h: number): Promise<{ blob: Blob; w: number; h: number }> {
  const MAX = 4096
  if (file.size <= 6 * 1024 * 1024 && w <= MAX && h <= MAX) return { blob: file, w, h }
  const scale = Math.min(1, MAX / Math.max(w, h))
  const cw = Math.round(w * scale)
  const ch = Math.round(h * scale)
  const bmp = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, cw, ch)
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not process image'))), 'image/webp', 0.85))
  return { blob, w: cw, h: ch }
}

function UploadMapModal({ upload, onClose, onUpload }: { upload: { url: string; w: number; h: number }; onClose: () => void; onUpload: (cols: number, rows: number) => Promise<void> }) {
  const guess = Math.max(4, Math.min(60, Math.round(upload.w / 70)))
  const [cols, setCols] = useState(guess)
  const rows = Math.max(4, Math.min(80, Math.round((cols * upload.h) / upload.w)))
  const [busy, setBusy] = useState(false)
  return (
    <Modal onClose={onClose}>
      <h3>Line up the grid</h3>
      <p className="small muted">How many squares wide is this map? If the image has a grid drawn on it, count the squares across the top. Otherwise pick a size that feels right (each square is 5 feet).</p>
      <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line-2)', marginBottom: '0.75rem' }}>
        <img src={upload.url} alt="Map preview" style={{ width: '100%', display: 'block' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,240,220,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,240,220,0.35) 1px, transparent 1px)', backgroundSize: `${100 / cols}% ${100 / rows}%` }} />
      </div>
      <div className="row wrap">
        <label className="row small">Squares across <NumberField value={cols} min={4} max={60} onCommit={setCols} /></label>
        <span className="small muted">{cols} x {rows} squares · {upload.w} x {upload.h} px</span>
      </div>
      <div className="row" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); await onUpload(cols, rows); setBusy(false) }}>{busy ? 'Uploading...' : 'Use this map'}</button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------

interface SnapshotInfo {
  id: number
  label: string
  createdAt: string
}
interface SessionInfo {
  id: number
  number: number
  startedAt: string
  endedAt: string | null
}

function SessionTab({ board, campaign, client, token, onError, onInfo }: Props) {
  const run = useRun(client, onError)
  const [snaps, setSnaps] = useState<SnapshotInfo[]>([])
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [label, setLabel] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const load = useMemo(
    () => () =>
      api<{ snapshots: SnapshotInfo[]; sessions: SessionInfo[] }>(`/api/campaigns/${campaign.id}/snapshots`, { token })
        .then((r) => {
          setSnaps(r.snapshots)
          setSessions(r.sessions)
        })
        .catch(() => {}),
    [campaign.id, token],
  )
  useEffect(() => {
    void load()
  }, [load, campaign.status])

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      window.setTimeout(() => setCopied(null), 1800)
    } catch {
      prompt('Copy this link:', text)
    }
  }
  const invite = campaign.inviteCode ? inviteUrl(campaign.inviteCode) : ''
  const dmLink = `${location.origin}/table/${campaign.id}#dmkey=${token}`
  const status = campaign.status

  return (
    <div className="stack">
      <h3 className="section-title">
        Session {campaign.sessionNumber || ''}
        <span className={`pill ${status === 'live' ? 'live' : ''}`}>{status === 'live' ? 'Live' : status === 'ended' ? 'Paused' : 'Not started'}</span>
      </h3>
      <div className="row wrap" style={{ gap: '0.35rem' }}>
        {status !== 'live' && campaign.sessionNumber > 0 && <button className="btn sm gold" onClick={() => run({ type: 'session.resume' })}><Play size={14} /> Resume session {campaign.sessionNumber}</button>}
        {status !== 'live' && <button className={`btn sm ${campaign.sessionNumber > 0 ? '' : 'gold'}`} onClick={() => run({ type: 'session.start' })}><Play size={14} /> Start session {campaign.sessionNumber + 1}</button>}
        {status === 'live' && <button className="btn sm" onClick={() => confirm('End this session? Everything stays saved and players can keep chatting.') && run({ type: 'session.end' })}><Square size={13} /> End session</button>}
      </div>
      <p className="tiny faint" style={{ margin: 0 }}>Everything saves automatically as you play. Players can't move tokens while the session is not live.</p>

      <div className="sub-title">Invite players</div>
      <div className="row">
        <input className="input sm" readOnly value={invite} onFocus={(e) => e.target.select()} aria-label="Invite link" />
        <button className="btn sm" onClick={() => copy(invite, 'invite')}>{copied === 'invite' ? <Check size={14} /> : <Copy size={14} />}</button>
      </div>
      <div className="row">
        <a className="btn xs ghost" href={invite} target="_blank" rel="noreferrer">Test as a player in a new tab</a>
        <button className="btn xs ghost" onClick={() => confirm('Make a new invite link? The old link will stop working (players already at the table are not affected).') && run({ type: 'invite.regenerate' })}><RefreshCw size={12} /> New link</button>
      </div>

      <div className="sub-title">Save points</div>
      <form className="row" onSubmit={async (e) => { e.preventDefault(); if (await run({ type: 'snapshot.save', label })) { setLabel(''); onInfo('Save point created.'); void load() } }}>
        <input className="input sm" placeholder="Label, e.g. Before the boss" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
        <button className="btn sm"><Save size={14} /> Save</button>
      </form>
      {snaps.length === 0 ? <span className="tiny faint">No save points yet. Make one before a big fight so you can rewind.</span> : (
        <div className="stack tight">
          {snaps.map((s) => (
            <div key={s.id} className="init-row">
              <span className="grow small">{s.label}<br /><span className="tiny faint">{new Date(s.createdAt).toLocaleString()}</span></span>
              <button className="btn xs" onClick={() => confirm(`Restore "${s.label}"? The map, tokens, characters and initiative go back to that moment.`) && run({ type: 'snapshot.restore', snapshotId: s.id })}><RotateCcw size={12} /> Restore</button>
            </div>
          ))}
        </div>
      )}

      <div className="sub-title">Private session notes</div>
      <AutoSaveText value={board.sessionNotes ?? ''} onSave={(text) => run({ type: 'notes.update', text })} rows={7} placeholder="Names you made up, loot handed out, what happens next... Only you can see this." maxLength={20000} />

      <div className="sub-title">Campaign</div>
      <label className="field"><span>Name</span><input className="input sm" defaultValue={campaign.name} key={campaign.name} maxLength={80} onBlur={(e) => e.target.value.trim() && e.target.value !== campaign.name && run({ type: 'campaign.rename', name: e.target.value })} /></label>
      <div className="dm-row">
        <span className="small"><KeyRound size={13} style={{ verticalAlign: '-2px' }} /> <strong>Your DM key</strong></span>
        <span className="tiny muted">This browser holds the key that makes you the DM. To run the game from another device, open this link there. Keep it secret: anyone with it can control the campaign.</span>
        <button className="btn xs" style={{ justifySelf: 'start' }} onClick={() => copy(dmLink, 'dm')}>{copied === 'dm' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy DM link</>}</button>
      </div>
      {sessions.length > 0 && (
        <>
          <div className="sub-title">History</div>
          {sessions.map((s) => (
            <div key={s.id} className="tiny muted">Session {s.number}: {new Date(s.startedAt).toLocaleDateString()} {s.endedAt ? '' : '(open)'}</div>
          ))}
        </>
      )}
    </div>
  )
}
