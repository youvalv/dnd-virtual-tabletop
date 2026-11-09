import { useEffect, useMemo, useRef, useState } from 'react'
import { Dices, Lock, Send, X } from 'lucide-react'
import type { ChatMessage, RollResult } from '../../shared/types.ts'
import { isValidDice } from '../../shared/dice.ts'
import type { GameClient } from '../lib/game.ts'
import { timeLabel } from '../components/ui.tsx'

export function RollCard({ roll, isPrivate }: { roll: RollResult; isPrivate?: boolean }) {
  return (
    <div className={`roll-card ${isPrivate ? 'private' : ''}`}>
      <div className="roll-head">
        <span className="small muted">
          {roll.label ? <strong style={{ color: 'var(--text)' }}>{roll.label} </strong> : null}
          <code style={{ fontSize: '0.85em' }}>{roll.expr}</code>
        </span>
        <span className={`roll-total ${roll.natural ?? ''}`}>{roll.total}</span>
      </div>
      <div className="roll-dice">
        {roll.terms.map((t, i) => (
          <span key={i} className="row" style={{ gap: '0.25rem' }}>
            {(i > 0 || t.sign < 0) && <span className="roll-mod">{t.sign < 0 ? '−' : '+'}</span>}
            {t.kind === 'mod' ? (
              <span className="roll-mod">{t.value}</span>
            ) : (
              t.rolls!.map((d, j) => (
                <span
                  key={j}
                  className={`die-face ${t.sides === 20 ? 'd20' : ''} ${d.value === t.sides ? 'max' : d.value === 1 ? 'min' : ''} ${d.kept ? '' : 'drop'}`}
                  title={`d${t.sides}`}
                >
                  {d.value}
                </span>
              ))
            )}
          </span>
        ))}
      </div>
      {roll.natural === 'crit' && <span className="tiny" style={{ color: '#9fe07a' }}>Natural 20! On an attack, that is a critical hit.</span>}
      {roll.natural === 'fumble' && <span className="tiny" style={{ color: '#f08a78' }}>Natural 1. On an attack, that is an automatic miss.</span>}
    </div>
  )
}

export function Chat({ messages, client, isDm, youId, canChat }: { messages: ChatMessage[]; client: GameClient; isDm: boolean; youId: string; canChat: boolean }) {
  const [filter, setFilter] = useState<'all' | 'rolls'>('all')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const shown = useMemo(() => (filter === 'rolls' ? messages.filter((m) => m.kind === 'roll') : messages), [messages, filter])

  useEffect(() => {
    const el = logRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [shown.length])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    setText('')
    setError(null)
    const r = await client.op({ type: 'chat.send', text: t })
    if (!r.ok) {
      setError(r.error ?? 'Could not send.')
      setText(t)
    }
  }

  return (
    <div className="chat">
      <div className="chat-filter">
        <button className={`btn xs ${filter === 'all' ? 'active' : 'ghost'}`} onClick={() => setFilter('all')}>Everything</button>
        <button className={`btn xs ${filter === 'rolls' ? 'active' : 'ghost'}`} onClick={() => setFilter('rolls')}><Dices size={12} /> Roll history</button>
      </div>
      <div
        className="chat-log"
        ref={logRef}
        onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
        }}
        aria-live="polite"
      >
        {shown.length === 0 && (
          <div className="empty">
            {filter === 'rolls' ? 'No rolls yet. Click a die in the dice tray, or type /roll 1d20+3.' : 'Say hello to your party! Messages and dice rolls appear here for everyone.'}
          </div>
        )}
        {shown.map((m) =>
          m.kind === 'system' ? (
            <div key={m.id} className="msg system">{m.text}</div>
          ) : (
            <div key={m.id} className={`msg ${m.private ? 'private' : ''}`}>
              <div className="msg-head">
                <b style={{ color: m.authorColor }}>{m.authorName}</b>
                {m.authorRole === 'dm' && <span className="pill dm" style={{ fontSize: '0.65rem', padding: '0 0.35rem' }}>DM</span>}
                {m.authorId === youId && <span className="tiny faint">you</span>}
                <time dateTime={m.createdAt}>{timeLabel(m.createdAt)}</time>
              </div>
              {m.roll ? <RollCard roll={m.roll} isPrivate={m.private} /> : <div className="msg-text">{m.text}</div>}
            </div>
          ),
        )}
      </div>
      <div className="chat-input">
        {error && <span className="err small">{error}</span>}
        <form onSubmit={send}>
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={canChat ? 'Message, or /roll 1d20+5' : 'The DM has muted chat for you'}
            disabled={!canChat}
            maxLength={1000}
            aria-label="Chat message"
          />
          <button className="btn primary icon" disabled={!canChat || !text.trim()} aria-label="Send"><Send size={16} /></button>
        </form>
        <span className="chat-hint">
          <code>/roll 2d6+3</code> rolls for everyone{isDm ? <> · <code>/pr 1d20</code> rolls privately</> : null} · add <code># label</code> to name a roll
        </span>
      </div>
    </div>
  )
}

const DICE = [4, 6, 8, 10, 12, 20, 100]

