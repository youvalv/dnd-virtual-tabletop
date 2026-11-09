import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EyeOff, Locate, Maximize, Minus, MousePointer2, Plus, Radio, Square, Paintbrush, Eraser } from 'lucide-react'
import type { CharacterView, PingEvent, SceneView, TokenView, YouInfo } from '../../shared/types.ts'
import type { GameClient } from '../lib/game.ts'
import { ICONS } from '../lib/icons.tsx'

export const CELL = 50
export type Tool = 'select' | 'ping' | 'reveal' | 'hide'
export interface FogBrush {
  shape: 'brush' | 'rect'
  size: 1 | 2 | 3
}

interface Props {
  scene: SceneView
  isDm: boolean
  you: YouInfo
  characters: CharacterView[]
  client: GameClient
  live: boolean
  canMove: boolean
  tool: Tool
  setTool: (t: Tool) => void
  brush: FogBrush
  setBrush: (b: FogBrush) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  currentTokenId: string | null
  onError: (msg: string) => void
}

interface View {
  tx: number
  ty: number
  s: number
}

interface DragState {
  tokenId: string
  pointerId: number
  offX: number
  offY: number
  x: number
  y: number
  startX: number
  startY: number
  moved: boolean
  lastSent: number
}

type Gesture =
  | { kind: 'pan'; pointerId: number; startX: number; startY: number; tx: number; ty: number; moved: boolean }
  | { kind: 'paint'; pointerId: number; reveal: boolean; startCell: [number, number]; cells: Set<number> }
  | { kind: 'pinch'; dist: number; cx: number; cy: number; view: View }
  | null

export function controls(token: TokenView, you: YouInfo, characters: CharacterView[]) {
  if (token.ownerId === you.participantId) return true
  if (token.kind === 'pc' && token.characterId) return characters.find((c) => c.id === token.characterId)?.ownerId === you.participantId
  return false
}

