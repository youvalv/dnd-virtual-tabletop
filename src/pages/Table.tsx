import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  BookOpen, ChevronLeft, ChevronRight, Copy, Dices, Map as MapIcon, MessageSquare, Play, User, Users, Wifi, WifiOff, X, Crown,
} from 'lucide-react'
import { api, getCredential, renameCredential, saveCredential, inviteUrl } from '../lib/api.ts'
import { useGame } from '../lib/game.ts'
import { Avatar, BrandMark } from '../lib/icons.tsx'
import { useToasts } from '../components/ui.tsx'
import { MapView, type FogBrush, type Tool } from '../table/MapView.tsx'
import { Chat, DiceTray, RollToasts } from '../table/Chat.tsx'
import { InitiativeStrip, yourTurn } from '../table/Initiative.tsx'
import { PlayerPanel } from '../table/PlayerPanel.tsx'
import { DmPanel, DM_TABS, type DmTab } from '../table/DmPanel.tsx'
import { TokenCard } from '../table/TokenCard.tsx'
import { renderPlayerMap } from '../table/playerMap.ts'
import { Attribution, QuickReference, ResourceList, SectionView, learnSections } from '../learn/LearnViews.tsx'
import { PRODUCT } from '../components/SiteShell.tsx'

function usePersisted<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(v))
  }, [key, v])
  return [v, setV] as const
}

export function TablePage() {
  const { campaignId = '' } = useParams()
  const nav = useNavigate()
  const [cred, setCred] = useState(() => getCredential(campaignId))
  const [claiming, setClaiming] = useState(false)

  // A DM can open the campaign on another device with /table/:id#dmkey=...
  useEffect(() => {
    const m = location.hash.match(/dmkey=([A-Za-z0-9_-]+)/)
    if (!m) return
    const key = m[1]
    history.replaceState(null, '', location.pathname)
    setClaiming(true)
    api<{ participantId: string; role: 'dm' | 'player'; campaignName: string }>(`/api/campaigns/${campaignId}/me`, { token: key })
      .then((r) => {
        saveCredential({ campaignId, participantId: r.participantId, token: key, role: r.role, name: r.campaignName })
        setCred(getCredential(campaignId))
      })
      .catch(() => {})
      .finally(() => setClaiming(false))
  }, [campaignId])

  if (claiming) return <FullMessage title="Checking your key..." />
  if (!cred) {
    return (
      <FullMessage title="You don't have a seat at this table yet">
        <p className="muted">Ask the DM for the invite link, then open it to join with a name and avatar.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={() => nav('/')}>Go home</button>
          <Link className="btn ghost" to="/learn">Learn D&amp;D while you wait</Link>
        </div>
      </FullMessage>
    )
  }
  return <Table campaignId={campaignId} token={cred.token} />
}

function FullMessage({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="join-wrap" style={{ minHeight: '100%', alignContent: 'center' }}>
      <div className="card join-card" style={{ textAlign: 'center' }}>
        <BrandMark className="brand-mark" />
        <h2 style={{ marginTop: '0.6rem' }}>{title}</h2>
        {children}
      </div>
    </div>
  )
}

