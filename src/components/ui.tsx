import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { CONDITIONS } from '../../shared/presets.ts'
import { quickReference } from '../learn/content.ts'

export function HpBar({ hp, max, health }: { hp: number | null; max: number | null; health?: number }) {
  const ratio = hp !== null && max ? Math.max(0, Math.min(1, hp / max)) : (health ?? 4) / 4
  const cls = ratio > 0.5 ? '' : ratio > 0.25 ? 'mid' : 'low'
  return (
    <div className={`hp-bar ${cls}`} title={hp !== null && max !== null ? `${hp} / ${max} HP` : healthLabel(health ?? 4)}>
      <i style={{ width: `${ratio * 100}%` }} />
    </div>
  )
}

export function healthLabel(h: number) {
  return ['Down', 'Badly hurt', 'Bloodied', 'Scratched', 'Unhurt'][h] ?? 'Unknown'
}

/** Number input that commits on blur or Enter, so typing doesn't spam the server. */
export function NumberField({ value, onCommit, min = -999, max = 9999, className = 'input sm num', title, ariaLabel }: {
  value: number
  onCommit: (v: number) => void
  min?: number
  max?: number
  className?: string
  title?: string
  ariaLabel?: string
}) {
  const [draft, setDraft] = useState(String(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setDraft(String(value))
  }, [value])
  const commit = () => {
    const n = Math.round(Number(draft))
    if (Number.isFinite(n)) {
      const v = Math.max(min, Math.min(max, n))
      if (v !== value) onCommit(v)
      setDraft(String(v))
    } else setDraft(String(value))
  }
  return (
    <input
      className={className}
      inputMode="numeric"
      value={draft}
      title={title}
      aria-label={ariaLabel ?? title}
      onFocus={(e) => {
        focused.current = true
        e.target.select()
      }}
      onBlur={() => {
        focused.current = false
        commit()
      }}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setDraft(String(value))
          ;(e.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}

/** Text area that saves after a pause in typing and on blur. */
export function AutoSaveText({ value, onSave, placeholder, rows = 4, delay = 800, maxLength }: {
  value: string
  onSave: (v: string) => void
  placeholder?: string
  rows?: number
  delay?: number
  maxLength?: number
}) {
  const [draft, setDraft] = useState(value)
  const [saved, setSaved] = useState(true)
  const timer = useRef<number | null>(null)
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setDraft(value)
  }, [value])
  const flush = (v: string) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (v !== value) onSave(v)
    setSaved(true)
  }
  return (
    <div className="stack tight">
      <textarea
        className="textarea"
        rows={rows}
        value={draft}
        maxLength={maxLength}
        placeholder={placeholder}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false
          flush(draft)
        }}
        onChange={(e) => {
          const v = e.target.value
          setDraft(v)
          setSaved(false)
          if (timer.current) clearTimeout(timer.current)
          timer.current = window.setTimeout(() => flush(v), delay)
        }}
      />
      <span className="tiny faint">{saved ? 'Saved' : 'Saving...'}</span>
    </div>
  )
}

const condInfo = new Map(quickReference.filter((r) => r.category === 'Condition').map((r) => [r.term.toLowerCase(), r.summary]))

export function conditionHelp(name: string) {
  return condInfo.get(name.toLowerCase()) ?? ''
}

export function ConditionPicker({ value, onChange, compact }: { value: string[]; onChange: (v: string[]) => void; compact?: boolean }) {
  const [open, setOpen] = useState(!compact)
  return (
    <div className="stack tight">
      <div className="row wrap" style={{ gap: '0.25rem' }}>
        {value.length === 0 && <span className="tiny faint">No conditions</span>}
        {value.map((c) => (
          <span key={c} className="chip" title={conditionHelp(c)}>
            {c}
            <button onClick={() => onChange(value.filter((x) => x !== c))} aria-label={`Remove ${c}`}><X size={11} /></button>
          </span>
        ))}
        {compact && (
          <button className="btn xs ghost" onClick={() => setOpen(!open)}>{open ? 'Done' : '+ Condition'}</button>
        )}
      </div>
      {open && (
        <div className="cond-picker">
          {CONDITIONS.map((c) => (
            <button key={c} className={value.includes(c) ? 'on' : ''} title={conditionHelp(c)} onClick={() => onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c])}>
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">{children}</div>
    </div>
  )
}

export interface Toast {
  id: number
  text: string
  kind: 'info' | 'error'
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = (text: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-3), { id, text, kind }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 5000 : 3000)
  }
  const view = (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>
      ))}
    </div>
  )
  return { push, view }
}

export function timeLabel(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
