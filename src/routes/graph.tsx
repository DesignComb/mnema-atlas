import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d'
import { forceCollide } from 'd3-force'
import { ArrowUpRight, Share2 } from 'lucide-react'
import { getGraph, type GraphData } from '@/lib/api'
import { qk } from '@/lib/hooks'
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
}
interface GLink {
  source: string | GNode
  target: string | GNode
  type: string
  weight: number
}

// A calm, perceptually-even deck wheel in OKLCH (matches the app's token system).
const HUES = [255, 28, 150, 330, 285, 200, 95, 350, 225, 120]
function deckHue(deckId: string | null): number {
  if (!deckId) return -1
  let h = 0
  for (let i = 0; i < deckId.length; i++) h = (h * 31 + deckId.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}
function deckColor(deckId: string | null, l = 0.63, c = 0.13, a = 1): string {
  const hue = deckHue(deckId)
  if (hue < 0) return `oklch(0.68 0.015 250 / ${a})` // deckless → quiet grey
  return `oklch(${l} ${c} ${hue} / ${a})`
}

export function GraphScreen() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({ queryKey: qk.graph, queryFn: getGraph })

  return (
    <>
      <PageHeader title="Graph" subtitle="How your notes connect" icon={<Share2 className="size-4" />} />
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
            icon={<Share2 className="size-6" />}
            title="Your graph is empty"
            description="Link notes via the link_notes tool (or an AI assistant), and they'll appear here as a living map of your knowledge."
          />
        )}
      </div>
    </>
  )
}

