import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { BrandMark } from '../lib/icons.tsx'
import { SRD_ATTRIBUTION } from '../learn/content.ts'

export const PRODUCT = 'Hearthlight'

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="site">
      <header className="site-nav">
        <Link to="/" className="brand">
          <BrandMark /> {PRODUCT}
        </Link>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'on' : '')}>Play</NavLink>
          <NavLink to="/learn" className={({ isActive }) => (isActive ? 'on' : '')}>Learn D&amp;D</NavLink>
          <NavLink to="/learn/reference" className={({ isActive }) => (isActive ? 'on' : '')}>Rules reference</NavLink>
        </nav>
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-footer">
        <div className="container">
          <p>{PRODUCT} is an unofficial fan tool and is not affiliated with Wizards of the Coast. The Ruined Watchtower adventure, its map and its characters are original.</p>
          <p style={{ margin: 0 }}>{SRD_ATTRIBUTION}</p>
        </div>
      </footer>
    </div>
  )
}
