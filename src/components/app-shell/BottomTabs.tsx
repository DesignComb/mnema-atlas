import { useRef, useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { usePinnedSpaces } from '@/lib/pinned-spaces'
import { SPACES, activeSpace } from './spaces'
import { BottomTabsCustomize } from './BottomTabsCustomize'

const LIQUID = { type: 'spring', stiffness: 380, damping: 30 } as const

/**
 * Mobile (<lg) bottom bar: up to 4 user-pinned spaces split around a raised
 * centre Capture button. A liquid blob (its hue tracks the active space) glides
 * between tabs as you navigate. Long-press the bar to customise which spaces
 * are pinned. Unpinned spaces stay in the ☰ drawer.
 */
export function BottomTabs({ onCapture }: { onCapture: () => void }) {
  const t = useT()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const active = activeSpace(pathname)
  const pinned = usePinnedSpaces()
  const [customizeOpen, setCustomizeOpen] = useState(false)

  const items = pinned.map((key) => SPACES.find((s) => s.key === key)).filter((s): s is (typeof SPACES)[number] => Boolean(s))
  const half = Math.ceil(items.length / 2)
  const left = items.slice(0, half)
  const right = items.slice(half)

  // Long-press (or right-click / two-finger) anywhere on the bar opens the
  // customise sheet. A normal quick tap on a tab still navigates.
  const pressTimer = useRef<number>(0)
  const longPressed = useRef(false)
  const startPress = () => {
    longPressed.current = false
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true
      setCustomizeOpen(true)
    }, 500)
  }
  const endPress = () => window.clearTimeout(pressTimer.current)

  return (
    <>
      <nav
        aria-label={t('Spaces', '空間')}
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-sidebar-border bg-sidebar/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerMove={endPress}
        onPointerLeave={endPress}
        onContextMenu={(e) => {
          e.preventDefault()
          setCustomizeOpen(true)
        }}
        // Swallow the click that follows a long-press so it doesn't also navigate.
        onClickCapture={(e) => {
          if (longPressed.current) {
            e.preventDefault()
            e.stopPropagation()
            longPressed.current = false
          }
        }}
      >
        {left.map((s) => (
          <Tab key={s.key} space={s} isActive={active === s.key} t={t} />
        ))}

        <CenterCapture label={t('Capture anything for your AI', '隨手暫存,交給 AI')} onCapture={onCapture} />

        {right.map((s) => (
          <Tab key={s.key} space={s} isActive={active === s.key} t={t} />
        ))}
      </nav>

      <BottomTabsCustomize open={customizeOpen} onOpenChange={setCustomizeOpen} />
    </>
  )
}

function Tab({ space, isActive, t }: { space: (typeof SPACES)[number]; isActive: boolean; t: (en: string, zh: string) => string }) {
  return (
    <Link
      to={space.to}
      aria-current={isActive ? 'page' : undefined}
      className={cn('flex flex-1 flex-col items-center justify-center py-2 text-[10px] font-medium transition-colors', isActive ? 'text-brand' : 'text-muted-foreground')}
    >
      <span className="relative flex flex-col items-center gap-0.5">
        {isActive && (
          // Liquid blob — bg-brand picks up the active space's hue, so the colour
          // flows as you move between spaces. layoutId makes it glide, not jump.
          <motion.span
            layoutId="bottom-blob"
            transition={LIQUID}
            className="absolute -top-1 left-1/2 -z-0 h-11 w-12 -translate-x-1/2 rounded-[40%] bg-brand/20 blur-[3px]"
          />
        )}
        <motion.span whileTap={{ scale: 0.82 }} className="relative z-10 flex flex-col items-center gap-0.5">
          <space.icon className="size-5" />
          <span>{t(space.en, space.zh)}</span>
        </motion.span>
      </span>
    </Link>
  )
}

function CenterCapture({ label, onCapture }: { label: string; onCapture: () => void }) {
  const [bursts, setBursts] = useState<number[]>([])
  const seq = useRef(0)

  // The raised FAB carries no text label (its meaning is universal) — that also
  // avoids the label colliding with the circle. aria-label keeps it accessible.
  return (
    <div className="flex flex-1 items-center justify-center">
      <motion.button
        type="button"
        aria-label={label}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          setBursts((b) => [...b, seq.current++])
          onCapture()
        }}
        className="relative -mt-6 grid size-14 place-items-center rounded-full bg-brand text-brand-foreground shadow-pop ring-4 ring-sidebar"
      >
        <Plus className="size-6" />
        {/* Bloom ripple on each tap. */}
        <AnimatePresence>
          {bursts.map((id) => (
            <motion.span
              key={id}
              initial={{ scale: 0.6, opacity: 0.45 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              onAnimationComplete={() => setBursts((b) => b.filter((x) => x !== id))}
              className="pointer-events-none absolute inset-0 rounded-full bg-brand"
            />
          ))}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
