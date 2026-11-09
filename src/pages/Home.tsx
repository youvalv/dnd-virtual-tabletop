import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, Castle, Dices, Map as MapIcon, Swords, Trash2, Users } from 'lucide-react'
import { SiteShell } from '../components/SiteShell.tsx'
import { api, forgetCredential, loadCredentials, saveCredential } from '../lib/api.ts'

interface Created {
  campaignId: string
  participantId: string
  token: string
  role: 'dm'
  name: string
}

export function Home() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [dmName, setDmName] = useState('')
  const [busy, setBusy] = useState<'demo' | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [tables, setTables] = useState(loadCredentials)

  async function create(demo: boolean) {
    setBusy(demo ? 'demo' : 'new')
    setError(null)
    try {
      const r = await api<Created>('/api/campaigns', { method: 'POST', json: { demo, name: demo ? undefined : name, dmName } })
      saveCredential({ campaignId: r.campaignId, participantId: r.participantId, token: r.token, role: 'dm', name: r.name })
      nav(`/table/${r.campaignId}`)
    } catch (e) {
      setError((e as Error).message)
      setBusy(null)
    }
  }

  function joinByCode(e: React.FormEvent) {
    e.preventDefault()
    const m = code.trim().match(/([a-z0-9]{6,})\/?$/i)
    if (m) nav(`/join/${m[1].toLowerCase()}`)
  }

  return (
    <SiteShell>
      <div className="container">
        <section className="hero">
          <div>
            <p className="kicker">A virtual tabletop for small, friendly parties</p>
            <h1>
              Gather your party.
              <br />
              <em>Roll for adventure.</em>
            </h1>
            <p className="lede">
              Host a Dungeons &amp; Dragons game for up to ten friends right in the browser: a shared battle map, tokens, fog of war, chat and dice.
              Players join with a link. No accounts, no installs, and no rules homework.
            </p>
            <div className="start-box">
              <div className="row wrap">
                <button className="btn primary lg" onClick={() => create(true)} disabled={!!busy}>
                  <Castle size={18} /> {busy === 'demo' ? 'Setting the table...' : 'Run the demo: The Ruined Watchtower'}
                </button>
              </div>
              <p className="small muted" style={{ margin: 0 }}>
                The demo comes with a map, four ready-to-play characters, monsters and a step-by-step guide for the DM. It takes about an hour to play.
              </p>
              {error && <p className="err">{error}</p>}
            </div>
          </div>
          <figure className="hero-art" style={{ margin: 0 }}>
            <img
              src="/.netlify/images?url=/img/hero.webp&w=900&fm=webp&q=75"
              srcSet="/.netlify/images?url=/img/hero.webp&w=600&fm=webp&q=72 600w, /.netlify/images?url=/img/hero.webp&w=900&fm=webp&q=75 900w, /.netlify/images?url=/img/hero.webp&w=1300&fm=webp&q=75 1300w"
              sizes="(max-width: 900px) 100vw, 45vw"
              alt="Candle-lit table with a dungeon map, miniatures and polyhedral dice"
              width={900}
              height={502}
            />
            <figcaption>Everything you need for game night, minus the snacks.</figcaption>
          </figure>
        </section>

        <section className="paths">
          <div className="card path featured">
            <span className="num">I</span>
            <h3>Start your own campaign</h3>
            <p className="muted small">You will be the Dungeon Master. You get an invite link for players and a dashboard for the map, monsters and initiative.</p>
            <div className="stack tight">
              <input className="input" placeholder="Campaign name, e.g. The Salt Road" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
              <div className="row">
                <input className="input" placeholder="Your name (optional)" value={dmName} onChange={(e) => setDmName(e.target.value)} maxLength={32} />
                <button className="btn" onClick={() => create(false)} disabled={!!busy}>
                  {busy === 'new' ? 'Creating...' : 'Create'} <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
          <form className="card path" onSubmit={joinByCode}>
            <span className="num">II</span>
            <h3>Join a game</h3>
            <p className="muted small">Got an invite link from your DM? Open it, or paste it here.</p>
            <div className="row">
              <input className="input" placeholder="Invite link or code" value={code} onChange={(e) => setCode(e.target.value)} />
              <button className="btn" type="submit">Join</button>
            </div>
          </form>
          <div className="card path">
            <span className="num">III</span>
            <h3>New to D&amp;D?</h3>
            <p className="muted small">Read a five-minute primer on what the game is, how dice work, and what to do on your turn.</p>
            <Link className="btn" to="/learn">
              <BookOpen size={16} /> Learn the basics
            </Link>
          </div>
        </section>

        {tables.length > 0 && (
          <section style={{ marginBottom: '3rem' }}>
            <h2>Your tables</h2>
            <p className="muted small">Saved in this browser so you can pick up where you left off.</p>
            <div className="tables-list">
              {tables.map((t) => (
                <div key={t.campaignId} className="card table-item">
                  <span className={`pill ${t.role === 'dm' ? 'dm' : ''}`}>{t.role === 'dm' ? 'DM' : 'Player'}</span>
                  <Link className="name grow" to={`/table/${t.campaignId}`}>{t.name}</Link>
                  <span className="tiny faint hide-sm">{new Date(t.savedAt).toLocaleDateString()}</span>
                  <Link className="btn sm" to={`/table/${t.campaignId}`}>Open</Link>
                  <button
                    className="btn ghost icon sm"
                    title="Forget this table on this device"
                    onClick={() => {
                      if (t.role === 'dm' && !confirm('This removes your DM key from this browser. Unless you saved the DM link from the Session tab, you will not be able to run this campaign again. Continue?')) return
                      forgetCredential(t.campaignId)
                      setTables(loadCredentials())
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section style={{ marginBottom: '2rem' }}>
          <h2>How a game night works</h2>
          <ol className="how" style={{ padding: 0 }}>
            <li>
              <strong><Users size={16} style={{ verticalAlign: '-2px' }} /> Invite your party</strong>
              <span className="muted small">Send the invite link in your team chat. Players pick a name, an avatar and a ready-made hero.</span>
            </li>
            <li>
              <strong><MapIcon size={16} style={{ verticalAlign: '-2px' }} /> Explore the map</strong>
              <span className="muted small">The DM reveals the map as you explore. Drag your token, and ping a spot to point things out.</span>
            </li>
            <li>
              <strong><Dices size={16} style={{ verticalAlign: '-2px' }} /> Roll the dice</strong>
              <span className="muted small">One click rolls a d20. Results land in chat for everyone, so there is no "trust me, it was a 19".</span>
            </li>
            <li>
              <strong><Swords size={16} style={{ verticalAlign: '-2px' }} /> Fight in turns</strong>
              <span className="muted small">The initiative tracker shows whose turn it is. Everything is saved, so you can continue next week.</span>
            </li>
          </ol>
          <p className="small faint">Bring your own voice call: {`Hearthlight`} works alongside Zoom, Meet, Discord or whatever your team already uses.</p>
        </section>
      </div>
    </SiteShell>
  )
}
