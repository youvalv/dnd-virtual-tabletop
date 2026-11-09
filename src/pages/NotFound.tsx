import { Link } from 'react-router-dom'
import { SiteShell } from '../components/SiteShell.tsx'

export function NotFound() {
  return (
    <SiteShell>
      <div className="join-wrap">
        <div className="card join-card">
          <p className="kicker">Lost in the dungeon</p>
          <h1>This passage leads nowhere</h1>
          <p className="muted">The page you were looking for does not exist.</p>
          <Link className="btn primary" to="/">Back to the tavern</Link>
        </div>
      </div>
    </SiteShell>
  )
}
