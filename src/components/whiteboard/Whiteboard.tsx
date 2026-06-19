import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Check, Eraser, Loader2, Moon, Pencil, SunMedium, Trash2, Undo2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n'
import { cn, humanizeError } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  BOARD_BG,
  DEFAULT_INK,
  SKETCH_SWATCHES,
  drawStroke,
  flatten,
  renderStrokesLayer,
  type SketchBg,
  type SketchScene,
  type SketchStroke,
  type SketchTool,
} from '@/lib/sketch'

const PREFS_KEY = 'mnema:whiteboard'
const SIZES = [3, 6, 12] as const

interface Prefs {
  bg: SketchBg
  color: string
  size: number
}
function readPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
    return {
      bg: raw.bg === 'black' ? 'black' : 'white',
      color: typeof raw.color === 'string' ? raw.color : '',
      size: (SIZES as readonly number[]).includes(raw.size) ? raw.size : 6,
    }
  } catch {
    return { bg: 'white', color: '', size: 6 }
  }
}
function writePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    /* private mode / quota — remembering is only a nicety */
  }
}

const eraserSize = (penSize: number) => Math.max(16, penSize * 4)
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Toolbar chrome adapts to the BOARD colour (not the app theme) so it always
 *  has contrast — a dark glass bar on a whiteboard, a light one on a blackboard. */
interface Chrome {
  bar: string
  solid: string
  btn: string
  activeBtn: string
  divider: string
  swatchBorder: string
  ring: string
}
function chromeFor(bg: SketchBg): Chrome {
  return bg === 'white'
    ? {
        bar: 'bg-neutral-900/80 text-white',
        solid: 'bg-neutral-900/85 text-white hover:bg-neutral-900',
        btn: 'text-white/90 hover:bg-white/15',
        activeBtn: 'bg-white/20 text-white',
        divider: 'bg-white/15',
        swatchBorder: 'border-white/40',
        ring: 'ring-white ring-offset-neutral-900',
      }
    : {
        bar: 'bg-white/85 text-neutral-900',
        solid: 'bg-white/90 text-neutral-900 hover:bg-white',
        btn: 'text-neutral-600 hover:bg-black/10',
        activeBtn: 'bg-black/10 text-neutral-900',
        divider: 'bg-black/10',
        swatchBorder: 'border-black/20',
        ring: 'ring-neutral-900 ring-offset-white',
      }
}

/**
 * A handy freehand whiteboard / blackboard. Strokes (perfect-freehand) ride a
 * transparent canvas over a board-coloured background so the eraser
 * (destination-out) reveals the board, never the page. Strokes are a typed list
 * (the re-editable scene) replayed on undo / resize / DPI change — and animated
 * in when a saved board re-opens. Save flattens to a WebP image. Board state is
 * independent of the app light/dark theme; the floating toolbars carry their own
 * board-aware chrome.
 */
