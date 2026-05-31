import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d'
import { forceCollide } from 'd3-force'
import { ArrowUpRight, Circle, Folder, GitFork, Link2, Maximize2, Tag, Unlink, Waypoints, X } from 'lucide-react'
import { getGraph, type GraphData } from '@/lib/api'
import { qk, useDecks, useLinkNotes, useUnlinkNotes } from '@/lib/hooks'
import { useTheme } from '@/lib/theme'
import { useT } from '@/lib/i18n'
import { tagHue } from '@/lib/tags'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'

type Layout = 'force' | 'radial' | 'tree'
type ColorBy = 'tag' | 'deck'
const UNTAGGED = '·none'

interface Pt {
  x: number
  y: number
}
interface GNode extends Pt {
  id: string
  title: string
  deck_id: string | null
  tags: string[]
  deg: number
  r: number
  neighbors: Set<string>
  vx?: number
  vy?: number
  fx?: number
  fy?: number
}
interface GLink {
  source: string | GNode
  target: string | GNode
  type: string
  weight: number
}

export function GraphScreen() {
  const navigate = useNavigate()
  const t = useT()
  const { data, isLoading } = useQuery({ queryKey: qk.graph, queryFn: getGraph })
  const { data: decks } = useDecks()
  const deckNames = useMemo(() => Object.fromEntries((decks ?? []).map((d) => [d.id, d.name])), [decks])

  return (
    <>
      <PageHeader title={t('Graph', '圖譜')} subtitle={t('How your notes connect', '你的筆記如何相連')} icon={<Waypoints className="size-4" />} />
      <div className="relative flex-1 overflow-hidden bg-dots">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="size-10 animate-pulse rounded-full bg-brand/15" />
          </div>
        ) : data && data.nodes.length > 0 ? (
          <GraphCanvas data={data} deckNames={deckNames} onOpen={(id) => navigate({ to: '/notes/$noteId', params: { noteId: id } })} />
        ) : (
          <EmptyState
            className="h-full"
            icon={<Waypoints className="size-6" />}
            title={t('Your graph is empty', '你的圖譜還是空的')}
            description={t(
              'Write a couple of notes, tag them, then connect them here — turn on link mode and tap two notes to relate them.',
              '先寫幾則筆記、加上標籤,再到這裡連結它們——開啟連結模式,點兩則筆記即可建立關聯。',
            )}
          />
        )}
      </div>
    </>
  )
}

