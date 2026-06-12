import { useId, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Collapsible "rarely used fields" section for dialog forms.
 *
 * Children stay MOUNTED while collapsed (height/opacity animation, never a
 * conditional render) so form state survives toggling. Auto-opening when
 * editing an entity whose rare fields hold values is the CALLER's job via
 * `defaultOpen` — compute it from the entity prop (not local state, which is
 * usually populated by an effect after the first render).
 */
export function ExpanderSection({
  label,
  children,
  filledCount = 0,
  defaultOpen = false,
  icon,
}: {
  label: string
  children: ReactNode
  /** Number of contained fields that currently hold a value — shown as a muted badge while collapsed. */
  filledCount?: number
  defaultOpen?: boolean
  icon?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const regionId = useId()

  return (
    <section className="flex flex-col border-t border-border/60">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 py-2 text-left text-[13px] font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn('size-3.5 shrink-0 motion-safe:transition-transform motion-safe:duration-200', open && 'rotate-90')}
        />
        {icon}
        <span>{label}</span>
        {!open && filledCount > 0 ? (
          <span className="ml-1.5 rounded-full bg-muted px-1.5 py-px text-[11px] tabular-nums text-muted-foreground">
            {filledCount}
          </span>
        ) : null}
      </button>
      {/* Always mounted: collapse hides via height/opacity so field state never resets. */}
      <motion.div
        id={regionId}
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="overflow-hidden"
      >
        <div aria-hidden={!open} inert={!open} className="flex flex-col gap-4 pb-1 pt-1">
          {children}
        </div>
      </motion.div>
    </section>
  )
}
