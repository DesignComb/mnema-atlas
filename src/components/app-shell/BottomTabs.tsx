import { useRef, useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { LayoutGrid, Plus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { SPACES, activeSpace, type SpaceKey } from './spaces'

const LIQUID = { type: 'spring', stiffness: 380, damping: 30 } as const

type Space = (typeof SPACES)[number]

/**
 * Mobile (<lg) bottom bar: the fixed anchor spaces split around a raised centre
 * Capture FAB, with a permanent "Spaces" tab that opens the full space grid. A
 * liquid blob (its hue tracks the active space) glides between tabs; when the
 * active space isn't an anchor, the blob lands on the Spaces tab (which adopts
 * that space's icon + hue) so "you are here" is never lost. Anchors are fixed in
 * spaces.ts — no hidden long-press, no per-device drift.
 */
export function BottomTabs({ onCapture, onOpenSpaces }: { onCapture: () => void; onOpenSpaces: () => void }) {
  const t = useT()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const active = activeSpace(pathname)

  const anchors = SPACES.filter((s) => s.anchor)
  const left = anchors.slice(0, Math.ceil(anchors.length / 2))
  const right = anchors.slice(Math.ceil(anchors.length / 2))
  const activeIsAnchor = anchors.some((s) => s.key === active)

  return (
    <nav
      aria-label={t('Spaces', '空間')}
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-sidebar-border bg-sidebar/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {left.map((s) => (
        <Tab key={s.key} space={s} isActive={active === s.key} t={t} />
      ))}

      <CenterCapture label={t('Capture anything for your AI', '隨手暫存,交給 AI')} onCapture={onCapture} />

      {right.map((s) => (
        <Tab key={s.key} space={s} isActive={active === s.key} t={t} />
      ))}

      <SpacesTab active={!activeIsAnchor} activeKey={active} onOpen={onOpenSpaces} t={t} />
    </nav>
  )
}

function Blob() {
  // Liquid blob — bg-brand picks up the active space's hue; layoutId glides it.
  return (
    <motion.span
      layoutId="bottom-blob"
      transition={LIQUID}
      className="absolute -top-1 left-1/2 -z-0 h-11 w-12 -translate-x-1/2 rounded-[40%] bg-brand/20 blur-[3px]"
    />
  )
}

function Tab({ space, isActive, t }: { space: Space; isActive: boolean; t: (en: string, zh: string) => string }) {
  return (
    <Link
      to={space.to}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex flex-1 flex-col items-center justify-center py-2 text-[10px] font-medium transition-colors',
        isActive ? 'text-brand' : 'text-muted-foreground',
      )}
    >
      <span className="relative flex flex-col items-center gap-0.5">
        {isActive && <Blob />}
        <motion.span whileTap={{ scale: 0.82 }} className="relative z-10 flex flex-col items-center gap-0.5">
          <space.icon className="size-5" />
          <span>{t(space.en, space.zh)}</span>
        </motion.span>
      </span>
    </Link>
  )
}

/** The overflow entry to ALL spaces. Adopts the active space's icon + hue (and
 *  the blob) whenever the current space isn't one of the fixed anchors. */
function SpacesTab({
  active,
  activeKey,
  onOpen,
  t,
}: {
  active: boolean
  activeKey: SpaceKey
  onOpen: () => void
  t: (en: string, zh: string) => string
}) {
  const activeSpaceDef = SPACES.find((s) => s.key === activeKey)
  const Icon = active && activeSpaceDef ? activeSpaceDef.icon : LayoutGrid
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-1 flex-col items-center justify-center py-2 text-[10px] font-medium transition-colors',
        active ? 'text-brand' : 'text-muted-foreground',
      )}
    >
      <span className="relative flex flex-col items-center gap-0.5">
        {active && <Blob />}
        <motion.span whileTap={{ scale: 0.82 }} className="relative z-10 flex flex-col items-center gap-0.5">
          <Icon className="size-5" />
          <span>{t('Spaces', '空間')}</span>
        </motion.span>
      </span>
    </button>
  )
}

function CenterCapture({ label, onCapture }: { label: string; onCapture: () => void }) {
  const [bursts, setBursts] = useState<number[]>([])
  const seq = useRef(0)

  // The raised FAB carries no text label (its meaning is universal). It uses the
  // FIXED --capture accent (not the per-space brand hue) so the global front door
  // reads as one stable affordance everywhere.
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
        className="relative -mt-6 grid size-14 place-items-center rounded-full bg-capture text-capture-foreground shadow-pop ring-4 ring-sidebar"
      >
        <Plus className="size-6" />
        <AnimatePresence>
          {bursts.map((id) => (
            <motion.span
              key={id}
              initial={{ scale: 0.6, opacity: 0.45 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              onAnimationComplete={() => setBursts((b) => b.filter((x) => x !== id))}
              className="pointer-events-none absolute inset-0 rounded-full bg-capture"
            />
          ))}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