function GraphCanvas({
  data,
  deckNames,
  onOpen,
}: {
  data: GraphData
  deckNames: Record<string, string>
  onOpen: (id: string) => void
}) {
  const t = useT()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<ForceGraphMethods<GNode, GLink> | undefined>(undefined)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [layout, setLayout] = useState<Layout>('force')
  const [colorBy, setColorBy] = useState<ColorBy>('tag')

  const [linkMode, setLinkMode] = useState(false)
  const [linkSource, setLinkSource] = useState<string | null>(null)
  const link = useLinkNotes()
  const unlink = useUnlinkNotes()

  const posRef = useRef(new Map<string, { x: number; y: number; vx: number; vy: number }>())
  const didFitRef = useRef(false)

  const groupKey = useCallback(
    (n: GNode) => (colorBy === 'tag' ? n.tags[0] ?? UNTAGGED : n.deck_id ?? UNTAGGED),
    [colorBy],
  )
  const groupKeyRef = useRef(groupKey)
  groupKeyRef.current = groupKey
  const groupLabel = useCallback(
    (key: string) => (key === UNTAGGED ? '' : colorBy === 'tag' ? key : deckNames[key] ?? key),
    [colorBy, deckNames],
  )

  useEffect(() => {
    const anyTag = data.nodes.some((n) => n.tags.length)
    if (!anyTag && data.nodes.some((n) => n.deck_id)) setColorBy('deck')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const graph = useMemo(() => {
    const nodes: GNode[] = data.nodes.map((n) => {
      const p = posRef.current.get(n.id)
      return { ...n, tags: n.tags ?? [], deg: 0, r: 4, neighbors: new Set<string>(), x: p?.x ?? 0, y: p?.y ?? 0, vx: p?.vx, vy: p?.vy }
    })
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const links: GLink[] = []
    for (const e of data.edges) {
      const s = byId.get(e.source)
      const tg = byId.get(e.target)
      if (!s || !tg) continue
      links.push({ source: e.source, target: e.target, type: e.type, weight: e.weight })
      s.deg++
      tg.deg++
      s.neighbors.add(tg.id)
      tg.neighbors.add(s.id)
    }
    nodes.forEach((n) => {
      n.r = 1.2 + Math.min(n.deg, 8) * 0.3 // small dots; the hit area is generous
    })
    return { nodes, links }
  }, [data])

  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // zoomToFit, but clamp so a sparse graph doesn't slam to max zoom.
  const fitView = useCallback((ms = 400) => {
    const fg = fgRef.current
    if (!fg) return
    fg.zoomToFit(ms, 55)
    window.setTimeout(() => {
      const fg2 = fgRef.current
      if (!fg2) return
      const z = fg2.zoom()
      if (z > 1.8) fg2.zoom(1.8, 200)
      else if (z < 0.35) fg2.zoom(0.35, 200)
    }, ms + 50)
  }, [])

  // Forces + fixed positions for the chosen layout.
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    const charge = fg.d3Force('charge') as { strength: (n: number) => void } | undefined
    const linkF = fg.d3Force('link') as { distance: (fn: (l: GLink) => number) => void } | undefined

    if (layout === 'force') {
      graph.nodes.forEach((n) => {
        n.fx = undefined
        n.fy = undefined
      })
      charge?.strength(-70)
      linkF?.distance((l) => 30 + (1 - Math.min(l.weight, 3) / 3) * 20)
      fg.d3Force('collide', forceCollide<GNode>().radius((n) => n.r + 5).iterations(2))
      fg.d3Force('group', clusterForce(groupKeyRef))
    } else {
      fg.d3Force('group', null)
      const pos = layout === 'radial' ? radialPositions(graph.nodes, groupKey) : treePositions(graph.nodes, graph.links)
      graph.nodes.forEach((n) => {
        const p = pos.get(n.id)
        if (p) {
          n.fx = p.x
          n.fy = p.y
          n.x = p.x
          n.y = p.y
        }
      })
    }
    fg.d3ReheatSimulation()
    const id = setTimeout(() => fitView(420), layout === 'force' ? 650 : 90)
    return () => clearTimeout(id)
    // size.w: re-run once the canvas (and thus fgRef) has actually mounted.
  }, [graph, layout, colorBy, groupKey, size.w, fitView])

  const active = focusId ?? hoverId ?? linkSource
  const activeSet = useMemo(() => {
    if (!active) return null
    const n = nodeById.get(active)
    if (!n) return null
    const s = new Set<string>([n.id])
    n.neighbors.forEach((id) => s.add(id))
    return s
  }, [active, nodeById])

  const focusNode = focusId ? nodeById.get(focusId) : null
  const ink = isDark ? '0.88 0.01 85' : '0.32 0.012 60'
  const paper = isDark ? '0.21 0.012 70' : '0.994 0.003 95'

  function groupColor(key: string, l: number, c: number, a: number): string {
    if (key === UNTAGGED) return `oklch(${isDark ? 0.62 : 0.64} 0.006 250 / ${a})`
    return `oklch(${l} ${c} ${tagHue(key)} / ${a})`
  }
  const nodeFill = (n: GNode, alpha: number) => groupColor(groupKey(n), isDark ? 0.74 : 0.58, 0.09, alpha)

  const handleNodeClick = useCallback(
    (n: GNode) => {
      if (linkMode) {
        if (!linkSource) setLinkSource(n.id)
        else if (linkSource === n.id) setLinkSource(null)
        else {
          const src = nodeById.get(linkSource)
          link.mutate(
            { source_note_id: linkSource, target_note_id: n.id, link_type: 'related', weight: 1 },
            {
              onSuccess: () => toast.success(t(`Linked “${src?.title ?? '…'}” ↔ “${n.title}”`, `已連結「${src?.title ?? '…'}」↔「${n.title}」`)),
              onError: (e) => toast.error(e instanceof Error ? e.message : t('Failed to link', '建立關聯失敗')),
            },
          )
          setLinkSource(null)
        }
        return
      }
      if (focusId === n.id) onOpen(n.id)
      else setFocusId(n.id)
    },
    [linkMode, linkSource, link, nodeById, focusId, onOpen, t],
  )

  const handleLinkClick = useCallback(
    (l: GLink) => {
      if (!linkMode) return
      const s = typeof l.source === 'object' ? l.source : nodeById.get(l.source as string)
      const tg = typeof l.target === 'object' ? l.target : nodeById.get(l.target as string)
      if (!s || !tg) return
      unlink.mutate(
        { a: s.id, b: tg.id },
        {
          onSuccess: () => toast.success(t('Association removed', '已移除關聯')),
          onError: (e) => toast.error(e instanceof Error ? e.message : t('Failed to remove', '移除失敗')),
        },
      )
    },
    [linkMode, unlink, nodeById, t],
  )

  return (
    <div ref={containerRef} className="absolute inset-0">
      {size.w > 0 ? (
        <ForceGraph2D<GNode, GLink>
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={graph}
          backgroundColor="rgba(0,0,0,0)"
          warmupTicks={layout === 'force' ? 80 : 0}
          cooldownTicks={layout === 'force' ? 110 : 0}
          d3VelocityDecay={0.4}
          minZoom={0.25}
          maxZoom={6}
          onEngineStop={() => {
            if (!didFitRef.current) {
              fitView(420)
              didFitRef.current = true
            }
          }}
          onNodeHover={(n) => setHoverId(n?.id ?? null)}
          onNodeClick={handleNodeClick}
          onLinkClick={handleLinkClick}
          onBackgroundClick={() => (linkMode ? setLinkSource(null) : setFocusId(null))}
          // Category outlines (convex-hull boxes) behind everything.
          onRenderFramePre={(ctx, scale) => {
            const groups = new Map<string, GNode[]>()
            for (const n of graph.nodes) {
              const k = groupKey(n)
              if (k === UNTAGGED) continue
              const arr = groups.get(k)
              if (arr) arr.push(n)
              else groups.set(k, [n])
            }
            ctx.lineJoin = 'round'
            for (const [key, members] of groups) {
              drawHull(ctx, members, key, groupColor, groupLabel(key), scale, isDark)
            }
          }}
          // Connecting guide line + decluttered node labels on top.
          onRenderFramePost={(ctx, scale) => {
            if (linkMode && linkSource) {
              const s = nodeById.get(linkSource)
              const tg = hoverId && hoverId !== linkSource ? nodeById.get(hoverId) : null
              if (s) {
                ctx.save()
                ctx.setLineDash([4, 3])
                ctx.strokeStyle = `oklch(0.62 0.18 250 / 0.85)`
                ctx.lineWidth = 1.2 / scale
                ctx.beginPath()
                ctx.moveTo(s.x, s.y)
                ctx.lineTo(tg ? tg.x : s.x, tg ? tg.y : s.y)
                ctx.stroke()
                ctx.restore()
              }
            }
            drawLabels(ctx, scale, graph.nodes, activeSet, active, ink, paper)
          }}
          linkCanvasObjectMode={() => 'replace'}
          linkCanvasObject={(l, ctx) => {
            const s = l.source as GNode
            const tg = l.target as GNode
            if (s.x == null || tg.x == null) return
            const inFocus = !activeSet || (activeSet.has(s.id) && activeSet.has(tg.id))
            const a = inFocus ? (isDark ? 0.34 : 0.28) : 0.05
            ctx.strokeStyle = `oklch(${isDark ? '0.72 0.008 250' : '0.52 0.006 250'} / ${a})`
            ctx.lineWidth = (0.3 + Math.min(l.weight, 3) * 0.3) * (inFocus ? 1.3 : 1)
            ctx.beginPath()
            ctx.moveTo(s.x, s.y ?? 0)
            ctx.lineTo(tg.x, tg.y ?? 0)
            ctx.stroke()
          }}
          nodeCanvasObjectMode={() => 'replace'}
          nodeCanvasObject={(node, ctx, scale) => {
            const x = node.x ?? 0
            const y = node.y ?? 0
            const r = node.r
            posRef.current.set(node.id, { x, y, vx: node.vx ?? 0, vy: node.vy ?? 0 })

            const dim = activeSet != null && !activeSet.has(node.id)
            const isActive = active === node.id
            const isSource = linkSource === node.id
            const alpha = dim ? 0.18 : 1
            const ringR = r + Math.max(3, 4 / scale) // visible even when the dot is tiny

            if (isActive || isSource) {
              ctx.beginPath()
              ctx.arc(x, y, ringR, 0, 2 * Math.PI)
              ctx.fillStyle = nodeFill(node, isSource ? 0.3 : 0.15)
              ctx.fill()
            }
            ctx.beginPath()
            ctx.arc(x, y, r, 0, 2 * Math.PI)
            ctx.fillStyle = nodeFill(node, alpha)
            ctx.fill()
            if (isSource) {
              ctx.lineWidth = Math.max(0.8, 1.4 / scale)
              ctx.strokeStyle = `oklch(0.62 0.18 250 / 0.95)`
              ctx.beginPath()
              ctx.arc(x, y, ringR, 0, 2 * Math.PI)
              ctx.stroke()
            }
          }}
          // Hit area = the dot (with a screen-min radius so tiny dots stay
          // tappable) PLUS the label below it, so clicking the text selects the
          // node too. Essential for link mode on touch.
          nodePointerAreaPaint={(node, color, ctx, globalScale) => {
            ctx.fillStyle = color
            const x = node.x ?? 0
            const y = node.y ?? 0
            const minR = Math.max(node.r + 3, 12 / globalScale)
            ctx.beginPath()
            ctx.arc(x, y, minR, 0, 2 * Math.PI)
            ctx.fill()
            const fs = Math.max(2.5, 9 / globalScale)
            ctx.font = `500 ${fs}px Inter, sans-serif`
            const text = node.title.length > 22 ? node.title.slice(0, 21) + '…' : node.title
            const w = ctx.measureText(text).width
            const ly = y + node.r + 1.5 / globalScale
            ctx.fillRect(x - w / 2 - 1 / globalScale, ly, w + 2 / globalScale, fs + 2 / globalScale)
          }}
        />
      ) : null}

      {/* Top-left: layout + colour-by. */}
      <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
        <div className="flex items-center rounded-lg border border-border bg-popover/90 p-0.5 shadow-soft backdrop-blur">
          <SegBtn active={layout === 'force'} onClick={() => setLayout('force')} title={t('Web (force)', '網狀(力導)')}><Waypoints className="size-3.5" /></SegBtn>
          <SegBtn active={layout === 'radial'} onClick={() => setLayout('radial')} title={t('Radial by group', '依群組放射')}><Circle className="size-3.5" /></SegBtn>
          <SegBtn active={layout === 'tree'} onClick={() => setLayout('tree')} title={t('Tree', '樹狀')}><GitFork className="size-3.5" /></SegBtn>
        </div>
        <button
          onClick={() => setColorBy((v) => (v === 'tag' ? 'deck' : 'tag'))}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-popover/90 px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground shadow-soft backdrop-blur transition hover:text-foreground"
          title={t('Colour by tag or deck', '依標籤或牌組上色')}
        >
          {colorBy === 'tag' ? <Tag className="size-3.5" /> : <Folder className="size-3.5" />}
          {colorBy === 'tag' ? t('Tags', '標籤') : t('Decks', '牌組')}
        </button>
      </div>

      {/* Top-right: link + fit. */}
      <div className="absolute right-3 top-3 flex items-center gap-1.5">
        <button
          onClick={() => {
            if (linkMode) {
              setLinkMode(false)
              setLinkSource(null)
            } else {
              // Carry the focused note in as the link source, so "select a note,
              // then hit Link, then tap the target" just works.
              setLinkMode(true)
              setLinkSource(focusId)
              setFocusId(null)
            }
          }}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium shadow-soft backdrop-blur transition ${
            linkMode ? 'border-brand bg-brand text-brand-foreground' : 'border-border bg-popover/90 text-muted-foreground hover:text-foreground'
          }`}
          title={t('Link notes', '連結筆記')}
        >
          <Link2 className="size-3.5" /> {t('Link', '連結')}
        </button>
        <button
          onClick={() => fitView(400)}
          className="flex items-center justify-center rounded-lg border border-border bg-popover/90 p-1.5 text-muted-foreground shadow-soft backdrop-blur transition hover:text-foreground"
          title={t('Fit to screen', '縮放至全圖')}
        >
          <Maximize2 className="size-3.5" />
        </button>
      </div>

      {/* Link-mode hint. */}
      {linkMode ? (
        <div className="absolute left-1/2 top-14 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-brand/40 bg-popover/95 px-3 py-1.5 text-[12px] text-foreground shadow-pop backdrop-blur">
          <Unlink className="size-3.5 shrink-0 text-brand" />
          <span className="truncate">
            {linkSource
              ? t('Now tap the note to connect to — or tap a line to remove it.', '再點要連到的筆記 — 或點一條線移除它。')
              : t('Tap a note, then another, to connect them.', '先點一則筆記,再點另一則,即可連結。')}
          </span>
          <button onClick={() => { setLinkMode(false); setLinkSource(null) }} className="-mr-1 rounded p-0.5 hover:text-brand" aria-label={t('Exit link mode', '結束連結模式')}>
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {/* Focus card. */}
      {focusNode && !linkMode ? (
        <div className="absolute bottom-3 left-1/2 w-[calc(100vw-1.5rem)] max-w-xs -translate-x-1/2 rounded-xl border border-border bg-popover/95 p-3 shadow-pop backdrop-blur sm:bottom-5 sm:w-72">
          <div className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: nodeFill(focusNode, 1) }} />
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{focusNode.title}</p>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {focusNode.tags.length ? (
              focusNode.tags.map((tg) => (
                <span key={tg} className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: groupColor(tg, isDark ? 0.5 : 0.62, 0.12, isDark ? 0.22 : 0.14), color: groupColor(tg, isDark ? 0.82 : 0.42, 0.13, 1) }}>
                  {tg}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">{t(`${focusNode.deg} connection${focusNode.deg === 1 ? '' : 's'}`, `${focusNode.deg} 個關聯`)}</span>
            )}
          </div>
          <button
            onClick={() => onOpen(focusNode.id)}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition hover:opacity-90 sm:py-1.5 sm:text-[13px]"
          >
            {t('Open note', '開啟筆記')} <ArrowUpRight className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

function SegBtn({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center rounded-md px-2 py-1 transition ${
        active ? 'bg-brand text-brand-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

// ── category outline: convex hull (or circle for ≤2 nodes), filled + stroked ──
function drawHull(
  ctx: CanvasRenderingContext2D,
  members: GNode[],
  key: string,
  color: (k: string, l: number, c: number, a: number) => string,
  label: string,
  scale: number,
  isDark: boolean,
) {
  const pad = 15
  let cx = 0
  let cy = 0
  let minY = Infinity
  for (const n of members) {
    cx += n.x
    cy += n.y
    minY = Math.min(minY, n.y - n.r)
  }
  cx /= members.length
  cy /= members.length

  ctx.fillStyle = color(key, isDark ? 0.62 : 0.66, 0.1, isDark ? 0.14 : 0.11)
  ctx.strokeStyle = color(key, isDark ? 0.7 : 0.55, 0.12, isDark ? 0.55 : 0.5)
  ctx.lineWidth = 1.1 / scale

  if (members.length <= 2) {
    let rad = 0
    for (const n of members) rad = Math.max(rad, Math.hypot(n.x - cx, n.y - cy) + n.r)
    rad += pad
    ctx.beginPath()
    ctx.arc(cx, cy, rad, 0, 2 * Math.PI)
    ctx.fill()
    ctx.stroke()
    minY = cy - rad
  } else {
    const hull = convexHull(members.map((n) => ({ x: n.x, y: n.y })))
    ctx.beginPath()
    hull.forEach((p, i) => {
      const dx = p.x - cx
      const dy = p.y - cy
      const d = Math.hypot(dx, dy) || 1
      const ex = p.x + (dx / d) * pad
      const ey = p.y + (dy / d) * pad
      minY = Math.min(minY, ey)
      if (i === 0) ctx.moveTo(ex, ey)
      else ctx.lineTo(ex, ey)
    })
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  if (label) {
    const fs = Math.max(2.5, 11 / scale)
    ctx.font = `600 ${fs}px Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = color(key, isDark ? 0.8 : 0.45, 0.13, 0.95)
    const text = label.length > 24 ? label.slice(0, 23) + '…' : label
    ctx.fillText(text, cx, minY - 3 / scale)
  }
}

