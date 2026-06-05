import { useEffect, useRef } from 'react'

/**
 * Renders a Lottie animation (lottie-web, dynamically imported → its own async
 * chunk, never in the initial bundle). For prefers-reduced-motion it loads but
 * freezes on `staticFrame` (a representative still — the page keeps the artwork,
 * just no motion). Decorative, so aria-hidden.
 */
export function LottieArt({
  data,
  className,
  loop = true,
  staticFrame = 0,
}: {
  data: unknown
  className?: string
  loop?: boolean
  staticFrame?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const el = ref.current
    if (!el) return

    let cancelled = false
    let anim: { destroy: () => void; goToAndStop: (v: number, isFrame?: boolean) => void } | undefined
    void import('lottie-web').then(({ default: lottie }) => {
      if (cancelled || !ref.current) return
      anim = lottie.loadAnimation({
        container: ref.current,
        renderer: 'svg',
        loop: reduce ? false : loop,
        autoplay: !reduce,
        animationData: data as object,
        rendererSettings: { progressiveLoad: true },
      })
      if (reduce) anim.goToAndStop(staticFrame, true)
    })

    return () => {
      cancelled = true
      anim?.destroy()
    }
  }, [data, loop, staticFrame])

  return <div ref={ref} className={className} aria-hidden="true" />
}
