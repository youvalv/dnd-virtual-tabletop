import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { SiteShell } from '../components/SiteShell.tsx'
import { api, getCredential, saveCredential } from '../lib/api.ts'
import { Avatar, Icon } from '../lib/icons.tsx'
import { AVATARS, TOKEN_COLORS } from '../../shared/presets.ts'

interface InviteInfo {
  campaignId: string
  name: string
  status: string
  isDemo: boolean
  dmName: string
  players: number
  maxPlayers: number
  characters: { id: string; name: string; summary: string; icon: string; color: string; claimed: boolean }[]
}

export function Join() {
  const { code = '' } = useParams()
  const nav = useNavigate()
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState(() => localStorage.getItem('hearthlight.name') || '')
  const [avatar, setAvatar] = useState(AVATARS[Math.floor(Math.random() * AVATARS.length)])
  const [color, setColor] = useState(TOKEN_COLORS[Math.floor(Math.random() * TOKEN_COLORS.length)])
  const [characterId, setCharacterId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<InviteInfo>(`/api/invite/${code}`)
      .then(setInfo)
      .catch((e) => setLoadError(e.message))
  }, [code])

  const existing = info ? getCredential(info.campaignId) : null

  async function join(e: React.FormEvent) {
    e.preventDefault()
    if (!info) return
    setBusy(true)
    setError(null)
    try {
      const r = await api<{ campaignId: string; participantId: string; token: string; name: string }>(`/api/invite/${code}/join`, {
        method: 'POST',
        json: { name, avatar, color, characterId },
      })
      localStorage.setItem('hearthlight.name', name)
      saveCredential({ campaignId: r.campaignId, participantId: r.participantId, token: r.token, role: 'player', name: r.name })
      nav(`/table/${r.campaignId}`)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <SiteShell>
      <div className="join-wrap">
        <div className="card join-card">
          {loadError && (
            <>
              <p className="kicker">Invite</p>
              <h1>That door is locked</h1>
              <p className="muted">{loadError}</p>
              <Link to="/" className="btn">Back home</Link>
            </>
          )}
          {!info && !loadError && (
            <div className="stack">
              <div className="skeleton" style={{ height: 24, width: '40%' }} />
              <div className="skeleton" style={{ height: 44 }} />
              <div className="skeleton" style={{ height: 160 }} />
            </div>
          )}
          {info && (
            <form className="stack" onSubmit={join}>
              <div>
                <p className="kicker">You are invited by {info.dmName}</p>
                <h1 style={{ fontSize: '2.2rem' }}>{info.name}</h1>
                <p className="muted small" style={{ margin: 0 }}>
                  {info.players} of {info.maxPlayers} players have joined.{' '}
                  {info.status === 'live' ? 'The session is in progress.' : 'The session has not started yet, but you can settle in.'}
                </p>
              </div>
              {existing && (
                <div className="callout" style={{ margin: 0 }}>
                  <h4>You already have a seat at this table</h4>
                  <p className="small">
                    This browser is already part of this campaign. <Link to={`/table/${info.campaignId}`}>Go back to the table</Link> instead of joining again.
                  </p>
                </div>
              )}
              <label className="field">
                <span>Your display name</span>
                <input className="input" required maxLength={32} value={name} onChange={(e) => setName(e.target.value)} placeholder="What should the table call you?" autoFocus />
              </label>
              <div className="field">
                <span className="muted small" style={{ fontWeight: 500 }}>Pick an avatar</span>
                <div className="row" style={{ alignItems: 'flex-start', gap: '0.9rem' }}>
                  <Avatar icon={avatar} color={color} size={56} />
                  <div className="stack tight grow">
                    <div className="avatar-grid" role="radiogroup" aria-label="Avatar">
                      {AVATARS.map((a) => (
                        <button type="button" key={a} className={`avatar-btn ${a === avatar ? 'on' : ''}`} onClick={() => setAvatar(a)} aria-label={a} aria-pressed={a === avatar}>
                          <Icon name={a} size={20} />
                        </button>
                      ))}
                    </div>
                    <div className="swatches" role="radiogroup" aria-label="Color">
                      {TOKEN_COLORS.map((c) => (
                        <button type="button" key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Color ${c}`} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {info.characters.length > 0 && (
                <div className="field">
                  <span className="muted small" style={{ fontWeight: 500 }}>Choose a ready-made character (optional, you can also pick later)</span>
                  <div className="char-pick">
                    {info.characters.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        disabled={c.claimed}
                        className={`char-opt ${characterId === c.id ? 'on' : ''}`}
                        onClick={() => setCharacterId(characterId === c.id ? null : c.id)}
                      >
                        <Avatar icon={c.icon} color={c.color} size={34} />
                        <span>
                          <strong>{c.name}</strong>
                          <br />
                          <span className="tiny muted">{c.claimed ? 'Already taken' : c.summary}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {error && <p className="err">{error}</p>}
              <div className="row between wrap">
                <span className="tiny faint">No account needed. This browser remembers your seat.</span>
                <button className="btn primary lg" disabled={busy || !name.trim()}>
                  {busy ? 'Joining...' : 'Take a seat'} <ArrowRight size={18} />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </SiteShell>
  )
}