// ── decluttered node labels (greedy: skip any that would overlap) ──
function drawLabels(
  ctx: CanvasRenderingContext2D,
  scale: number,
  nodes: GNode[],
  activeSet: Set<string> | null,
  active: string | null,
  ink: string,
  paper: string,
) {
  const fs = Math.max(2.5, 9 / scale)
  ctx.font = `500 ${fs}px Inter, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const showAll = scale > 1.2
  const cands = nodes.filter((n) => activeSet?.has(n.id) || showAll)
  const pr = (n: GNode) => (active === n.id ? 1e6 : activeSet?.has(n.id) ? 1e5 : 0) + n.deg
  cands.sort((a, b) => pr(b) - pr(a))

  const placed: { x0: number; y0: number; x1: number; y1: number }[] = []
  const gap = 1 / scale
  for (const n of cands) {
    const dim = activeSet != null && !activeSet.has(n.id)
    const text = n.title.length > 22 ? n.title.slice(0, 21) + '…' : n.title
    const w = ctx.measureText(text).width
    const x = n.x
    const y = n.y + n.r + 1.5 / scale
    const box = { x0: x - w / 2 - gap, y0: y - gap, x1: x + w / 2 + gap, y1: y + fs + gap }
    if (placed.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue
    placed.push(box)
    ctx.lineWidth = 2 / scale
    ctx.strokeStyle = `oklch(${paper} / ${dim ? 0.4 : 0.82})`
    ctx.strokeText(text, x, y)
    ctx.fillStyle = `oklch(${ink} / ${dim ? 0.4 : 0.92})`
    ctx.fillText(text, x, y)
  }
}

function convexHull(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts.slice()
  const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: Pt[] = []
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop()
    lower.push(q)
  }
  const upper: Pt[] = []
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop()
    upper.push(q)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

// ── d3 cluster force: pull same-group nodes together (ignores the ungrouped) ──
function clusterForce(groupKeyRef: { current: (n: GNode) => string }) {
  let nodes: GNode[] = []
  function force(alpha: number) {
    const cen = new Map<string, { x: number; y: number; n: number }>()
    for (const n of nodes) {
      const k = groupKeyRef.current(n)
      if (k === UNTAGGED) continue
      const c = cen.get(k) ?? { x: 0, y: 0, n: 0 }
      c.x += n.x
      c.y += n.y
      c.n++
      cen.set(k, c)
    }
    cen.forEach((c) => {
      c.x /= c.n
      c.y /= c.n
    })
    const k = 0.13 * alpha
    for (const n of nodes) {
      const key = groupKeyRef.current(n)
      if (key === UNTAGGED) continue
      const c = cen.get(key)
      if (!c) continue
      n.vx = (n.vx ?? 0) + (c.x - n.x) * k
      n.vy = (n.vy ?? 0) + (c.y - n.y) * k
    }
  }
  force.initialize = (n: GNode[]) => {
    nodes = n
  }
  return force
}

function radialPositions(nodes: GNode[], groupKey: (n: GNode) => string) {
  const pos = new Map<string, Pt>()
  const keys = Array.from(new Set(nodes.map(groupKey)))
  const G = keys.length || 1
  const R = Math.max(140, G * 46)
  keys.forEach((key, gi) => {
    const ang = (2 * Math.PI * gi) / G
    const cx = Math.cos(ang) * R
    const cy = Math.sin(ang) * R
    const members = nodes.filter((n) => groupKey(n) === key)
    const rr = Math.max(0, Math.min(members.length, 16) * 7)
    members.forEach((n, i) => {
      if (members.length === 1) pos.set(n.id, { x: cx, y: cy })
      else {
        const a2 = (2 * Math.PI * i) / members.length
        pos.set(n.id, { x: cx + Math.cos(a2) * rr, y: cy + Math.sin(a2) * rr })
      }
    })
  })
  return pos
}

function treePositions(nodes: GNode[], links: GLink[]) {
  const pos = new Map<string, Pt>()
  const adj = new Map<string, string[]>()
  nodes.forEach((n) => adj.set(n.id, []))
  const idOf = (e: string | GNode) => (typeof e === 'object' ? e.id : e)
  for (const l of links) {
    adj.get(idOf(l.source))?.push(idOf(l.target))
    adj.get(idOf(l.target))?.push(idOf(l.source))
  }
  const remaining = new Set(nodes.map((n) => n.id))
  const byDepth = new Map<number, string[]>()
  const degree = (id: string) => adj.get(id)?.length ?? 0
  while (remaining.size) {
    let root = ''
    let best = -1
    for (const id of remaining) if (degree(id) > best) { best = degree(id); root = id }
    const queue: [string, number][] = [[root, 0]]
    remaining.delete(root)
    while (queue.length) {
      const [id, d] = queue.shift()!
      const row = byDepth.get(d) ?? []
      row.push(id)
      byDepth.set(d, row)
      for (const nb of adj.get(id) ?? []) {
        if (remaining.has(nb)) {
          remaining.delete(nb)
          queue.push([nb, d + 1])
        }
      }
    }
  }
  const rowH = 64
  const colW = 58
  byDepth.forEach((ids, depth) => {
    const w = (ids.length - 1) * colW
    ids.forEach((id, i) => pos.set(id, { x: i * colW - w / 2, y: depth * rowH }))
  })
  return pos
}
