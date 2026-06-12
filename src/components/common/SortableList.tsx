import { Reorder, useDragControls } from 'motion/react'
import { GripVertical } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface Identifiable {
  id: string
}

/**
 * Drag-to-reorder for a vertical list, built on framer-motion's Reorder.
 *
 * - Keeps an optimistic local order so the drag feels instant, then re-syncs
 *   from the server whenever the incoming id set/order changes (and we're not
 *   mid-drag — so a background refetch can't clobber a drag in progress).
 * - Dragging is restricted to the grip `handle` passed into `renderItem`, so
 *   the rest of the row (checkboxes, edit buttons, links) stays clickable.
 * - `onReorder` fires once, after a drag settles, with the new id order.
 */
export function SortableList<T extends Identifiable>({
  items,
  onReorder,
  renderItem,
  className,
  itemClassName,
}: {
  items: T[]
  onReorder: (orderedIds: string[]) => void
  renderItem: (item: T, handle: ReactNode) => ReactNode
  className?: string
  itemClassName?: string
}) {
  const [order, setOrder] = useState(items)
  const orderRef = useRef(order)
  orderRef.current = order
  const movedRef = useRef(false)

  const idsKey = items.map((i) => i.id).join('|')
  useEffect(() => {
    if (!movedRef.current) setOrder(items)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  // Keyboard path: the grip is a real button, so ArrowUp/Down must reorder too
  // — pointer drag alone would lock keyboard users out of reordering entirely.
  const nudge = (id: string, dir: -1 | 1) => {
    const cur = orderRef.current
    const i = cur.findIndex((x) => x.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= cur.length) return
    const next = [...cur]
    ;[next[i], next[j]] = [next[j], next[i]]
    movedRef.current = false
    setOrder(next)
    onReorder(next.map((x) => x.id))
  }

  return (
    <Reorder.Group
      as="div"
      axis="y"
      values={order}
      onReorder={(next) => {
        movedRef.current = true
        setOrder(next)
      }}
      className={className}
    >
      {order.map((item) => (
        <SortableRow
          key={item.id}
          value={item}
          className={itemClassName}
          renderItem={renderItem}
          onNudge={(dir) => nudge(item.id, dir)}
          onSettle={() => {
            if (!movedRef.current) return
            movedRef.current = false
            onReorder(orderRef.current.map((i) => i.id))
          }}
        />
      ))}
    </Reorder.Group>
  )
}

function SortableRow<T extends Identifiable>({
  value,
  className,
  renderItem,
  onNudge,
  onSettle,
}: {
  value: T
  className?: string
  renderItem: (item: T, handle: ReactNode) => ReactNode
  onNudge: (dir: -1 | 1) => void
  onSettle: () => void
}) {
  const controls = useDragControls()
  const handle = (
    <button
      type="button"
      aria-label="Drag or use arrow keys to reorder / 拖曳或用方向鍵排序"
      // Capture phase: framer attaches a NATIVE bubble-phase pointerdown on the
      // row's motion.div, which fires before React's bubble handlers — only a
      // capture-phase stopPropagation runs early enough to keep a grip press
      // from also starting a row-level SwipeRow drag.
      onPointerDownCapture={(e) => {
        e.preventDefault()
        e.stopPropagation()
        controls.start(e)
      }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
        e.preventDefault()
        e.stopPropagation()
        onNudge(e.key === 'ArrowUp' ? -1 : 1)
      }}
      // Rows can be clickable (e.g. open-to-edit) — don't let a grip click bubble.
      onClick={(e) => e.stopPropagation()}
      className="shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground/40 opacity-0 transition hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing [@media(hover:none)]:opacity-100"
    >
      <GripVertical className="size-4" />
    </button>
  )
  return (
    <Reorder.Item
      as="div"
      value={value}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onSettle}
      // Pass an opaque bg via itemClassName so a lifted row isn't see-through.
      className={cn(className)}
    >
      {renderItem(value, handle)}
    </Reorder.Item>
  )
}
