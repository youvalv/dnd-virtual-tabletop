import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './styles.css'
import { Home } from './pages/Home.tsx'
import { Join } from './pages/Join.tsx'
import { LearnPage } from './pages/Learn.tsx'
import { TablePage } from './pages/Table.tsx'
import { NotFound } from './pages/NotFound.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join/:code" element={<Join />} />
        <Route path="/table/:campaignId" element={<TablePage />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/learn/:sectionId" element={<LearnPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
