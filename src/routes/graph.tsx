import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

interface GNode {
  id: string
  title: string
  deck_id: string | null
  tags: string[]
  deg: number
  r: number
  neighbors: Set<string>
  x?: number
  y?: number
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

  // Pick the grouping key for a node under the current colour mode.
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

  // Default to whichever mode actually has data (tags preferred, else decks).
  useEffect(() => {
    const anyTag = data.nodes.some((n) => n.tags.length)
    if (!anyTag && data.nodes.some((n) => n.deck_id)) setColorBy('deck')
    // run once per dataset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const graph = useMemo(() => {
    const nodes: GNode[] = data.nodes.map((n) => {
      const p = posRef.current.get(n.id)
      return { ...n, tags: n.tags ?? [], deg: 0, r: 4, neighbors: new Set<string>(), x: p?.x, y: p?.y, vx: p?.vx, vy: p?.vy }
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
      n.r = 1.8 + Math.min(n.deg, 8) * 0.5 // smaller, quieter dots
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

  // Configure forces + fixed positions whenever the data, layout, or grouping
  // changes. Force layout clusters by group; radial/tree pin positions.
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
      charge?.strength(-95)
      linkF?.distance((l) => 34 + (1 - Math.min(l.weight, 3) / 3) * 22)
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
    const id = setTimeout(() => fgRef.current?.zoomToFit(420, 70), layout === 'force' ? 600 : 80)
    return () => clearTimeout(id)
    // size.w: re-run once the canvas (and thus fgRef) has actually mounted.
  }, [graph, layout, colorBy, groupKey, size.w])

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
  const ink = isDark ? '0.86 0.01 85' : '0.34 0.012 60'
  const paper = isDark ? '0.21 0.012 70' : '0.994 0.003 95'

  function groupColor(key: string, l: number, c: number, a: number): string {
    if (key === UNTAGGED) return `oklch(${isDark ? 0.62 : 0.64} 0.006 250 / ${a})`
    return `oklch(${l} ${c} ${tagHue(key)} / ${a})`
  }
  const nodeFill = (n: GNode, alpha: number) => groupColor(groupKey(n), isDark ? 0.72 : 0.6, 0.085, alpha)

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
          warmupTicks={layout === 'force' ? 60 : 0}
          cooldownTicks={layout === 'force' ? 120 : 0}
          d3VelocityDecay={0.3}
          minZoom={0.3}
          maxZoom={8}
          onEngineStop={() => {
            if (!didFitRef.current) {
              fgRef.current?.zoomToFit(420, 70)
              didFitRef.current = true
            }
          }}
          onNodeHover={(n) => setHoverId(n?.id ?? null)}
          onNodeClick={handleNodeClick}
          onLinkClick={handleLinkClick}
          onBackgroundClick={() => (linkMode ? setLinkSource(null) : setFocusId(null))}
          // Cluster hulls behind everything — a soft union-of-discs blob per group.
          onRenderFramePre={(ctx) => {
            const groups = new Map<string, GNode[]>()
            for (const n of graph.nodes) {
              const k = groupKey(n)
              if (k === UNTAGGED) continue
              const arr = groups.get(k)
              if (arr) arr.push(n)
              else groups.set(k, [n])
            }
            for (const [key, members] of groups) {
              ctx.beginPath()
              for (const n of members) {
                const r = n.r + 13
                ctx.moveTo((n.x ?? 0) + r, n.y ?? 0)
                ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, 2 * Math.PI)
              }
              ctx.fillStyle = groupColor(key, isDark ? 0.6 : 0.66, 0.1, isDark ? 0.12 : 0.1)
              ctx.fill()
              // faint group label at the centroid
              const label = groupLabel(key)
              if (label && members.length > 1) {
                let cx = 0, cy = 0, minY = Infinity
                for (const n of members) { cx += n.x ?? 0; cy += n.y ?? 0; minY = Math.min(minY, n.y ?? 0) }
                cx /= members.length
                ctx.font = `600 5px Inter, sans-serif`
                ctx.textAlign = 'center'
                ctx.textBaseline = 'bottom'
                ctx.fillStyle = groupColor(key, isDark ? 0.74 : 0.5, 0.12, 0.85)
                ctx.fillText(label.length > 22 ? label.slice(0, 21) + '…' : label, cx, minY - 16)
              }
            }
          }}
          // Guide line while connecting two notes.
          onRenderFramePost={(ctx) => {
            if (!linkMode || !linkSource) return
            const s = nodeById.get(linkSource)
            const tg = hoverId && hoverId !== linkSource ? nodeById.get(hoverId) : null
            if (!s || s.x == null) return
            ctx.save()
            ctx.setLineDash([4, 4])
            ctx.strokeStyle = `oklch(0.62 0.16 250 / 0.8)`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(s.x, s.y ?? 0)
            if (tg && tg.x != null) ctx.lineTo(tg.x, tg.y ?? 0)
            ctx.stroke()
            ctx.restore()
          }}
          linkCanvasObjectMode={() => 'replace'}
          linkCanvasObject={(l, ctx) => {
            const s = l.source as GNode
            const tg = l.target as GNode
            if (s.x == null || tg.x == null) return
            const inFocus = !activeSet || (activeSet.has(s.id) && activeSet.has(tg.id))
            const a = inFocus ? (isDark ? 0.32 : 0.26) : 0.05
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

            if (isActive || isSource) {
              ctx.beginPath()
              ctx.arc(x, y, r + 3.5, 0, 2 * Math.PI)
              ctx.fillStyle = nodeFill(node, isSource ? 0.3 : 0.16)
              ctx.fill()
            }
            ctx.beginPath()
            ctx.arc(x, y, r, 0, 2 * Math.PI)
            ctx.fillStyle = nodeFill(node, alpha)
            ctx.fill()
            if (isSource) {
              ctx.lineWidth = 1.2
              ctx.strokeStyle = `oklch(0.62 0.16 250 / 0.95)`
              ctx.stroke()
            }

            const showLabel = scale > 2.1 || isActive || isSource || (activeSet?.has(node.id) ?? false)
            if (showLabel) {
              const label = node.title.length > 22 ? node.title.slice(0, 21) + '…' : node.title
              const fs = Math.max(7, 8 / scale + 1)
              ctx.font = `500 ${fs}px Inter, sans-serif`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              const ly = y + r + 1.5
              ctx.lineWidth = 2
              ctx.strokeStyle = `oklch(${paper} / ${dim ? 0.4 : 0.8})`
              ctx.strokeText(label, x, ly)
              ctx.fillStyle = `oklch(${ink} / ${dim ? 0.4 : 0.9})`
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
            setLinkMode((v) => !v)
            setLinkSource(null)
          }}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium shadow-soft backdrop-blur transition ${
            linkMode ? 'border-brand bg-brand text-brand-foreground' : 'border-border bg-popover/90 text-muted-foreground hover:text-foreground'
          }`}
          title={t('Link notes', '連結筆記')}
        >
          <Link2 className="size-3.5" /> {t('Link', '連結')}
        </button>
        <button
          onClick={() => fgRef.current?.zoomToFit(420, 70)}
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

function SegBtn({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
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

// ── d3 cluster force: pull same-group nodes toward their shared centroid ──
function clusterForce(groupKeyRef: { current: (n: GNode) => string }) {
  let nodes: GNode[] = []
  function force(alpha: number) {
    const cen = new Map<string, { x: number; y: number; n: number }>()
    for (const n of nodes) {
      const k = groupKeyRef.current(n)
      const c = cen.get(k) ?? { x: 0, y: 0, n: 0 }
      c.x += n.x ?? 0
      c.y += n.y ?? 0
      c.n++
      cen.set(k, c)
    }
    cen.forEach((c) => {
      c.x /= c.n
      c.y /= c.n
    })
    const k = 0.5 * alpha
    for (const n of nodes) {
      const c = cen.get(groupKeyRef.current(n))
      if (!c) continue
      n.vx = (n.vx ?? 0) + (c.x - (n.x ?? 0)) * k
      n.vy = (n.vy ?? 0) + (c.y - (n.y ?? 0)) * k
    }
  }
  force.initialize = (n: GNode[]) => {
    nodes = n
  }
  return force
}

// ── Radial layout: groups evenly around a ring, members in a mini-circle ──
function radialPositions(nodes: GNode[], groupKey: (n: GNode) => string) {
  const pos = new Map<string, { x: number; y: number }>()
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
      if (members.length === 1) {
        pos.set(n.id, { x: cx, y: cy })
      } else {
        const a2 = (2 * Math.PI * i) / members.length
        pos.set(n.id, { x: cx + Math.cos(a2) * rr, y: cy + Math.sin(a2) * rr })
      }
    })
  })
  return pos
}

// ── Tree layout: BFS-layer each connected component, rows by depth ──
function treePositions(nodes: GNode[], links: GLink[]) {
  const pos = new Map<string, { x: number; y: number }>()
  const adj = new Map<string, string[]>()
  nodes.forEach((n) => adj.set(n.id, []))
  const idOf = (e: string | GNode) => (typeof e === 'object' ? e.id : e)
  for (const l of links) {
    const s = idOf(l.source)
    const t = idOf(l.target)
    adj.get(s)?.push(t)
    adj.get(t)?.push(s)
  }
  const remaining = new Set(nodes.map((n) => n.id))
  const byDepth = new Map<number, string[]>()
  const degree = (id: string) => adj.get(id)?.length ?? 0
  while (remaining.size) {
    // root = most-connected remaining node (component anchor)
    let root = ''
    let best = -1
    for (const id of remaining) if (degree(id) > best) { best = degree(id); root = id }
    const queue: [string, number][] = [[root, 0]]
    remaining.delete(root)
    while (queue.length) {
      const [id, d] = queue.shift()!
      ;(byDepth.get(d) ?? byDepth.set(d, []).get(d)!).push(id)
      for (const nb of adj.get(id) ?? []) {
        if (remaining.has(nb)) {
          remaining.delete(nb)
          queue.push([nb, d + 1])
        }
      }
    }
  }
  const rowH = 64
  const colW = 60
  byDepth.forEach((ids, depth) => {
    const w = (ids.length - 1) * colW
    ids.forEach((id, i) => pos.set(id, { x: i * colW - w / 2, y: depth * rowH }))
  })
  return pos
}
