import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d'
import { forceCollide } from 'd3-force'
import { ArrowUpRight, Link2, Maximize2, Unlink, X } from 'lucide-react'
import { getGraph, type GraphData } from '@/lib/api'
import { qk, useLinkNotes, useUnlinkNotes } from '@/lib/hooks'
import { useTheme } from '@/lib/theme'
import { useT } from '@/lib/i18n'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'

interface GNode {
  id: string
  title: string
  deck_id: string | null
  deg: number
  r: number
  neighbors: Set<string>
  x?: number
  y?: number
  vx?: number
  vy?: number
}
interface GLink {
  source: string | GNode
  target: string | GNode
  type: string
  weight: number
}

// Subtle deck tint — low chroma so the map reads calm & Obsidian-like rather
// than a rainbow. -1 hue = deckless (neutral grey).
const HUES = [255, 28, 150, 330, 285, 200, 95, 350, 225, 120]
function deckHue(deckId: string | null): number {
  if (!deckId) return -1
  let h = 0
  for (let i = 0; i < deckId.length; i++) h = (h * 31 + deckId.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

export function GraphScreen() {
  const navigate = useNavigate()
  const t = useT()
  const { data, isLoading } = useQuery({ queryKey: qk.graph, queryFn: getGraph })

  return (
    <>
      <PageHeader title={t('Graph', '圖譜')} subtitle={t('How your notes connect', '你的筆記如何相連')} icon={<Link2 className="size-4" />} />
      <div className="relative flex-1 overflow-hidden bg-dots">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="size-10 animate-pulse rounded-full bg-brand/15" />
          </div>
        ) : data && data.nodes.length > 0 ? (
          <GraphCanvas data={data} onOpen={(id) => navigate({ to: '/notes/$noteId', params: { noteId: id } })} />
        ) : (
          <EmptyState
            className="h-full"
            icon={<Link2 className="size-6" />}
            title={t('Your graph is empty', '你的圖譜還是空的')}
            description={t(
              'Write a couple of notes, then connect them here — turn on link mode and tap two notes to relate them.',
              '先寫幾則筆記，再到這裡連結它們——開啟連結模式，點兩則筆記即可建立關聯。',
            )}
          />
        )}
      </div>
    </>
  )
}

