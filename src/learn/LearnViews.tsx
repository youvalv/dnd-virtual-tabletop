import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { ExternalLink, Search } from 'lucide-react'
import { learnSections, quickReference, resources, SRD_ATTRIBUTION, type Block, type LearnSection, type RefEntry } from './content.ts'

// Renders **bold** inline markup only.
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>))}
    </>
  )
}

function BlockView({ b }: { b: Block }) {
  switch (b.type) {
    case 'p':
      return <p><Rich text={b.text} /></p>
    case 'list':
      return <ul>{b.items.map((t, i) => <li key={i}><Rich text={t} /></li>)}</ul>
    case 'steps':
      return <ol>{b.items.map((t, i) => <li key={i}><Rich text={t} /></li>)}</ol>
    case 'callout':
      return (
        <div className="callout">
          <h4>{b.title}</h4>
          <p><Rich text={b.text} /></p>
        </div>
      )
    case 'table':
      return (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr>{b.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
            <tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}><Rich text={c} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      )
  }
}

export function SectionView({ section }: { section: LearnSection }) {
  return (
    <article className="prose">
      <p className="kicker">{section.kicker}</p>
      <h2>{section.title}</h2>
      <p className="muted" style={{ fontSize: '1.08rem' }}><Rich text={section.summary} /></p>
      {section.blocks.map((b, i) => <BlockView key={i} b={b} />)}
    </article>
  )
}

const CATEGORIES = ['All', 'Condition', 'Rule', 'Combat', 'Action', 'Dice', 'Resting'] as const

function matches(e: RefEntry, q: string) {
  if (!q) return true
  const hay = [e.term, e.summary, e.category, ...(e.keywords ?? []), ...e.details].join(' ').toLowerCase()
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))
}

export function QuickReference({ compact = false, initialQuery = '' }: { compact?: boolean; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery)
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>('All')
  const list = useMemo(
    () =>
      quickReference
        .filter((e) => (cat === 'All' || e.category === cat) && matches(e, q))
        .sort((a, b) => {
          // Exact term matches first, then alphabetical.
          const qa = q && a.term.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1
          const qb = q && b.term.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1
          return qa - qb || a.term.localeCompare(b.term)
        }),
    [q, cat],
  )
  return (
    <div className="stack">
      <div className="ref-search">
        <Search size={16} />
        <input className="input" placeholder="Search rules: prone, advantage, grapple, death saves..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the rules reference" />
      </div>
      <div className="ref-cats">
        {CATEGORIES.map((c) => (
          <button key={c} className={`btn xs ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
            {c === 'All' ? 'All' : c === 'Resting' ? 'Rests' : `${c}s`}
          </button>
        ))}
      </div>
      <p className="tiny faint" style={{ margin: 0 }}>{list.length} {list.length === 1 ? 'entry' : 'entries'}</p>
      <div className="ref-list">
        {list.map((e) => (
          <details key={e.id} className="card ref-item" open={!compact && list.length <= 3}>
            <summary>
              <strong>{e.term}</strong>
              <span className="pill">{e.category}</span>
            </summary>
            <p className="small" style={{ margin: '0.35rem 0 0' }}><Rich text={e.summary} /></p>
            {e.details.length > 0 && <ul>{e.details.map((d, i) => <li key={i}><Rich text={d} /></li>)}</ul>}
          </details>
        ))}
        {list.length === 0 && <div className="empty">No rules match "{q}". Try a shorter word, like "prone" or "cover".</div>}
      </div>
    </div>
  )
}

export function ResourceList() {
  return (
    <div className="resource-list">
      {resources.map((r) => (
        <a key={r.url} className="card resource" href={r.url} target="_blank" rel="noreferrer">
          <strong>{r.title} <ExternalLink size={13} /></strong>
          <span className="tiny pill" style={{ margin: '0.25rem 0' }}>{r.kind}</span>
          <span className="small muted" style={{ display: 'block' }}>{r.description}</span>
        </a>
      ))}
    </div>
  )
}

export function Attribution({ children }: { children?: ReactNode }) {
  return (
    <p className="attribution">
      {children}
      Rules text is based on the System Reference Document 5.2.1. {SRD_ATTRIBUTION}
    </p>
  )
}

export { learnSections }