function Table({ campaignId, token }: { campaignId: string; token: string }) {
  const { client, state } = useGame(campaignId, token)
  const { push, view: toastView } = useToasts()
  const { board, campaign, you, participants, messages, status } = state
  const isDm = you?.role === 'dm'

  const [leftOpen, setLeftOpen] = usePersisted('hl.leftOpen', true)
  const [rightOpen, setRightOpen] = usePersisted('hl.rightOpen', true)
  const [dmTab, setDmTab] = useState<DmTab>('guide')
  const [playerTab, setPlayerTab] = useState<'character' | 'party'>('character')
  const [mobile, setMobile] = useState<'map' | 'chat' | 'side'>('map')
  const [tool, setTool] = useState<Tool>('select')
  const [brush, setBrush] = useState<FogBrush>({ shape: 'brush', size: 2 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [diceOpen, setDiceOpen] = usePersisted('hl.diceOpen', typeof window === 'undefined' || window.innerWidth > 760)
  const [learnOpen, setLearnOpen] = useState(false)
  const [onboarded, setOnboarded] = usePersisted<Record<string, boolean>>('hl.onboarded', {})

  const onError = (m: string) => push(m, 'error')
  const onInfo = (m: string) => push(m)

  useEffect(() => {
    if (state.error && status === 'open') {
      push(state.error, 'error')
      client?.clearError()
    }
  }, [state.error, status])

  useEffect(() => {
    if (campaign) {
      renameCredential(campaign.id, campaign.name)
      document.title = `${campaign.name} · ${PRODUCT}`
    }
  }, [campaign?.name])

  useEffect(() => {
    if (isDm && board && !board.guide && dmTab === 'guide') setDmTab('party')
  }, [isDm, board?.guide])

  // DM: keep the masked player map in sync with fog changes.
  const scene = board?.scene ?? null
  const renderState = useRef<{ busy: boolean; again: boolean }>({ busy: false, again: false })
  const sceneRef = useRef(scene)
  sceneRef.current = scene
  const needsPlayerMap = !!(isDm && scene && scene.bg.kind === 'image' && scene.fogEnabled && scene.mapUrl && scene.playerMapRev < scene.fogRev)
  useEffect(() => {
    if (!needsPlayerMap) return
    const t = window.setTimeout(async function go() {
      const rs = renderState.current
      if (rs.busy) {
        rs.again = true
        return
      }
      rs.busy = true
      try {
        const s = sceneRef.current
        if (s) await renderPlayerMap(campaignId, token, s)
      } catch {
        /* retried on the next fog change or reconnect */
      } finally {
        rs.busy = false
        if (rs.again) {
          rs.again = false
          window.setTimeout(go, 300)
        }
      }
    }, 450)
    return () => clearTimeout(t)
  }, [needsPlayerMap, scene?.fogRev, scene?.id, scene?.mapUrl])

  useEffect(() => {
    if (selectedId && scene && !scene.tokens.some((t) => t.id === selectedId)) setSelectedId(null)
  }, [scene?.tokens, selectedId])

  useEffect(() => {
    if (!isDm && (tool === 'reveal' || tool === 'hide')) setTool('select')
  }, [isDm, tool])

  const me = participants.find((p) => p.id === you?.participantId)
  const myTurn = board && you ? yourTurn(board, you) : false
  const currentTokenId = useMemo(() => board?.initiative.entries.find((e) => e.id === board.initiative.currentId)?.tokenId ?? null, [board?.initiative])
  const selected = selectedId ? scene?.tokens.find((t) => t.id === selectedId) ?? null : null

  if (status === 'fatal' || status === 'kicked') {
    return (
      <FullMessage title={status === 'kicked' ? 'You have left this table' : 'Could not open this table'}>
        <p className="muted">{state.error}</p>
        <Link className="btn" to="/">Go home</Link>
      </FullMessage>
    )
  }

  if (!board || !campaign || !you || !client) {
    return (
      <div className="table-app">
        <div className="topbar"><Link to="/" className="brand"><BrandMark /> {PRODUCT}</Link><span className="conn"><Wifi size={14} /> Connecting to the table...</span></div>
        <div className="workspace">
          <div className="side"><div className="side-body stack"><div className="skeleton" style={{ height: 120 }} /><div className="skeleton" style={{ height: 80 }} /></div></div>
          <div className="map-wrap"><div className="map-empty"><div className="skeleton" style={{ width: '60%', height: '60%' }} /></div></div>
          <div className="side right"><div className="side-body stack"><div className="skeleton" style={{ height: 40 }} /><div className="skeleton" style={{ height: 40 }} /></div></div>
        </div>
      </div>
    )
  }

  const live = campaign.status === 'live'
  const online = participants.filter((p) => p.online)
  const leftTabs = isDm ? DM_TABS.filter((t) => t.id !== 'guide' || board.guide) : [
    { id: 'character', label: 'Character', icon: User },
    { id: 'party', label: 'Party', icon: Users },
  ]
  const activeLeft = isDm ? dmTab : playerTab
  const setLeft = (id: string) => (isDm ? setDmTab(id as DmTab) : setPlayerTab(id as 'character' | 'party'))
  const showOnboarding = !onboarded[campaignId]

  return (
    <div className="table-app">
      <header className="topbar">
        <Link to="/" className="brand hide-sm" title="Home"><BrandMark /></Link>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: '0.5rem' }}>
            <span className="title">{campaign.name}</span>
            <span className={`pill ${live ? 'live' : ''}`}>{live ? `Session ${campaign.sessionNumber} live` : campaign.status === 'ended' ? 'Between sessions' : 'Not started'}</span>
            {isDm && <span className="pill dm hide-sm"><Crown size={11} /> You are the DM</span>}
          </div>
        </div>
        <div className="presence hide-sm" title={participants.map((p) => `${p.name}${p.online ? '' : ' (away)'}`).join(', ')}>
          {participants.slice(0, 8).map((p) => (
            <span key={p.id} style={{ opacity: p.online ? 1 : 0.4 }}><Avatar icon={p.avatar} color={p.color} size={28} /></span>
          ))}
          <span className="tiny muted" style={{ marginLeft: '0.5rem' }}>{online.length} online</span>
        </div>
        <span className={`conn ${status === 'open' ? '' : 'bad'}`} title={status === 'open' ? 'Connected' : 'Reconnecting'}>
          {status === 'open' ? <Wifi size={15} /> : <><WifiOff size={15} /> Reconnecting...</>}
        </span>
        {isDm && campaign.inviteCode && (
          <button className="btn sm hide-sm" onClick={() => navigator.clipboard.writeText(inviteUrl(campaign.inviteCode!)).then(() => onInfo('Invite link copied. Paste it in your team chat.'), () => prompt('Invite link', inviteUrl(campaign.inviteCode!)))}>
            <Copy size={14} /> Invite
          </button>
        )}
        <button className={`btn sm ${learnOpen ? 'active' : ''}`} onClick={() => setLearnOpen(!learnOpen)} title="Rules reference and beginner guide">
          <BookOpen size={15} /> <span className="hide-sm">Rules</span>
        </button>
      </header>

      <div className="workspace">
        <aside className={`side ${leftOpen ? '' : 'collapsed'} ${mobile === 'side' ? 'mobile-open' : ''}`} aria-label={isDm ? 'DM dashboard' : 'Character'}>
          <div className="side-head">
            <div className={`side-tabs ${leftTabs.length > 3 ? 'compact' : ''}`} role="tablist">
              {leftTabs.map((t) => (
                <button key={t.id} role="tab" title={t.label} aria-label={t.label} aria-selected={activeLeft === t.id} className={`side-tab ${activeLeft === t.id ? 'on' : ''}`} onClick={() => setLeft(t.id)}>
                  <t.icon size={15} /> <span className="lbl">{t.label}</span>
                </button>
              ))}
            </div>
            <button className="btn ghost icon sm collapse-btn" onClick={() => setLeftOpen(!leftOpen)} aria-label={leftOpen ? 'Collapse panel' : 'Expand panel'}>
              {leftOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
            <div className="vtabs">
              {leftTabs.map((t) => (
                <button key={t.id} className="btn ghost icon sm" title={t.label} onClick={() => { setLeft(t.id); setLeftOpen(true) }}><t.icon size={16} /></button>
              ))}
            </div>
          </div>
          <div className="side-body">
            {isDm ? (
              <DmPanel tab={dmTab} board={board} campaign={campaign} participants={participants} you={you} client={client} token={token} onError={onError} onInfo={onInfo} />
            ) : (
              <PlayerPanel board={board} you={you} participants={participants} client={client} tab={playerTab} onError={onError} />
            )}
          </div>
        </aside>

        <section className="map-wrap" aria-label="Map" style={{ display: 'grid' }}>
          {scene ? (
            <MapView
              scene={scene}
              isDm={isDm}
              you={you}
              characters={board.characters}
              client={client}
              live={live}
              canMove={me?.canMove ?? true}
              tool={tool}
              setTool={setTool}
              brush={brush}
              setBrush={setBrush}
              selectedId={selectedId}
              onSelect={setSelectedId}
              currentTokenId={currentTokenId}
              onError={onError}
            />
          ) : (
            <div className="map-empty"><div className="empty">No scene yet.</div></div>
          )}
          {scene && (
            <div className={`scene-label ${isDm && board.activeSceneId !== scene.id ? 'preview' : ''}`}>
              <MapIcon size={13} /> {scene.name}
              {isDm && board.activeSceneId !== scene.id && <span className="tiny">(preparing, players can't see this)</span>}
            </div>
          )}
          <InitiativeStrip board={board} you={you} />
          <RollToasts client={client} youId={you.participantId} />
          {selected && <TokenCard token={selected} board={board} you={you} isDm={isDm} participants={participants} client={client} onClose={() => setSelectedId(null)} onError={onError} />}
          {diceOpen ? (
            <DiceTray client={client} isDm={isDm} onClose={() => setDiceOpen(false)} onError={onError} canChat={me?.canChat ?? true} />
          ) : null}
          <div className="map-corner">
            {!diceOpen && <button className="btn primary" onClick={() => setDiceOpen(true)}><Dices size={16} /> Dice</button>}
          </div>
          {isDm && !live && (
            <div className="map-banner dm">
              <span className="small">{campaign.sessionNumber === 0 ? 'Players can look around, but tokens stay put until you start.' : 'The session is paused.'}</span>
              <button className="btn gold sm" onClick={() => client.op({ type: campaign.sessionNumber > 0 ? 'session.resume' : 'session.start' })}>
                <Play size={14} /> {campaign.sessionNumber > 0 ? `Resume session ${campaign.sessionNumber}` : 'Start session'}
              </button>
            </div>
          )}
          {!isDm && !live && (
            <div className="map-banner">
              <span className="small">{campaign.sessionNumber === 0 ? 'Waiting for the DM to start the session. Meanwhile, pick a character and say hi in chat.' : 'The session is paused. Your progress is saved.'}</span>
            </div>
          )}
          {!isDm && live && myTurn && (
            <div className="map-banner" style={{ borderColor: 'var(--ember)' }}>
              <strong style={{ color: 'var(--ember-2)' }}>It's your turn!</strong>
              <span className="small muted">Move, then take an action. Tell the DM what you do.</span>
            </div>
          )}
          {showOnboarding && <Onboarding isDm={isDm} isDemo={campaign.isDemo} onClose={() => setOnboarded({ ...onboarded, [campaignId]: true })} onLearn={() => { setOnboarded({ ...onboarded, [campaignId]: true }); setLearnOpen(true) }} />}
        </section>

        <aside className={`side right ${rightOpen ? '' : 'collapsed'} ${mobile === 'chat' ? 'mobile-open' : ''}`} aria-label="Chat">
          <div className="side-head">
            <button className="btn ghost icon sm collapse-btn" onClick={() => setRightOpen(!rightOpen)} aria-label={rightOpen ? 'Collapse chat' : 'Expand chat'}>
              {rightOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            <div className="side-tabs"><span className="side-tab on"><MessageSquare size={14} /> Chat &amp; rolls</span></div>
            <div className="vtabs"><button className="btn ghost icon sm" title="Chat" onClick={() => setRightOpen(true)}><MessageSquare size={16} /></button></div>
          </div>
          <div className="side-body" style={{ padding: 0 }}>
            <Chat messages={messages} client={client} isDm={isDm} youId={you.participantId} canChat={me?.canChat ?? true} />
          </div>
        </aside>
      </div>

      <nav className="mobile-tabs" aria-label="Views">
        <button className={mobile === 'map' ? 'on' : ''} onClick={() => setMobile('map')}><MapIcon size={18} /> Map</button>
        <button className={mobile === 'side' ? 'on' : ''} onClick={() => setMobile('side')}>{isDm ? <Crown size={18} /> : <User size={18} />} {isDm ? 'DM' : 'Character'}</button>
        <button className={mobile === 'chat' ? 'on' : ''} onClick={() => setMobile('chat')}><MessageSquare size={18} /> Chat</button>
        <button onClick={() => { setMobile('map'); setDiceOpen(!diceOpen) }}><Dices size={18} /> Dice</button>
      </nav>

      {learnOpen && <LearnDrawer onClose={() => setLearnOpen(false)} />}
      {toastView}
    </div>
  )
}

function Onboarding({ isDm, isDemo, onClose, onLearn }: { isDm: boolean; isDemo: boolean; onClose: () => void; onLearn: () => void }) {
  return (
    <div className="onboard">
      <div className="modal">
        <p className="kicker">{isDm ? 'Welcome, Dungeon Master' : 'Welcome, adventurer'}</p>
        <h2>{isDm ? (isDemo ? 'Your table is set' : 'Your campaign is ready') : 'Pull up a chair'}</h2>
        {isDm ? (
          <ol className="steps">
            <li><span><strong>Invite your players</strong> with the Invite button at the top. They join from any browser.</span></li>
            {isDemo && <li><span>Open the <strong>Guide</strong> tab on the left: it has a read-aloud intro and the encounter, step by step.</span></li>}
            <li><span>Press <strong>Start session</strong> when everyone is here. Use the <strong>brush</strong> on the map's left edge to reveal the fog as the party explores.</span></li>
            <li><span>In a fight, the <strong>Encounter</strong> tab tracks initiative. Press <strong>Next turn</strong> to move things along.</span></li>
          </ol>
        ) : (
          <ol className="steps">
            <li><span><strong>Pick a character</strong> in the panel on the left if you haven't yet.</span></li>
            <li><span><strong>Drag your token</strong> to move once the DM starts the session. Scroll to zoom, drag the background to pan.</span></li>
            <li><span><strong>Double-click</strong> anywhere on the map to ping it for everyone.</span></li>
            <li><span><strong>Roll dice</strong> with the dice tray, or the one-click buttons on your character. Results show up in chat.</span></li>
          </ol>
        )}
        <p className="small muted">Never played before? That's fine. Tell the DM what your character wants to do, and they'll tell you what to roll.</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onLearn}><BookOpen size={15} /> Quick rules</button>
          <button className="btn primary" onClick={onClose}>Let's play</button>
        </div>
      </div>
    </div>
  )
}

function LearnDrawer({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'reference' | 'basics' | 'links'>('reference')
  const [section, setSection] = useState<string | null>(null)
  const current = learnSections.find((s) => s.id === section)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <aside className="learn-drawer" aria-label="Rules and guides">
      <div className="side-head">
        <div className="side-tabs">
          <button className={`side-tab ${tab === 'reference' ? 'on' : ''}`} onClick={() => setTab('reference')}>Quick reference</button>
          <button className={`side-tab ${tab === 'basics' ? 'on' : ''}`} onClick={() => { setTab('basics'); setSection(null) }}>How to play</button>
          <button className={`side-tab ${tab === 'links' ? 'on' : ''}`} onClick={() => setTab('links')}>Resources</button>
        </div>
        <button className="btn ghost icon sm" onClick={onClose} aria-label="Close rules"><X size={16} /></button>
      </div>
      <div className="side-body">
        {tab === 'reference' && <QuickReference compact />}
        {tab === 'basics' && !current && (
          <div className="stack tight">
            {learnSections.map((s) => (
              <button key={s.id} className="card ref-item" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setSection(s.id)}>
                <strong>{s.title}</strong>
                <p className="small muted" style={{ margin: '0.2rem 0 0' }}>{s.summary.replace(/\*\*/g, '')}</p>
              </button>
            ))}
          </div>
        )}
        {tab === 'basics' && current && (
          <div>
            <button className="btn ghost sm" onClick={() => setSection(null)}><ChevronLeft size={14} /> All topics</button>
            <SectionView section={current} />
          </div>
        )}
        {tab === 'links' && <ResourceList />}
        <Attribution />
      </div>
    </aside>
  )
}