export function MapView(props: Props) {
  const { scene, isDm, you, characters, client, live, canMove, tool, setTool, brush, setBrush, selectedId, onSelect, currentTokenId, onError } = props
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<View>({ tx: 0, ty: 0, s: 1 })
  const viewRef = useRef(view)
  viewRef.current = view
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  dragRef.current = drag
  const gesture = useRef<Gesture>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const [paintPreview, setPaintPreview] = useState<{ cells: Set<number>; reveal: boolean } | null>(null)
  const [pendingFog, setPendingFog] = useState<{ cells: Set<number>; reveal: boolean; rev: number } | null>(null)
  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null)
  const [pings, setPings] = useState<(PingEvent & { id: number })[]>([])
  const [remoteDrags, setRemoteDrags] = useState<Record<string, { x: number; y: number; at: number }>>({})
  const [overrides, setOverrides] = useState<Record<string, { x: number; y: number; until: number }>>({})
  const [panning, setPanning] = useState(false)
  const W = scene.cols * CELL
  const H = scene.rows * CELL

  // ---------- view fitting ----------
  const fit = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    if (!width || !height) return
    const s = Math.max(0.15, Math.min(3, Math.min(width / (W + 40), height / (H + 100))))
    setView({ s, tx: (width - W * s) / 2, ty: (height - H * s) / 2 + 20 })
  }, [W, H])

  useEffect(() => {
    fit()
  }, [scene.id, fit])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    let first = true
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false
        return
      }
      // keep the map roughly centered when panels collapse/expand
      fit()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit])

  // ---------- realtime ephemeral events ----------
  useEffect(() => {
    const offPing = client.onPing((p) => {
      if (p.sceneId !== scene.id) return
      const id = Math.random()
      setPings((list) => [...list.slice(-6), { ...p, id }])
      window.setTimeout(() => setPings((list) => list.filter((x) => x.id !== id)), 1700)
    })
    const offDrag = client.onDrag((d) => {
      if (d.sceneId !== scene.id) return
      setRemoteDrags((m) => ({ ...m, [d.tokenId]: { x: d.x, y: d.y, at: Date.now() } }))
    })
    return () => {
      offPing()
      offDrag()
    }
  }, [client, scene.id])

  // Clear remote drag ghosts and optimistic overrides once the server state catches up.
  useEffect(() => {
    setRemoteDrags({})
    setOverrides((o) => {
      const next: typeof o = {}
      for (const [id, v] of Object.entries(o)) {
        const t = scene.tokens.find((x) => x.id === id)
        if (t && (t.x !== v.x || t.y !== v.y) && v.until > Date.now()) next[id] = v
      }
      return next
    })
  }, [scene.tokens])

  useEffect(() => {
    if (pendingFog && scene.fogRev >= pendingFog.rev) setPendingFog(null)
  }, [scene.fogRev, pendingFog])

  useEffect(() => {
    const t = window.setInterval(() => {
      const now = Date.now()
      setRemoteDrags((m) => {
        const stale = Object.entries(m).filter(([, v]) => now - v.at > 1500)
        if (!stale.length) return m
        const next = { ...m }
        for (const [k] of stale) delete next[k]
        return next
      })
    }, 700)
    return () => clearInterval(t)
  }, [])

  // ---------- coordinate helpers ----------
  const toWorld = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const v = viewRef.current
    return { x: (clientX - rect.left - v.tx) / v.s, y: (clientY - rect.top - v.ty) / v.s }
  }
  const toCell = (clientX: number, clientY: number): [number, number] => {
    const w = toWorld(clientX, clientY)
    return [Math.floor(w.x / CELL), Math.floor(w.y / CELL)]
  }
  const zoomAt = (clientX: number, clientY: number, factor: number) => {
    const rect = svgRef.current!.getBoundingClientRect()
    setView((v) => {
      const s = Math.max(0.15, Math.min(4, v.s * factor))
      const k = s / v.s
      const px = clientX - rect.left
      const py = clientY - rect.top
      return { s, tx: px - (px - v.tx) * k, ty: py - (py - v.ty) * k }
    })
  }

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  // ---------- fog painting ----------
  const brushCells = (cx: number, cy: number): number[] => {
    const r = brush.size - 1
    const out: number[] = []
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) if (x >= 0 && y >= 0 && x < scene.cols && y < scene.rows) out.push(y * scene.cols + x)
    return out
  }
  const rectCells = (a: [number, number], b: [number, number]) => {
    const out: number[] = []
    const [x0, x1] = [Math.max(0, Math.min(a[0], b[0])), Math.min(scene.cols - 1, Math.max(a[0], b[0]))]
    const [y0, y1] = [Math.max(0, Math.min(a[1], b[1])), Math.min(scene.rows - 1, Math.max(a[1], b[1]))]
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(y * scene.cols + x)
    return out
  }

  const commitPaint = async (cells: Set<number>, reveal: boolean) => {
    if (cells.size === 0) return
    setPendingFog({ cells, reveal, rev: scene.fogRev + 1 })
    const r = await client.op({ type: 'fog.paint', sceneId: scene.id, cells: [...cells], reveal })
    if (!r.ok) {
      setPendingFog(null)
      if (r.error) onError(r.error)
    }
  }

  // ---------- pointer handling ----------
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    svgRef.current?.setPointerCapture(e.pointerId)
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = { kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, view: viewRef.current }
      setDrag(null)
      setPaintPreview(null)
      return
    }
    const fogTool = isDm && (tool === 'reveal' || tool === 'hide') && scene.fogEnabled
    if (e.button === 1 || e.button === 2 || tool === 'select' || (!fogTool && tool !== 'ping')) {
      gesture.current = { kind: 'pan', pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, tx: viewRef.current.tx, ty: viewRef.current.ty, moved: false }
      return
    }
    if (tool === 'ping') {
      const w = toWorld(e.clientX, e.clientY)
      client.fire({ type: 'ping', x: w.x / CELL, y: w.y / CELL })
      gesture.current = null
      return
    }
    if (fogTool) {
      const c = toCell(e.clientX, e.clientY)
      const cells = new Set(brush.shape === 'brush' ? brushCells(c[0], c[1]) : rectCells(c, c))
      gesture.current = { kind: 'paint', pointerId: e.pointerId, reveal: tool === 'reveal', startCell: c, cells }
      setPaintPreview({ cells: new Set(cells), reveal: tool === 'reveal' })
    }
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    const d = dragRef.current
    if (isDm && (tool === 'reveal' || tool === 'hide')) setHoverCell(toCell(e.clientX, e.clientY))
    if (g?.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      const rect = svgRef.current!.getBoundingClientRect()
      const s = Math.max(0.15, Math.min(4, g.view.s * (dist / g.dist)))
      const k = s / g.view.s
      const px = g.cx - rect.left
      const py = g.cy - rect.top
      setView({ s, tx: px - (px - g.view.tx) * k + (cx - g.cx), ty: py - (py - g.view.ty) * k + (cy - g.cy) })
      return
    }
    if (d && d.pointerId === e.pointerId) {
      const w = toWorld(e.clientX, e.clientY)
      const moved = d.moved || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 4
      const nx = w.x / CELL - d.offX
      const ny = w.y / CELL - d.offY
      const now = performance.now()
      if (moved && now - d.lastSent > 70) {
        client.fire({ type: 'token.drag', tokenId: d.tokenId, x: nx, y: ny })
        d.lastSent = now
      }
      setDrag({ ...d, x: nx, y: ny, moved })
      return
    }
    if (g?.kind === 'pan' && g.pointerId === e.pointerId) {
      const dx = e.clientX - g.startX
      const dy = e.clientY - g.startY
      if (!g.moved && Math.hypot(dx, dy) > 3) {
        g.moved = true
        setPanning(true)
      }
      if (g.moved) setView((v) => ({ ...v, tx: g.tx + dx, ty: g.ty + dy }))
      return
    }
    if (g?.kind === 'paint' && g.pointerId === e.pointerId) {
      const c = toCell(e.clientX, e.clientY)
      if (brush.shape === 'brush') for (const i of brushCells(c[0], c[1])) g.cells.add(i)
      else g.cells = new Set(rectCells(g.startCell, c))
      setPaintPreview({ cells: new Set(g.cells), reveal: g.reveal })
    }
  }

  const endPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    const d = dragRef.current
    if (d && d.pointerId === e.pointerId) {
      setDrag(null)
      if (!d.moved) {
        onSelect(d.tokenId)
        return
      }
      const token = scene.tokens.find((t) => t.id === d.tokenId)
      const size = token?.size ?? 1
      const x = Math.max(0, Math.min(scene.cols - size, Math.round(d.x)))
      const y = Math.max(0, Math.min(scene.rows - size, Math.round(d.y)))
      setOverrides((o) => ({ ...o, [d.tokenId]: { x, y, until: Date.now() + 2500 } }))
      void client.op({ type: 'token.move', tokenId: d.tokenId, x, y }).then((r) => {
        if (!r.ok) {
          setOverrides((o) => {
            const n = { ...o }
            delete n[d.tokenId]
            return n
          })
          if (r.error) onError(r.error)
        }
      })
      return
    }
    if (g?.kind === 'pan' && g.pointerId === e.pointerId) {
      if (!g.moved && e.button === 0) onSelect(null)
      setPanning(false)
      gesture.current = null
      return
    }
    if (g?.kind === 'paint' && g.pointerId === e.pointerId) {
      void commitPaint(g.cells, g.reveal)
      setPaintPreview(null)
      gesture.current = null
      return
    }
    if (g?.kind === 'pinch' && pointers.current.size < 2) gesture.current = null
  }

  const onTokenPointerDown = (e: React.PointerEvent, t: TokenView, movable: boolean) => {
    if (e.button !== 0 || pointers.current.size > 0) return
    if (tool !== 'select') return
    e.stopPropagation()
    if (!movable) {
      onSelect(t.id)
      return
    }
    svgRef.current?.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const w = toWorld(e.clientX, e.clientY)
    const pos = positionOf(t)
    setDrag({ tokenId: t.id, pointerId: e.pointerId, offX: w.x / CELL - pos.x, offY: w.y / CELL - pos.y, x: pos.x, y: pos.y, startX: e.clientX, startY: e.clientY, moved: false, lastSent: 0 })
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    if (tool !== 'select') return
    const w = toWorld(e.clientX, e.clientY)
    client.fire({ type: 'ping', x: w.x / CELL, y: w.y / CELL })
  }

  // ---------- derived rendering data ----------
  const positionOf = (t: TokenView) => {
    if (drag?.tokenId === t.id) return { x: drag.x, y: drag.y }
    const o = overrides[t.id]
    if (o && o.until > Date.now()) return o
    const r = remoteDrags[t.id]
    if (r) return r
    return { x: t.x, y: t.y }
  }

  const fogString = useMemo(() => {
    if (!scene.fogEnabled) return ''
    const arr = scene.revealed.split('')
    for (const p of [pendingFog, paintPreview]) if (p) for (const i of p.cells) arr[i] = p.reveal ? '1' : '0'
    return arr.join('')
  }, [scene.fogEnabled, scene.revealed, pendingFog, paintPreview])

  const fogPath = useMemo(() => {
    if (!fogString) return ''
    let d = ''
    for (let y = 0; y < scene.rows; y++) {
      let x = 0
      while (x < scene.cols) {
        if (fogString[y * scene.cols + x] === '0') {
          const start = x
          while (x < scene.cols && fogString[y * scene.cols + x] === '0') x++
          d += `M${start * CELL} ${y * CELL}h${(x - start) * CELL}v${CELL}h${-(x - start) * CELL}z`
        } else x++
      }
    }
    return d
  }, [fogString, scene.cols, scene.rows])

  const gridPath = useMemo(() => {
    let d = ''
    for (let x = 0; x <= scene.cols; x++) d += `M${x * CELL} 0V${H}`
    for (let y = 0; y <= scene.rows; y++) d += `M0 ${y * CELL}H${W}`
    return d
  }, [scene.cols, scene.rows, W, H])

  const inFog = (t: TokenView) => {
    if (!fogString) return false
    for (let dy = 0; dy < t.size; dy++) for (let dx = 0; dx < t.size; dx++) if (fogString[(t.y + dy) * scene.cols + t.x + dx] === '1') return false
    return true
  }

  const myToken = scene.tokens.find((t) => controls(t, you, characters))
  const centerOn = (t: TokenView) => {
    const el = wrapRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setView((v) => ({ ...v, tx: width / 2 - (t.x + t.size / 2) * CELL * v.s, ty: height / 2 - (t.y + t.size / 2) * CELL * v.s }))
  }

  // ---------- keyboard shortcuts ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'v') setTool('select')
      else if (k === 'p') setTool('ping')
      else if (k === 'r' && isDm) setTool('reveal')
      else if (k === 'h' && isDm) setTool('hide')
      else if (k === 'f') fit()
      else if (k === '=' || k === '+') zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1.2)
      else if (k === '-') zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1 / 1.2)
      else if (k === 'escape') onSelect(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const cursorClass = panning ? 'panning' : tool === 'ping' ? 'tool-ping' : isDm && (tool === 'reveal' || tool === 'hide') ? 'tool-fog' : 'tool-pan'
  const sortedTokens = [...scene.tokens].sort((a, b) => (a.id === drag?.tokenId ? 1 : 0) - (b.id === drag?.tokenId ? 1 : 0) || b.size - a.size)

  return (
    <div className="map-wrap" ref={wrapRef} onContextMenu={(e) => e.preventDefault()}>
      <svg
        ref={svgRef}
        className={`map-svg ${cursorClass}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={() => setHoverCell(null)}
        onDoubleClick={onDoubleClick}
        role="application"
        aria-label={`Battle map: ${scene.name}`}
      >
        <defs>
          <pattern id="fog-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="10" height="10" fill="rgba(12,9,7,0.62)" />
            <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(209,171,85,0.3)" strokeWidth="2" />
          </pattern>
          <radialGradient id="fog-player" cx="50%" cy="50%" r="75%">
            <stop offset="0" stopColor="#15110d" />
            <stop offset="1" stopColor="#0c0907" />
          </radialGradient>
          <filter id="tok-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.6" />
          </filter>
        </defs>
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.s})`}>
          <rect x={-6} y={-6} width={W + 12} height={H + 12} rx={8} fill="#0d0a08" stroke="#3b3129" strokeWidth={2} />
          {scene.bg.kind === 'image' && scene.mapUrl ? (
            <image href={scene.mapUrl} x={0} y={0} width={W} height={H} preserveAspectRatio="none" />
          ) : (
            <rect x={0} y={0} width={W} height={H} fill="#2a2420" />
          )}
          <path d={gridPath} stroke="rgba(255,240,220,0.16)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" pointerEvents="none" />
          {fogPath && <path d={fogPath} fill={isDm ? 'url(#fog-hatch)' : 'url(#fog-player)'} pointerEvents="none" />}
          {isDm && hoverCell && (tool === 'reveal' || tool === 'hide') && scene.fogEnabled && !gesture.current && (
            <rect
              x={(hoverCell[0] - (brush.shape === 'brush' ? brush.size - 1 : 0)) * CELL}
              y={(hoverCell[1] - (brush.shape === 'brush' ? brush.size - 1 : 0)) * CELL}
              width={(brush.shape === 'brush' ? brush.size * 2 - 1 : 1) * CELL}
              height={(brush.shape === 'brush' ? brush.size * 2 - 1 : 1) * CELL}
              fill={tool === 'reveal' ? 'rgba(240,163,92,0.18)' : 'rgba(12,9,7,0.45)'}
              stroke={tool === 'reveal' ? '#f0a35c' : '#d1ab55'}
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
          {sortedTokens.map((t) => {
            const pos = positionOf(t)
            const movable = isDm || (live && canMove && controls(t, you, characters))
            return (
              <TokenShape
                key={t.id}
                t={t}
                x={pos.x}
                y={pos.y}
                mine={controls(t, you, characters)}
                selected={selectedId === t.id}
                current={currentTokenId === t.id}
                dragging={drag?.tokenId === t.id}
                ghost={!!remoteDrags[t.id]}
                fogged={isDm && inFog(t)}
                isDm={isDm}
                movable={movable && tool === 'select'}
                onPointerDown={(e) => onTokenPointerDown(e, t, movable)}
              />
            )
          })}
          {pings.map((p) => (
            <g key={p.id} pointerEvents="none">
              <circle className="ping-ring" cx={p.x * CELL} cy={p.y * CELL} r={CELL * 0.9} fill="none" stroke={p.color} strokeWidth={4} />
              <circle cx={p.x * CELL} cy={p.y * CELL} r={6} fill={p.color} />
              <text className="token-name" x={p.x * CELL} y={p.y * CELL - 14} textAnchor="middle" fontSize={13}>{p.name}</text>
            </g>
          ))}
        </g>
      </svg>

      <div className="map-toolbar" role="toolbar" aria-label="Map tools">
        <button className={`tool ${tool === 'select' ? 'on' : ''}`} data-tip="Move and pan (V)" onClick={() => setTool('select')} aria-label="Move and pan">
          <MousePointer2 size={18} />
        </button>
        <button className={`tool ${tool === 'ping' ? 'on' : ''}`} data-tip="Ping a spot (P, or double-click)" onClick={() => setTool('ping')} aria-label="Ping">
          <Radio size={18} />
        </button>
        {isDm && scene.fogEnabled && (
          <>
            <div className="sep" />
            <button className={`tool dm ${tool === 'reveal' ? 'on' : ''}`} data-tip="Reveal fog (R)" onClick={() => setTool('reveal')} aria-label="Reveal fog">
              <Paintbrush size={18} />
            </button>
            <button className={`tool dm ${tool === 'hide' ? 'on' : ''}`} data-tip="Hide with fog (H)" onClick={() => setTool('hide')} aria-label="Hide with fog">
              <Eraser size={18} />
            </button>
          </>
        )}
        <div className="sep" />
        <button className="tool" data-tip="Zoom in (+)" onClick={() => { const r = wrapRef.current!.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.25) }} aria-label="Zoom in">
          <Plus size={18} />
        </button>
        <button className="tool" data-tip="Zoom out (-)" onClick={() => { const r = wrapRef.current!.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 0.8) }} aria-label="Zoom out">
          <Minus size={18} />
        </button>
        <button className="tool" data-tip="Fit map (F)" onClick={fit} aria-label="Fit map to screen">
          <Maximize size={18} />
        </button>
        {myToken && (
          <button className="tool" data-tip="Find my token" onClick={() => centerOn(myToken)} aria-label="Center on my token">
            <Locate size={18} />
          </button>
        )}
      </div>

      {isDm && scene.fogEnabled && (tool === 'reveal' || tool === 'hide') && (
        <div className="fog-options">
          <strong style={{ color: 'var(--gold)' }}>{tool === 'reveal' ? 'Reveal' : 'Hide'} fog</strong>
          <div className="seg">
            <button className={brush.shape === 'brush' ? 'on' : ''} onClick={() => setBrush({ ...brush, shape: 'brush' })}><Paintbrush size={12} /> Brush</button>
            <button className={brush.shape === 'rect' ? 'on' : ''} onClick={() => setBrush({ ...brush, shape: 'rect' })}><Square size={12} /> Box</button>
          </div>
          {brush.shape === 'brush' && (
            <div className="seg">
              {([1, 2, 3] as const).map((s) => (
                <button key={s} className={brush.size === s ? 'on' : ''} onClick={() => setBrush({ ...brush, size: s })}>{s * 2 - 1}x{s * 2 - 1}</button>
              ))}
            </div>
          )}
          <span className="tiny muted">Drag over the map. Players only see revealed squares. Press V to go back to moving tokens.</span>
          <div className="row">
            <button className="btn xs" onClick={() => client.op({ type: 'fog.all', sceneId: scene.id, reveal: true })}>Reveal all</button>
            <button className="btn xs" onClick={() => client.op({ type: 'fog.all', sceneId: scene.id, reveal: false })}>Hide all</button>
          </div>
        </div>
      )}

      {!isDm && scene.bg.kind === 'image' && scene.mapPending && (
        <div className="map-banner">
          <span className="small muted">The DM is preparing the map. Revealed areas will appear here in a moment.</span>
        </div>
      )}
    </div>
  )
}

