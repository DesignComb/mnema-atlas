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

/**
 * A handy freehand whiteboard / blackboard. Draws with perfect-freehand strokes
 * on a transparent canvas over a board-coloured background, so the eraser
 * (destination-out) reveals the board, never the page. Strokes are kept as a
 * typed list (the re-editable scene) and replayed on undo / resize / DPI change;
 * Save flattens them to a WebP image. All board state is independent of the app
 * light/dark theme, and the toolbar carries its own fixed high-contrast chrome.
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

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const baseRef = useRef<HTMLCanvasElement | null>(null)
  const strokesRef = useRef<SketchStroke[]>([])
  const inProgress = useRef<SketchStroke | null>(null)
  const activePointer = useRef<number | null>(null)
  const dprRef = useRef(1)
  const sizeRef = useRef({ w: 1, h: 1 })
  const loadedRef = useRef(false)

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

  function pointFrom(e: PointerEvent | ReactPointerEvent): number[] {
    const c = canvasRef.current!
    const rect = c.getBoundingClientRect()
    const native = 'nativeEvent' in e ? e.nativeEvent : e
    const pressure =
      native.pointerType === 'mouse' || !native.pressure ? 0.5 : native.pressure
    return [native.clientX - rect.left, native.clientY - rect.top, pressure]
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (saving || confirmClose || !e.isPrimary) return
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
    strokesRef.current.pop()
    setStrokeCount(strokesRef.current.length)
    setDirty(true)
    rebuildBase()
  }
  function clearAll() {
    if (!strokesRef.current.length) return
    strokesRef.current = []
    setStrokeCount(0)
    setDirty(true)
    rebuildBase()
  }
  function toggleBg() {
    const next: SketchBg = bg === 'white' ? 'black' : 'white'
    setBg(next)
    // Keep the default ink readable when the board flips.
    if (color === DEFAULT_INK[bg]) setColor(DEFAULT_INK[next])
    if (strokesRef.current.length) setDirty(true)
    writePrefs({ bg: next, color, size })
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
      const scene: SketchScene = {
        v: 1,
        bg,
        w: sizeRef.current.w,
        h: sizeRef.current.h,
        strokes: strokesRef.current,
      }
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

      // Load a saved scene once, fitted (uniform scale) to the current canvas.
      if (!loadedRef.current && initialScene && initialScene.strokes.length) {
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
      rebuildBase()
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Escape mirrors the Close button (dirty-aware).
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

  const swatches = [DEFAULT_INK[bg], ...SKETCH_SWATCHES]
  const board = BOARD_BG[bg]

  return (
    <div className="flex h-full w-full select-none flex-col">
      {/* Fixed high-contrast chrome — reads on either board colour. */}
      <div className="flex items-center gap-2 bg-black/85 px-2 py-2 text-white backdrop-blur">
        <ChromeButton onClick={requestClose} label={t('Close', '關閉')}>
          <X className="size-5" />
        </ChromeButton>

        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          <ChromeButton active={tool === 'pen'} onClick={() => setTool('pen')} label={t('Pen', '畫筆')}>
            <Pencil className="size-5" />
          </ChromeButton>
          <ChromeButton active={tool === 'eraser'} onClick={() => setTool('eraser')} label={t('Eraser', '橡皮擦')}>
            <Eraser className="size-5" />
          </ChromeButton>

          {tool === 'pen' ? (
            <div className="ml-1 flex items-center gap-1">
              {swatches.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={t('Colour', '顏色')}
                  aria-pressed={color === c}
                  onClick={() => {
                    setColor(c)
                    writePrefs({ bg, color: c, size })
                  }}
                  className={cn(
                    'size-6 shrink-0 rounded-full border border-white/30 transition',
                    color === c && 'ring-2 ring-white ring-offset-1 ring-offset-black/60',
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          ) : null}

          <div className="ml-1 flex items-center gap-1">
            {SIZES.map((sz) => (
              <button
                key={sz}
                type="button"
                aria-label={t('Brush size', '筆刷粗細')}
                aria-pressed={size === sz}
                onClick={() => {
                  setSize(sz)
                  writePrefs({ bg, color, size: sz })
                }}
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-md transition hover:bg-white/15',
                  size === sz && 'bg-white/20',
                )}
              >
                <span className="rounded-full bg-white" style={{ width: sz + 2, height: sz + 2 }} />
              </button>
            ))}
          </div>

          <span className="mx-1 h-5 w-px shrink-0 bg-white/20" />
          <ChromeButton onClick={undo} disabled={!strokeCount} label={t('Undo', '復原')}>
            <Undo2 className="size-5" />
          </ChromeButton>
          <ChromeButton onClick={clearAll} disabled={!strokeCount} label={t('Clear', '清除')}>
            <Trash2 className="size-5" />
          </ChromeButton>
          <span className="mx-1 h-5 w-px shrink-0 bg-white/20" />
          <ChromeButton
            onClick={toggleBg}
            label={bg === 'white' ? t('Switch to blackboard', '切換黑板') : t('Switch to whiteboard', '切換白板')}
          >
            {bg === 'white' ? <Moon className="size-5" /> : <SunMedium className="size-5" />}
          </ChromeButton>
        </div>

        <Button variant="brand" size="sm" onClick={doSave} disabled={!strokeCount || saving || busy} className="shrink-0">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {t('Save', '儲存')}
        </Button>
      </div>

      {/* Canvas area — the board colour lives here, the strokes ride a transparent canvas. */}
      <div ref={wrapRef} className="relative flex-1 overflow-hidden" style={{ background: board, overscrollBehavior: 'contain' }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
          style={{ background: board, cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        />

        {confirmClose ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-foreground/40 px-6 backdrop-blur-[2px]">
            <div className="w-full max-w-xs rounded-2xl bg-card p-5 text-center shadow-pop">
              <p className="text-sm font-semibold text-foreground">{t('Discard this drawing?', '放棄這張塗鴉？')}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {t('Your strokes will be lost.', '你畫的內容將會遺失。')}
              </p>
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
    </div>
  )
}

function ChromeButton({
  children,
  onClick,
  active,
  disabled,
  label,
}: {
  children: ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
  label: string
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
        'flex size-9 shrink-0 items-center justify-center rounded-md text-white/90 transition hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent',
        active && 'bg-white/20 text-white',
      )}
    >
      {children}
    </button>
  )
}
