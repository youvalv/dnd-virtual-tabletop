import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { SiteShell } from '../components/SiteShell.tsx'
import { Attribution, QuickReference, ResourceList, SectionView, learnSections } from '../learn/LearnViews.tsx'

export function LearnPage() {
  const { sectionId } = useParams()
  const isRef = sectionId === 'reference'
  const isRes = sectionId === 'resources'
  const idx = learnSections.findIndex((s) => s.id === sectionId)
  const section = idx >= 0 ? learnSections[idx] : !sectionId ? learnSections[0] : null
  const i = section ? learnSections.indexOf(section) : -1

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [sectionId])

  return (
    <SiteShell>
      <div className="container learn-layout">
        <nav className="learn-toc" aria-label="Learn D&D">
          {learnSections.map((s) => (
            <Link key={s.id} to={`/learn/${s.id}`} className={section?.id === s.id ? 'on' : ''}>
              {s.title}
            </Link>
          ))}
          <Link to="/learn/reference" className={isRef ? 'on' : ''}>Quick rules reference</Link>
          <Link to="/learn/resources" className={isRes ? 'on' : ''}>Official resources</Link>
        </nav>
        <div>
          {section && (
            <>
              <SectionView section={section} />
              <div className="section-nav prose">
                {i > 0 ? (
                  <Link className="btn ghost" to={`/learn/${learnSections[i - 1].id}`}><ArrowLeft size={16} /> {learnSections[i - 1].title}</Link>
                ) : <span />}
                {i < learnSections.length - 1 ? (
                  <Link className="btn" to={`/learn/${learnSections[i + 1].id}`}>{learnSections[i + 1].title} <ArrowRight size={16} /></Link>
                ) : (
                  <Link className="btn primary" to="/learn/reference">Quick rules reference <ArrowRight size={16} /></Link>
                )}
              </div>
            </>
          )}
          {isRef && (
            <div className="prose" style={{ maxWidth: '52rem' }}>
              <p className="kicker">Look it up mid-game</p>
              <h2>Quick rules reference</h2>
              <p className="muted">Conditions, actions and the rules that come up most often. During a game you can open this from the book icon at the top of the table without leaving the map.</p>
              <QuickReference />
            </div>
          )}
          {isRes && (
            <div className="prose" style={{ maxWidth: '52rem' }}>
              <p className="kicker">Go further</p>
              <h2>Official and beginner resources</h2>
              <p className="muted">The free official rules, a character builder for making your own hero, and a few good places to start.</p>
              <ResourceList />
            </div>
          )}
          {!section && !isRef && !isRes && (
            <div className="prose">
              <h2>Page not found</h2>
              <Link to="/learn">Start at the beginning</Link>
            </div>
          )}
          <div className="prose">
            <Attribution />
          </div>
        </div>
      </div>
    </SiteShell>
  )
}
