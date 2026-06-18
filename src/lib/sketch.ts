import { getStroke } from 'perfect-freehand'

/**
 * Quick-whiteboard / blackboard model. A "sketch" is a freehand drawing stored
 * two ways at once:
 *   • flattened to a PNG/WebP image (lives in a note's body as ![](url) — so it
 *     shows in the notes list, the Sketches lens, search, .md export, the graph);
 *   • as this re-editable vector SCENE (saved in notes.sketch_scene) so the board
 *     can be re-opened and kept editing.
 *
 * Strokes use perfect-freehand; the eraser is a real stroke composited with
 * `destination-out` (NOT a background-coloured stroke) so undo can replay it.
 * The geometry helpers here are deliberately framework-free; the canvas-touching
 * ones run only in the browser. `firstImageUrl` is pure (unit-tested).
 */

export type SketchTool = 'pen' | 'eraser'
export type SketchBg = 'white' | 'black'

/** One freehand stroke. Points are [x, y, pressure] in the scene's logical px. */
export interface SketchStroke {
  /** 'pen' paints `c`; 'eraser' composites destination-out (colour ignored). */
  t: SketchTool
  /** Pen colour (CSS hex). */
  c: string
  /** Base brush size in logical px (perfect-freehand `size`). */
  s: number
  /** Input points: [x, y, pressure?]. */
  p: number[][]
}

/** The serialisable drawing. Stored in notes.sketch_scene (jsonb). */
export interface SketchScene {
  /** Schema version — lets future loaders migrate older scenes. */
  v: 1
  bg: SketchBg
  /** Logical canvas size at draw time (used to rescale on re-open/export). */
  w: number
  h: number
  strokes: SketchStroke[]
}

/** Board background colours — shared by the live canvas CSS and the export. */
export const BOARD_BG: Record<SketchBg, string> = {
  white: '#fbfbf9',
  black: '#16201d',
}

/** Default ink that reads well on each board. */
export const DEFAULT_INK: Record<SketchBg, string> = {
  white: '#1f2937',
  black: '#f1f5f9',
}

/** Pen colour swatches offered in the toolbar (ink is prepended per-board). */
export const SKETCH_SWATCHES = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'] as const

export function emptyScene(bg: SketchBg, w: number, h: number): SketchScene {
  return { v: 1, bg, w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)), strokes: [] }
}

export function isBlankScene(scene: SketchScene | null | undefined): boolean {
  return !scene || !Array.isArray(scene.strokes) || scene.strokes.length === 0
}

/**
 * Best-effort parse of an unknown jsonb blob back into a SketchScene. Returns
 * null if it isn't a recognisable scene (so re-edit can start fresh instead of
 * throwing on a hand-mangled row).
 */
export function parseScene(raw: unknown): SketchScene | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.bg !== 'white' && o.bg !== 'black') return null
  if (!Array.isArray(o.strokes)) return null
  const w = typeof o.w === 'number' && o.w > 0 ? o.w : 1
  const h = typeof o.h === 'number' && o.h > 0 ? o.h : 1
  const strokes: SketchStroke[] = []
  for (const s of o.strokes as unknown[]) {
    if (!s || typeof s !== 'object') continue
    const st = s as Record<string, unknown>
    if (st.t !== 'pen' && st.t !== 'eraser') continue
    if (!Array.isArray(st.p)) continue
    strokes.push({
      t: st.t,
      c: typeof st.c === 'string' ? st.c : '#000000',
      s: typeof st.s === 'number' ? st.s : 4,
      p: (st.p as unknown[]).filter(Array.isArray).map((pt) => (pt as number[]).map(Number)),
    })
  }
  return { v: 1, bg: o.bg, w, h, strokes }
}

/** First markdown image URL in a body (handles titles + <angle-bracket> URLs). */
export function firstImageUrl(body: string | null | undefined): string | null {
  if (!body) return null
  const m = body.match(/!\[[^\]]*\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/)
  if (!m) return null
  let url = m[1].trim()
  if (url.startsWith('<') && url.endsWith('>')) url = url.slice(1, -1)
  return url || null
}

// ── Canvas rendering (browser only) ───────────────────────────────────────────

/** perfect-freehand outline for a stroke, scaled from scene-space to target-space. */
function scaledOutline(stroke: SketchStroke, sx: number, sy: number): number[][] {
  const s = (sx + sy) / 2
  const input = stroke.p.map(([x, y, pr]) => [x * sx, y * sy, pr == null || pr <= 0 ? 0.5 : pr])
  return getStroke(input, {
    size: Math.max(1, stroke.s * s),
    thinning: stroke.t === 'eraser' ? 0 : 0.55,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: false,
    last: true,
  }) as number[][]
}

/** Paint one stroke onto a TRANSPARENT layer (caller composites over the bg). */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: SketchStroke, sx = 1, sy = 1): void {
  const outline = scaledOutline(stroke, sx, sy)
  if (outline.length < 2) return
  const path = new Path2D()
  path.moveTo(outline[0][0], outline[0][1])
  for (let i = 1; i < outline.length; i++) path.lineTo(outline[i][0], outline[i][1])
  path.closePath()
  ctx.globalCompositeOperation = stroke.t === 'eraser' ? 'destination-out' : 'source-over'
  ctx.fillStyle = stroke.t === 'eraser' ? '#000' : stroke.c
  ctx.fill(path)
  ctx.globalCompositeOperation = 'source-over'
}

/** Replay every stroke onto a transparent layer at the given scale. */
export function renderStrokesLayer(ctx: CanvasRenderingContext2D, strokes: SketchStroke[], sx = 1, sy = 1): void {
  for (const st of strokes) drawStroke(ctx, st, sx, sy)
}

/**
 * Flatten a scene to an image Blob: bg fill + strokes (strokes go on a separate
 * transparent layer first so the eraser reveals the BOARD bg, never the page).
 * Defaults to WebP — line art is visually lossless and reliably under the 5 MB
 * `uploads` cap, where a high-DPI PNG can blow past it. Long edge capped so the
 * upload stays small regardless of device pixel ratio.
 */
export async function flatten(
  scene: SketchScene,
  opts: { maxEdge?: number; type?: string; quality?: number } = {},
): Promise<Blob> {
  const maxEdge = opts.maxEdge ?? 2048
  const type = opts.type ?? 'image/webp'
  const quality = opts.quality ?? 0.85
  const w = Math.max(1, scene.w)
  const h = Math.max(1, scene.h)
  const long = Math.max(w, h)
  const scale = long > maxEdge ? maxEdge / long : 1
  const outW = Math.max(1, Math.round(w * scale))
  const outH = Math.max(1, Math.round(h * scale))

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D unavailable')
  ctx.fillStyle = BOARD_BG[scene.bg]
  ctx.fillRect(0, 0, outW, outH)

  const layer = document.createElement('canvas')
  layer.width = outW
  layer.height = outH
  const lctx = layer.getContext('2d')
  if (!lctx) throw new Error('Canvas 2D unavailable')
  renderStrokesLayer(lctx, scene.strokes, scale, scale)
  ctx.drawImage(layer, 0, 0)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Export failed'))),
      type,
      quality,
    )
  })
}
