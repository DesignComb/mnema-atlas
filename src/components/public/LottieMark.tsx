import { useEffect, useRef } from 'react'
import pulseData from '@/assets/lottie/pulse.json'

/**
 * A purely decorative, calm "living intelligence" pulse for the landing hero.
 * lottie-web is loaded via dynamic import (its own async chunk — never in the
 * initial bundle) and driven imperatively, so there's no React.lazy interop to
 * trip over. Honours prefers-reduced-motion (never loads or renders) and is
 * aria-hidden since it carries no information.
 */
export function LottieMark({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = ref.current
    if (!el) return

    let cancelled = false
    let anim: { destroy: () => void } | undefined
    void import('lottie-web').then(({ default: lottie }) => {
      if (cancelled || !ref.current) return
      anim = lottie.loadAnimation({
        container: ref.current,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: pulseData as object,
      })
    })

    return () => {
      cancelled = true
      anim?.destroy()
    }
  }, [])

  return <div ref={ref} className={className} aria-hidden="true" />
}