function TokenShape({ t, x, y, mine, selected, current, dragging, ghost, fogged, isDm, movable, onPointerDown }: {
  t: TokenView
  x: number
  y: number
  mine: boolean
  selected: boolean
  current: boolean
  dragging: boolean
  ghost: boolean
  fogged: boolean
  isDm: boolean
  movable: boolean
  onPointerDown: (e: React.PointerEvent) => void
}) {
  const size = t.size * CELL
  const r = size / 2
  const Icon = ICONS[t.icon] ?? ICONS.user
  const iconSize = Math.round(size * 0.46)
  const ratio = t.hp !== null && t.maxHp ? Math.max(0, Math.min(1, t.hp / t.maxHp)) : t.health / 4
  const barColor = ratio > 0.5 ? '#8fbf6c' : ratio > 0.25 ? '#d4ad55' : '#cf5a47'
  const down = (t.hp !== null ? t.hp <= 0 : t.health === 0)
  const ring = t.kind === 'pc' ? (mine ? '#f0a35c' : '#efe4d0') : t.kind === 'npc' ? '#7c9cc0' : '#cf5a47'
  return (
    <g
      className={`token-g ${movable ? '' : 'static'} ${dragging ? 'dragging' : ''}`}
      transform={`translate(${x * CELL} ${y * CELL})`}
      opacity={t.hidden ? 0.45 : fogged ? 0.6 : ghost ? 0.85 : 1}
      onPointerDown={onPointerDown}
      style={{ transition: dragging || ghost ? 'none' : 'transform 0.18s ease-out' }}
    >
      {current && <circle cx={r} cy={r} r={r + 3} fill="none" stroke="#f0a35c" strokeWidth={3} strokeDasharray="5 4" />}
      {selected && <circle cx={r} cy={r} r={r + 1} fill="rgba(240,163,92,0.15)" stroke="#ffd3a1" strokeWidth={2} />}
      <circle cx={r} cy={r} r={r - 4} fill={t.color} stroke={ring} strokeWidth={t.kind === 'pc' ? 3 : 3.5} filter="url(#tok-shadow)" strokeDasharray={t.hidden ? '6 4' : undefined} />
      <circle cx={r} cy={r} r={r - 8} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={1.5} />
      <Icon x={r - iconSize / 2} y={r - iconSize / 2} width={iconSize} height={iconSize} color={down ? '#5a1d16' : '#1a120c'} strokeWidth={2.2} />
      {down && <path d={`M${r - 10} ${r - 10}L${r + 10} ${r + 10}M${r + 10} ${r - 10}L${r - 10} ${r + 10}`} stroke="#5a1d16" strokeWidth={4} strokeLinecap="round" />}
      <rect x={size * 0.14} y={size - 9} width={size * 0.72} height={6} rx={3} fill="#2a1512" stroke="#0e0b09" strokeWidth={1} />
      <rect x={size * 0.14} y={size - 9} width={size * 0.72 * ratio} height={6} rx={3} fill={barColor} />
      {t.conditions.length > 0 && (
        <g>
          <circle cx={size - 7} cy={7} r={7.5} fill="#5b3324" stroke="#f1b9a5" strokeWidth={1.2} />
          <text x={size - 7} y={10.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#f9dbcf">{t.conditions.length}</text>
          <title>{t.conditions.join(', ')}</title>
        </g>
      )}
      {isDm && t.hidden && (
        <g transform={`translate(${-2} ${-2})`}>
          <circle cx={8} cy={8} r={8} fill="#2f2612" stroke="#d1ab55" />
          <EyeOff x={2} y={2} width={12} height={12} color="#d1ab55" />
        </g>
      )}
      <text className="token-name" x={r} y={size + 12} textAnchor="middle" fontSize={12}>{t.name}</text>
      <title>{`${t.name}${t.hp !== null ? ` · ${t.hp}/${t.maxHp} HP` : ''}${t.ac !== null ? ` · AC ${t.ac}` : ''}${t.hidden ? ' · hidden from players' : ''}`}</title>
    </g>
  )
}
