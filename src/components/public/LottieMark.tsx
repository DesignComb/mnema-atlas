import { lazy, Suspense, useEffect, useState } from 'react'
import pulseData from '@/assets/lottie/pulse.json'

// lottie-web is heavy, so the player is code-split into its own async chunk —
// it never touches the initial landing bundle.
const LottiePlayer = lazy(() => import('lottie-react'))

/**
 * A purely decorative, calm "living intelligence" pulse for the landing hero.
 * Honours prefers-reduced-motion (renders nothing — the page stays still), and
 * is aria-hidden since it carries no information.
 */
export function LottieMark({ className }: { className?: string }) {
  const [play, setPlay] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPlay(!mq.matches)
    const on = () => setPlay(!mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  if (!play) return null

  return (
    <div className={className} aria-hidden="true">
      <Suspense fallback={null}>
        <LottiePlayer animationData={pulseData} loop className="size-full" />
      </Suspense>
    </div>
  )
}
