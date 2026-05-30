import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d'
import { Share2 } from 'lucide-react'
import { getGraph, type GraphData } from '@/lib/api'
import { qk } from '@/lib/hooks'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'

interface GNode {
  id: string
  title: string
  deck_id: string | null
  neighbors?: GNode[]
  links?: GLink[]
  x?: number
  y?: number
}
interface GLink {
  source: string | GNode
  target: string | GNode
}

// A small, calm palette so the graph reads as Notion-clean, not dark-neon.
const PALETTE = ['#5b7cfa', '#e0833b', '#3aa675', '#c2557a', '#8a6fd1', '#3a9bbf', '#b08900']
function deckColor(deckId: string | null): string {
  if (!deckId) return '#9aa0aa'
  let h = 0
  for (let i = 0; i < deckId.length; i++) h = (h * 31 + deckId.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export function GraphScreen() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({ queryKey: qk.graph, queryFn: getGraph })

  return (
    <>
      <PageHeader
        title="Graph"
        subtitle="How your notes connect"
        icon={<Share2 className="size-4" />}
      />
      <div className="relative flex-1 overflow-hidden bg-dots">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading graph…
          </div>
        ) : data && data.nodes.length > 0 ? (
          <GraphCanvas
            data={data}
            onOpen={(id) => navigate({ to: '/notes/$noteId', params: { noteId: id } })}
          />
        ) : (
          <EmptyState
            className="h-full"
            icon={<Share2 className="size-6" />}
            title="Your graph is empty"
            description="Link notes with [[wikilinks]] (coming in the editor) or via the link_notes tool, and they'll appear here as a living map."
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
  const [hovered, setHovered] = useState<GNode | null>(null)

  // Build graph data with neighbor adjacency for hover highlighting.
  const graph = useMemo(() => {
    const nodes: GNode[] = data.nodes.map((n) => ({ ...n, neighbors: [], links: [] }))
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const links: GLink[] = []
    for (const e of data.edges) {
      const s = byId.get(e.source)
      const t = byId.get(e.target)
      if (!s || !t) continue
      const link: GLink = { source: e.source, target: e.target }
      links.push(link)
      s.neighbors!.push(t)
      t.neighbors!.push(s)
      s.links!.push(link)
      t.links!.push(link)
    }
    return { nodes, links }
  }, [data])

  // Measure the container (ResizeObserver) so the canvas fills the panel.
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

  const highlightNodes = useMemo(() => {
    const set = new Set<string>()
    if (hovered) {
      set.add(hovered.id)
      hovered.neighbors?.forEach((n) => set.add(n.id))
    }
    return set
  }, [hovered])

  return (
    <div ref={containerRef} className="absolute inset-0">
      {size.w > 0 ? (
        <ForceGraph2D<GNode, GLink>
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={graph}
          backgroundColor="rgba(0,0,0,0)"
          cooldownTicks={120}
          onEngineStop={() => fgRef.current?.zoomToFit(400, 60)}
          nodeRelSize={5}
          nodeColor={(n) => deckColor(n.deck_id)}
          linkColor={() => 'rgba(120,125,135,0.25)'}
          linkWidth={(l) =>
            hovered && (isEnd(l.source, hovered) || isEnd(l.target, hovered)) ? 1.6 : 0.6
          }
          onNodeHover={(n) => setHovered(n ?? null)}
          onNodeClick={(n) => onOpen(n.id)}
          nodeCanvasObjectMode={() => 'after'}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const dim = hovered != null && !highlightNodes.has(node.id)
            const r = 5
            // node dot
            ctx.beginPath()
            ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI)
            ctx.fillStyle = deckColor(node.deck_id)
            ctx.globalAlpha = dim ? 0.25 : 1
            ctx.fill()
            // label
            if (globalScale > 1.1 || highlightNodes.has(node.id)) {
              const label = node.title.length > 28 ? node.title.slice(0, 27) + '…' : node.title
              ctx.font = `${11 / globalScale + 2}px Inter, sans-serif`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              ctx.fillStyle = dim ? 'rgba(90,95,105,0.4)' : 'rgba(60,62,70,0.92)'
              ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + r + 2)
            }
            ctx.globalAlpha = 1
          }}
        />
      ) : null}
    </div>
  )
}

function isEnd(endpoint: string | GNode, node: GNode): boolean {
  return typeof endpoint === 'string' ? endpoint === node.id : endpoint.id === node.id
}