export function Whiteboard({
  initialScene,
  onSave,
  onClose,
  busy,
}: {
  initialScene?: SketchScene | null
  /** Caller uploads the blob + persists the scene, then closes the dialog. */
  onSave: (blob: Blob, scene: SketchScene) => Promise<void> | void
  onClose: () => void
  busy?: boolean
}) {
  const t = useT()
  const prefs = useRef(readPrefs()).current
  const startBg: SketchBg = initialScene?.bg ?? prefs.bg
  const [bg, setBg] = useState<SketchBg>(startBg)
  const [tool, setTool] = useState<SketchTool>('pen')
  const [color, setColor] = useState<string>(prefs.color || DEFAULT_INK[startBg])
  const [size, setSize] = useState<number>(prefs.size)
  const [strokeCount, setStrokeCount] = useState(initialScene?.strokes.length ?? 0)
  const [dirty, setDirty] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [saving, setSaving] = useState(false)
  const [colorTrayOpen, setColorTrayOpen] = useState(false)

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const baseRef = useRef<HTMLCanvasElement | null>(null)
  const strokesRef = useRef<SketchStroke[]>([])
  const inProgress = useRef<SketchStroke | null>(null)
  const activePointer = useRef<number | null>(null)
  const dprRef = useRef(1)
  const sizeRef = useRef({ w: 1, h: 1 })
  const loadedRef = useRef(false)
  const replayRef = useRef<number | null>(null)
  const replaying = useRef(false)

  // ── Imperative canvas drawing (kept out of React render) ────────────────────
  function repaint() {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    if (baseRef.current) ctx.drawImage(baseRef.current, 0, 0)
    if (inProgress.current) drawStroke(ctx, inProgress.current, dprRef.current, dprRef.current)
  }
  function rebuildBase() {
    const base = baseRef.current
    const bctx = base?.getContext('2d')
    if (!base || !bctx) return
    bctx.clearRect(0, 0, base.width, base.height)
    renderStrokesLayer(bctx, strokesRef.current, dprRef.current, dprRef.current)
    repaint()
  }

  function stopReplay(finalize: boolean) {
    if (replayRef.current != null) cancelAnimationFrame(replayRef.current)
    replayRef.current = null
    replaying.current = false
    if (finalize) rebuildBase()
  }

  /** Re-draw a saved board stroke-by-stroke so re-opening feels alive. */
  function animateReplay() {
    const strokes = strokesRef.current
    const base = baseRef.current
    const bctx = base?.getContext('2d')
    const total = strokes.reduce((n, s) => n + s.p.length, 0)
    if (!base || !bctx || !total) {
      rebuildBase()
      return
    }
    replaying.current = true
    const dpr = dprRef.current
    const duration = Math.min(1100, Math.max(380, total * 1.1))
    const ease = (x: number) => 1 - Math.pow(1 - x, 3)
    let start: number | null = null
    const frame = (ts: number) => {
      if (start == null) start = ts
      const p = Math.min(1, (ts - start) / duration)
      const reveal = Math.max(1, Math.floor(ease(p) * total))
      bctx.clearRect(0, 0, base.width, base.height)
      let acc = 0
      for (const s of strokes) {
        if (acc + s.p.length <= reveal) {
          drawStroke(bctx, s, dpr, dpr)
          acc += s.p.length
        } else {
          const n = reveal - acc
          if (n >= 2) drawStroke(bctx, { ...s, p: s.p.slice(0, n) }, dpr, dpr)
          break
        }
      }
      repaint()
      if (p < 1) replayRef.current = requestAnimationFrame(frame)
      else stopReplay(true)
    }
    replayRef.current = requestAnimationFrame(frame)
  }

  function pointFrom(e: PointerEvent | ReactPointerEvent): number[] {
    const c = canvasRef.current!
    const rect = c.getBoundingClientRect()
    const native = 'nativeEvent' in e ? e.nativeEvent : e
    const pressure = native.pointerType === 'mouse' || !native.pressure ? 0.5 : native.pressure
    return [native.clientX - rect.left, native.clientY - rect.top, pressure]
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (saving || confirmClose || !e.isPrimary) return
    if (replaying.current) stopReplay(true) // user wants to draw — finish the intro now
    if (colorTrayOpen) setColorTrayOpen(false)
    canvasRef.current?.setPointerCapture(e.pointerId)
    activePointer.current = e.pointerId
    inProgress.current = {
      t: tool,
      c: color,
      s: tool === 'eraser' ? eraserSize(size) : size,
      p: [pointFrom(e)],
    }
    repaint()
  }
  function onPointerMove(e: ReactPointerEvent) {
    if (activePointer.current !== e.pointerId || !inProgress.current) return
    const native = e.nativeEvent as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] }
    const coalesced = native.getCoalescedEvents?.() ?? [e.nativeEvent]
    for (const ev of coalesced) inProgress.current.p.push(pointFrom(ev))
    repaint()
  }
  function endStroke(e: ReactPointerEvent) {
    if (activePointer.current !== e.pointerId) return
    activePointer.current = null
    const stroke = inProgress.current
    inProgress.current = null
    if (!stroke) return
    const bctx = baseRef.current?.getContext('2d')
    if (bctx) drawStroke(bctx, stroke, dprRef.current, dprRef.current)
    strokesRef.current.push(stroke)
    setStrokeCount(strokesRef.current.length)
    setDirty(true)
    repaint()
  }

  function undo() {
    if (!strokesRef.current.length) return
    if (replaying.current) stopReplay(false)
    strokesRef.current.pop()
    setStrokeCount(strokesRef.current.length)
    setDirty(true)
    rebuildBase()
  }
  function clearAll() {
    if (!strokesRef.current.length) return
    if (replaying.current) stopReplay(false)
    strokesRef.current = []
    setStrokeCount(0)
    setDirty(true)
    rebuildBase()
  }
  function toggleBg() {
    const next: SketchBg = bg === 'white' ? 'black' : 'white'
    setBg(next)
    if (color === DEFAULT_INK[bg]) setColor(DEFAULT_INK[next])
    if (strokesRef.current.length) setDirty(true)
    writePrefs({ bg: next, color, size })
  }
  function pickColor(c: string) {
    setColor(c)
    if (tool !== 'pen') setTool('pen')
    setColorTrayOpen(false)
    writePrefs({ bg, color: c, size })
  }
  function cycleSize() {
    const i = SIZES.indexOf(size as (typeof SIZES)[number])
    const next = SIZES[(i + 1) % SIZES.length]
    setSize(next)
    writePrefs({ bg, color, size: next })
  }

  function requestClose() {
    if (saving) return
    if (dirty) setConfirmClose(true)
    else onClose()
  }

  async function doSave() {
    if (saving || busy || !strokesRef.current.length) return
    setSaving(true)
    try {
      const scene: SketchScene = { v: 1, bg, w: sizeRef.current.w, h: sizeRef.current.h, strokes: strokesRef.current }
      const blob = await flatten(scene)
      writePrefs({ bg, color, size })
      await onSave(blob, scene)
      // Parent closes the dialog on success.
    } catch (err) {
      toast.error(humanizeError(err, ['Could not save the drawing', '無法儲存塗鴉']))
      setSaving(false)
    }
  }

  // ── Size / DPI: measure the canvas area, (re)build backing stores, replay ────
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    let timer: ReturnType<typeof setTimeout> | undefined

    const measure = () => {
      const rect = wrap.getBoundingClientRect()
      const cssW = Math.max(1, Math.floor(rect.width))
      const cssH = Math.max(1, Math.floor(rect.height))
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      if (cssW === sizeRef.current.w && cssH === sizeRef.current.h && dpr === dprRef.current && baseRef.current) {
        return
      }
      sizeRef.current = { w: cssW, h: cssH }
      dprRef.current = dpr
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      if (!baseRef.current) baseRef.current = document.createElement('canvas')
      baseRef.current.width = canvas.width
      baseRef.current.height = canvas.height

      const firstLoad = !loadedRef.current
      if (firstLoad && initialScene && initialScene.strokes.length) {
        const sc = Math.min(cssW / Math.max(1, initialScene.w), cssH / Math.max(1, initialScene.h))
        const ox = (cssW - initialScene.w * sc) / 2
        const oy = (cssH - initialScene.h * sc) / 2
        strokesRef.current = initialScene.strokes.map((st) => ({
          ...st,
          s: st.s * sc,
          p: st.p.map(([x, y, pr]) => [x * sc + ox, y * sc + oy, pr ?? 0.5]),
        }))
        setStrokeCount(strokesRef.current.length)
      }
      loadedRef.current = true

      // A resize mid-replay just snaps to the finished drawing.
      if (replayRef.current != null) stopReplay(false)
      if (firstLoad && strokesRef.current.length && !prefersReducedMotion()) animateReplay()
      else rebuildBase()
    }

    measure()
    const ro = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(measure, 150)
    })
    ro.observe(wrap)
    return () => {
      clearTimeout(timer)
      ro.disconnect()
      if (replayRef.current != null) cancelAnimationFrame(replayRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Escape mirrors Close (dirty-aware).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        requestClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saving])

  const chrome = chromeFor(bg)
  const swatches = [DEFAULT_INK[bg], ...SKETCH_SWATCHES]
  const board = BOARD_BG[bg]

  return (
    <div className="relative h-full w-full select-none overflow-hidden" style={{ background: board }}>
      {/* Full-bleed canvas. */}
      <div ref={wrapRef} className="absolute inset-0" style={{ overscrollBehavior: 'contain' }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
          style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        />
      </div>

      {/* Top: Close (left) + Save (right) — float clear of the notch. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={requestClose}
          aria-label={t('Close', '關閉')}
          title={t('Close', '關閉')}
          className={cn(
            'pointer-events-auto flex size-10 items-center justify-center rounded-full shadow-md backdrop-blur transition',
            chrome.solid,
          )}
        >
          <X className="size-5" />
        </button>
        <Button
          variant="brand"
          onClick={doSave}
          disabled={!strokeCount || saving || busy}
          className="pointer-events-auto h-10 rounded-full px-5 shadow-md"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {t('Save', '儲存')}
        </Button>
      </div>

      {/* Bottom: tool dock (board-aware glass), with an expanding colour tray. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        {colorTrayOpen ? (
          <div
            className={cn(
              'pointer-events-auto flex items-center gap-2 rounded-2xl px-3 py-2 shadow-lg ring-1 ring-black/5 backdrop-blur',
              'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-150',
              chrome.bar,
            )}
          >
            {swatches.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => pickColor(c)}
                aria-label={t('Colour', '顏色')}
                aria-pressed={tool === 'pen' && color === c}
                className={cn(
                  'size-7 rounded-full border transition hover:scale-110',
                  chrome.swatchBorder,
                  tool === 'pen' && color === c && `ring-2 ring-offset-2 ${chrome.ring}`,
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        ) : null}

        <div
          className={cn(
            'pointer-events-auto flex items-center gap-0.5 rounded-2xl p-1.5 shadow-lg ring-1 ring-black/5 backdrop-blur',
            chrome.bar,
          )}
        >
          <DockBtn active={tool === 'pen'} onClick={() => setTool('pen')} label={t('Pen', '畫筆')} chrome={chrome}>
            <Pencil className="size-5" />
          </DockBtn>
          <DockBtn active={tool === 'eraser'} onClick={() => setTool('eraser')} label={t('Eraser', '橡皮擦')} chrome={chrome}>
            <Eraser className="size-5" />
          </DockBtn>

          <Divider chrome={chrome} />

          <button
            type="button"
            onClick={() => {
              if (tool !== 'pen') setTool('pen')
              setColorTrayOpen((o) => !o)
            }}
            aria-label={t('Colour', '顏色')}
            title={t('Colour', '顏色')}
            className={cn('flex size-9 items-center justify-center rounded-xl transition', chrome.btn, colorTrayOpen && chrome.activeBtn)}
          >
            <span
              className={cn('size-5 rounded-full border', chrome.swatchBorder)}
              style={{ background: tool === 'pen' ? color : DEFAULT_INK[bg] }}
            />
          </button>
          <button
            type="button"
            onClick={cycleSize}
            aria-label={t('Brush size', '筆刷粗細')}
            title={t('Brush size', '筆刷粗細')}
            className={cn('flex size-9 items-center justify-center rounded-xl transition', chrome.btn)}
          >
            <span className="rounded-full bg-current transition-all" style={{ width: 4 + size, height: 4 + size }} />
          </button>

          <Divider chrome={chrome} />

          <DockBtn onClick={undo} disabled={!strokeCount} label={t('Undo', '復原')} chrome={chrome}>
            <Undo2 className="size-5" />
          </DockBtn>
          <DockBtn onClick={clearAll} disabled={!strokeCount} label={t('Clear', '清除')} chrome={chrome}>
            <Trash2 className="size-5" />
          </DockBtn>

          <Divider chrome={chrome} />

          <DockBtn
            onClick={toggleBg}
            label={bg === 'white' ? t('Switch to blackboard', '切換黑板') : t('Switch to whiteboard', '切換白板')}
            chrome={chrome}
          >
            {bg === 'white' ? <Moon className="size-5" /> : <SunMedium className="size-5" />}
          </DockBtn>
        </div>
      </div>

      {confirmClose ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-foreground/40 px-6 backdrop-blur-[2px]">
          <div className="w-full max-w-xs rounded-2xl bg-card p-5 text-center shadow-pop">
            <p className="text-sm font-semibold text-foreground">{t('Discard this drawing?', '放棄這張塗鴉？')}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{t('Your strokes will be lost.', '你畫的內容將會遺失。')}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmClose(false)}>
                {t('Keep drawing', '繼續畫')}
              </Button>
              <Button variant="destructive" size="sm" onClick={onClose}>
                {t('Discard', '放棄')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Divider({ chrome }: { chrome: Chrome }) {
  return <span className={cn('mx-0.5 h-6 w-px shrink-0', chrome.divider)} />
}

function DockBtn({
  children,
  onClick,
  active,
  disabled,
  label,
  chrome,
}: {
  children: ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
  label: string
  chrome: Chrome
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-xl transition disabled:opacity-35 disabled:hover:bg-transparent',
        chrome.btn,
        active && chrome.activeBtn,
      )}
    >
      {children}
    </button>
  )
}