function GraphCanvas({ data, onOpen }: { data: GraphData; onOpen: (id: string) => void }) {
  const t = useT()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<ForceGraphMethods<GNode, GLink> | undefined>(undefined)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)

  // Manual linking ("make associations"): tap two notes to connect them.
  const [linkMode, setLinkMode] = useState(false)
  const [linkSource, setLinkSource] = useState<string | null>(null)
  const link = useLinkNotes()
  const unlink = useUnlinkNotes()

  // Remembered node positions so adding/removing a link doesn't re-shuffle the
  // whole map (the data refetch rebuilds node objects from scratch otherwise).
  const posRef = useRef(new Map<string, { x: number; y: number; vx: number; vy: number }>())
  const didFitRef = useRef(false)

  // Build nodes/links with degree (→ radius) + neighbour adjacency, seeding
  // positions from the last layout where we have them.
  const graph = useMemo(() => {
    const nodes: GNode[] = data.nodes.map((n) => {
      const p = posRef.current.get(n.id)
      return { ...n, deg: 0, r: 4, neighbors: new Set<string>(), x: p?.x, y: p?.y, vx: p?.vx, vy: p?.vy }
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
      n.r = 2.6 + Math.min(n.deg, 8) * 0.7
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

  // Gentle physics: a little repulsion + radius-aware collision so discs breathe.
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    const charge = fg.d3Force('charge') as { strength: (n: number) => void } | undefined
    charge?.strength(-130)
    const linkF = fg.d3Force('link') as { distance: (fn: (l: GLink) => number) => void } | undefined
    linkF?.distance((l) => 36 + (1 - Math.min(l.weight, 3) / 3) * 24)
    fg.d3Force('collide', forceCollide<GNode>().radius((n) => n.r + 5).iterations(2))
    fg.d3ReheatSimulation()
  }, [graph])

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

  // Theme-aware ink so labels read on both paper and charcoal.
  const ink = isDark ? '0.86 0.01 85' : '0.32 0.012 60'
  const paper = isDark ? '0.205 0.012 70' : '0.994 0.003 95'

  function nodeFill(deckId: string | null, alpha: number): string {
    const hue = deckHue(deckId)
    const l = isDark ? 0.7 : 0.62
    const c = hue < 0 ? 0.012 : 0.06
    const h = hue < 0 ? 250 : hue
    return `oklch(${l} ${c} ${h} / ${alpha})`
  }

  const handleNodeClick = useCallback(
    (n: GNode) => {
      if (linkMode) {
        if (!linkSource) {
          setLinkSource(n.id)
        } else if (linkSource === n.id) {
          setLinkSource(null)
        } else {
          const sourceNode = nodeById.get(linkSource)
          link.mutate(
            { source_note_id: linkSource, target_note_id: n.id, link_type: 'related', weight: 1 },
            {
              onSuccess: () =>
                toast.success(t(`Linked “${sourceNode?.title ?? '…'}” ↔ “${n.title}”`, `已連結「${sourceNode?.title ?? '…'}」↔「${n.title}」`)),
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
          warmupTicks={60}
          cooldownTicks={100}
          d3VelocityDecay={0.3}
          minZoom={0.4}
          maxZoom={7}
          onEngineStop={() => {
            if (!didFitRef.current) {
              fgRef.current?.zoomToFit(450, 80)
              didFitRef.current = true
            }
          }}
          onNodeHover={(n) => setHoverId(n?.id ?? null)}
          onNodeClick={handleNodeClick}
          onLinkClick={handleLinkClick}
          onBackgroundClick={() => (linkMode ? setLinkSource(null) : setFocusId(null))}
          linkCanvasObjectMode={() => 'replace'}
          linkCanvasObject={(l, ctx) => {
            const s = l.source as GNode
            const tg = l.target as GNode
            if (s.x == null || tg.x == null) return
            const inFocus = !activeSet || (activeSet.has(s.id) && activeSet.has(tg.id))
            const a = inFocus ? (isDark ? 0.4 : 0.32) : 0.07
            ctx.strokeStyle = `oklch(${isDark ? '0.7 0.01 250' : '0.5 0.008 250'} / ${a})`
            ctx.lineWidth = (0.4 + Math.min(l.weight, 3) * 0.35) * (inFocus ? 1.3 : 1)
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
            // Remember position so a data refetch (link add/remove) keeps layout.
            posRef.current.set(node.id, { x, y, vx: node.vx ?? 0, vy: node.vy ?? 0 })

            const dim = activeSet != null && !activeSet.has(node.id)
            const isActive = active === node.id
            const isSource = linkSource === node.id
            const alpha = dim ? 0.2 : 1

            // Soft focus/selection ring (much quieter than the old glow halo).
            if (isActive || isSource) {
              ctx.beginPath()
              ctx.arc(x, y, r + 4, 0, 2 * Math.PI)
              ctx.fillStyle = nodeFill(node.deck_id, isSource ? 0.28 : 0.16)
              ctx.fill()
            }

            ctx.beginPath()
            ctx.arc(x, y, r, 0, 2 * Math.PI)
            ctx.fillStyle = nodeFill(node.deck_id, alpha)
            ctx.fill()
            if (isSource) {
              ctx.lineWidth = 1.5
              ctx.strokeStyle = `oklch(0.62 0.16 250 / 0.95)`
              ctx.stroke()
            }

            const showLabel = scale > 1.6 || isActive || isSource || (activeSet?.has(node.id) ?? false)
            if (showLabel) {
              const label = node.title.length > 24 ? node.title.slice(0, 23) + '…' : node.title
              const fs = Math.max(9, 10 / scale + 1.2)
              ctx.font = `500 ${fs}px Inter, sans-serif`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              const ly = y + r + 2.5
              ctx.lineWidth = 2.5
              ctx.strokeStyle = `oklch(${paper} / ${dim ? 0.4 : 0.85})` // knockout
              ctx.strokeText(label, x, ly)
              ctx.fillStyle = `oklch(${ink} / ${dim ? 0.4 : 0.92})`
              ctx.fillText(label, x, ly)
            }
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(node.x ?? 0, node.y ?? 0, node.r + 4, 0, 2 * Math.PI)
            ctx.fill()
          }}
        />
      ) : null}

      {/* Floating toolbar — minimal chrome. */}
      <div className="absolute left-3 top-3 flex items-center gap-1.5">
        <button
          onClick={() => {
            setLinkMode((v) => !v)
            setLinkSource(null)
          }}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium shadow-soft backdrop-blur transition ${
            linkMode
              ? 'border-brand bg-brand text-brand-foreground'
              : 'border-border bg-popover/90 text-muted-foreground hover:text-foreground'
          }`}
          title={t('Link notes', '連結筆記')}
        >
          <Link2 className="size-3.5" /> {t('Link', '連結')}
        </button>
        <button
          onClick={() => fgRef.current?.zoomToFit(450, 80)}
          className="flex items-center justify-center rounded-lg border border-border bg-popover/90 p-1.5 text-muted-foreground shadow-soft backdrop-blur transition hover:text-foreground"
          title={t('Fit to screen', '縮放至全圖')}
        >
          <Maximize2 className="size-3.5" />
        </button>
      </div>

      {/* Link-mode hint banner. */}
      {linkMode ? (
        <div className="absolute left-1/2 top-3 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-brand/40 bg-popover/95 px-3 py-1.5 text-[12px] text-foreground shadow-pop backdrop-blur">
          <Unlink className="size-3.5 shrink-0 text-brand" />
          <span className="truncate">
            {linkSource
              ? t('Tap another note to connect — or tap a line to remove it.', '再點一則筆記即可連結 — 或點一條線移除它。')
              : t('Tap two notes to connect them. Tap a line to remove.', '點兩則筆記即可連結。點一條線可移除。')}
          </span>
          <button onClick={() => { setLinkMode(false); setLinkSource(null) }} className="-mr-1 rounded p-0.5 hover:text-brand" aria-label={t('Exit link mode', '結束連結模式')}>
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {/* Focus card — lighter than before. */}
      {focusNode && !linkMode ? (
        <div className="absolute bottom-3 left-1/2 w-[calc(100vw-1.5rem)] max-w-xs -translate-x-1/2 rounded-xl border border-border bg-popover/95 p-3 shadow-pop backdrop-blur sm:bottom-5 sm:w-72">
          <div className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: nodeFill(focusNode.deck_id, 1) }} />
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{focusNode.title}</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(`${focusNode.deg} connection${focusNode.deg === 1 ? '' : 's'}`, `${focusNode.deg} 個關聯`)}
          </p>
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