function DieShape({ sides }: { sides: number }) {
  const shapes: Record<number, string> = {
    4: 'M12 2 22 20H2z',
    6: 'M4 4h16v16H4z',
    8: 'M12 1 22 12 12 23 2 12z',
    10: 'M12 1 22 9 12 23 2 9z',
    12: 'M12 1.5 21.5 8.4 17.9 19.6H6.1L2.5 8.4z',
    20: 'M12 1 21.5 6.5v11L12 23 2.5 17.5v-11z',
    100: 'M12 1 22 9 12 23 2 9z',
  }
  return (
    <svg className="shape" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet">
      <path d={shapes[sides]} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

export function DiceTray({ client, isDm, onClose, onError, canChat }: { client: GameClient; isDm: boolean; onClose: () => void; onError: (m: string) => void; canChat: boolean }) {
  const [count, setCount] = useState(1)
  const [mod, setMod] = useState(0)
  const [mode, setMode] = useState<'normal' | 'adv' | 'dis'>('normal')
  const [priv, setPriv] = useState(false)
  const [custom, setCustom] = useState('')

  const roll = async (expr: string, label?: string) => {
    const r = await client.op({ type: 'dice.roll', expr, label, private: isDm && priv })
    if (!r.ok && r.error) onError(r.error)
  }
  const rollDie = (sides: number) => {
    const m = mod === 0 ? '' : mod > 0 ? `+${mod}` : `${mod}`
    if (sides === 20 && mode !== 'normal' && count === 1) return roll(`1d20${m} ${mode}`, mode === 'adv' ? 'Advantage' : 'Disadvantage')
    return roll(`${count}d${sides}${m}`)
  }
  return (
    <div className="dice-tray" role="group" aria-label="Dice tray">
      <div className="row between" style={{ marginBottom: '0.4rem' }}>
        <strong style={{ fontFamily: 'var(--font-display)' }}>Roll dice</strong>
        <button className="btn ghost xs icon" onClick={onClose} aria-label="Close dice tray"><X size={14} /></button>
      </div>
      <div className="dice-row">
        {DICE.map((d) => (
          <button key={d} className={`die-btn ${d === 20 ? 'd20' : ''}`} onClick={() => rollDie(d)} disabled={!canChat} title={`Roll ${count}d${d}${mod ? (mod > 0 ? `+${mod}` : mod) : ''}`}>
            <DieShape sides={d} />
            <span>d{d === 100 ? '%' : d}</span>
          </button>
        ))}
        <button className="die-btn" onClick={() => roll('2d20kh1', 'Advantage')} disabled={!canChat} title="Roll with advantage: 2d20, keep the higher">
          <span style={{ fontSize: '0.7rem', lineHeight: 1.1 }}>ADV<br />2d20</span>
        </button>
      </div>
      <div className="dice-opts">
        <span className="tiny faint">Dice</span>
        <span className="stepper">
          <button onClick={() => setCount(Math.max(1, count - 1))} aria-label="Fewer dice">−</button>
          <span>{count}</span>
          <button onClick={() => setCount(Math.min(10, count + 1))} aria-label="More dice">+</button>
        </span>
        <span className="tiny faint">Bonus</span>
        <span className="stepper">
          <button onClick={() => setMod(Math.max(-10, mod - 1))} aria-label="Lower bonus">−</button>
          <span>{mod >= 0 ? `+${mod}` : mod}</span>
          <button onClick={() => setMod(Math.min(20, mod + 1))} aria-label="Raise bonus">+</button>
        </span>
      </div>
      <div className="dice-opts">
        <span className="tiny faint">d20</span>
        <div className="seg">
          <button className={mode === 'dis' ? 'on' : ''} onClick={() => setMode('dis')} title="Disadvantage: roll two d20s, keep the lower">Dis</button>
          <button className={mode === 'normal' ? 'on' : ''} onClick={() => setMode('normal')}>Normal</button>
          <button className={mode === 'adv' ? 'on' : ''} onClick={() => setMode('adv')} title="Advantage: roll two d20s, keep the higher">Adv</button>
        </div>
        {isDm && (
          <button className={`btn xs ${priv ? 'active' : ''}`} onClick={() => setPriv(!priv)} title="Private rolls are only visible to you" style={{ marginLeft: 'auto' }}>
            <Lock size={11} /> {priv ? 'Private' : 'Public'}
          </button>
        )}
      </div>
      <form
        className="row"
        style={{ marginTop: '0.45rem' }}
        onSubmit={(e) => {
          e.preventDefault()
          if (!isValidDice(custom)) return onError('Try something like 1d20+5, 2d6 or 4d6kh3.')
          void roll(custom)
          setCustom('')
        }}
      >
        <input className="input sm" placeholder="Any roll: 3d6+2" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Custom dice expression" />
        <button className="btn sm" disabled={!custom.trim()}>Roll</button>
      </form>
    </div>
  )
}

/** Short-lived overlay so everyone notices new rolls without opening chat. */
export function RollToasts({ client, youId }: { client: GameClient; youId: string }) {
  const [items, setItems] = useState<(ChatMessage & { key: number })[]>([])
  useEffect(
    () =>
      client.onMessages((msgs) => {
        const rolls = msgs.filter((m) => m.kind === 'roll' && m.roll)
        if (!rolls.length) return
        setItems((list) => [...list, ...rolls.map((m) => ({ ...m, key: m.id }))].slice(-3))
        for (const m of rolls) window.setTimeout(() => setItems((list) => list.filter((x) => x.key !== m.id)), 4500)
      }),
    [client],
  )
  if (!items.length) return null
  return (
    <div className="roll-toasts" aria-live="polite">
      {items.map((m) => (
        <div key={m.key} className="roll-toast" style={{ ['--c' as string]: m.authorColor }}>
          <div className="row between" style={{ marginBottom: '0.25rem' }}>
            <strong className="small" style={{ color: m.authorColor }}>{m.authorId === youId ? 'You' : m.authorName}{m.private ? ' (private)' : ''}</strong>
            <span className="tiny faint">{m.roll!.label ?? m.roll!.expr}</span>
          </div>
          <RollCard roll={m.roll!} isPrivate={m.private} />
        </div>
      ))}
    </div>
  )
}