function GraphCanvas({ data, onOpen }: { data: GraphData; onOpen: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<ForceGraphMethods<GNode, GLink> | undefined>(undefined)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)

  // Build nodes/links with degree (→ radius) and neighbour adjacency.
  const graph = useMemo(() => {
    const nodes: GNode[] = data.nodes.map((n) => ({ ...n, deg: 0, r: 4, neighbors: new Set<string>() }))
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const links: GLink[] = []
    for (const e of data.edges) {
      const s = byId.get(e.source)
      const t = byId.get(e.target)
      if (!s || !t) continue
      links.push({ source: e.source, target: e.target, type: e.type, weight: e.weight })
      s.deg++
      t.deg++
      s.neighbors.add(t.id)
      t.neighbors.add(s.id)
    }
    nodes.forEach((n) => {
      n.r = 3.5 + Math.min(n.deg, 10) * 0.85
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

  // Tune the physics: a touch more repulsion + radius-aware collision so discs
  // breathe instead of overlapping.
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    const charge = fg.d3Force('charge') as { strength: (n: number) => void } | undefined
    charge?.strength(-150)
    const link = fg.d3Force('link') as { distance: (fn: (l: GLink) => number) => void } | undefined
    link?.distance((l) => 34 + (1 - Math.min(l.weight, 3) / 3) * 26)
    fg.d3Force('collide', forceCollide<GNode>().radius((n) => n.r + 6).iterations(2))
    fg.d3ReheatSimulation()
  }, [graph])

  const active = focusId ?? hoverId
  const activeSet = useMemo(() => {
    if (!active) return null
    const n = nodeById.get(active)
    if (!n) return null
    const s = new Set<string>([n.id])
    n.neighbors.forEach((id) => s.add(id))
    return s
  }, [active, nodeById])

  const focusNode = focusId ? nodeById.get(focusId) : null

  return (
    <div ref={containerRef} className="absolute inset-0">
      {size.w > 0 ? (
        <ForceGraph2D<GNode, GLink>
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={graph}
          backgroundColor="rgba(0,0,0,0)"
          warmupTicks={80}
          cooldownTicks={140}
          d3VelocityDecay={0.28}
          minZoom={0.4}
          maxZoom={7}
          onEngineStop={() => fgRef.current?.zoomToFit(500, 70)}
          onNodeHover={(n) => setHoverId(n?.id ?? null)}
          onNodeClick={(n) => (focusId === n.id ? onOpen(n.id) : setFocusId(n.id))}
          onBackgroundClick={() => setFocusId(null)}
          linkCanvasObjectMode={() => 'replace'}
          linkCanvasObject={(link, ctx) => {
            const s = link.source as GNode
            const t = link.target as GNode
            if (s.x == null || t.x == null) return
            const inFocus = !activeSet || (activeSet.has(s.id) && activeSet.has(t.id))
            const a = inFocus ? 0.5 : 0.05
            const grad = ctx.createLinearGradient(s.x, s.y ?? 0, t.x, t.y ?? 0)
            grad.addColorStop(0, deckColor(s.deck_id, 0.6, 0.1, a))
            grad.addColorStop(1, deckColor(t.deck_id, 0.6, 0.1, a))
            ctx.strokeStyle = grad
            ctx.lineWidth = (0.5 + Math.min(link.weight, 3) * 0.5) * (inFocus ? 1.4 : 1)
            ctx.beginPath()
            ctx.moveTo(s.x, s.y ?? 0)
            ctx.lineTo(t.x, t.y ?? 0)
            ctx.stroke()
          }}
          nodeCanvasObjectMode={() => 'replace'}
          nodeCanvasObject={(node, ctx, scale) => {
            const x = node.x ?? 0
            const y = node.y ?? 0
            const r = node.r
            const dim = activeSet != null && !activeSet.has(node.id)
            const isActive = active === node.id
            const alpha = dim ? 0.22 : 1

            if (isActive) {
              ctx.beginPath()
              ctx.arc(x, y, r + 7, 0, 2 * Math.PI)
              ctx.fillStyle = deckColor(node.deck_id, 0.72, 0.12, 0.18)
              ctx.fill()
            }

            ctx.save()
            ctx.shadowColor = 'oklch(0.4 0.02 250 / 0.18)'
            ctx.shadowBlur = dim ? 0 : 6
            ctx.beginPath()
            ctx.arc(x, y, r, 0, 2 * Math.PI)
            ctx.fillStyle = deckColor(node.deck_id, 0.64, 0.13, alpha)
            ctx.fill()
            ctx.restore()

            ctx.beginPath()
            ctx.arc(x, y, r, 0, 2 * Math.PI)
            ctx.lineWidth = 1.2
            ctx.strokeStyle = deckColor(node.deck_id, 0.45, 0.14, dim ? 0.25 : 0.9)
            ctx.stroke()

            const showLabel = scale > 1.3 || isActive || (activeSet?.has(node.id) ?? false)
            if (showLabel) {
              const label = node.title.length > 26 ? node.title.slice(0, 25) + '…' : node.title
              const fs = Math.max(10, 11 / scale + 1.5)
              ctx.font = `500 ${fs}px Inter, sans-serif`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              const ly = y + r + 3
              ctx.lineWidth = 3
              ctx.strokeStyle = `oklch(0.994 0.003 95 / ${dim ? 0.5 : 0.92})` // knockout
              ctx.strokeText(label, x, ly)
              ctx.fillStyle = `oklch(0.32 0.012 60 / ${dim ? 0.4 : 0.95})`
              ctx.fillText(label, x, ly)
            }
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(node.x ?? 0, node.y ?? 0, node.r + 3, 0, 2 * Math.PI)
            ctx.fill()
          }}
        />
      ) : null}

      {/* Soft vignette to settle the edges */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 100% at 50% 42%, transparent 58%, oklch(0.95 0.004 85 / 0.55) 100%)' }}
      />

      <div className="pointer-events-none absolute right-4 top-4 text-[11px] text-muted-foreground/70">
        Click a node to focus · click again to open
      </div>

      {focusNode ? (
        <div className="absolute bottom-5 left-1/2 w-72 -translate-x-1/2 rounded-xl border border-border bg-popover/95 p-3.5 shadow-pop backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: deckColor(focusNode.deck_id) }} />
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{focusNode.title}</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {focusNode.deg} connection{focusNode.deg === 1 ? '' : 's'}
          </p>
          <button
            onClick={() => onOpen(focusNode.id)}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[13px] font-medium text-brand-foreground transition hover:opacity-90"
          >
            Open note <ArrowUpRight className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
