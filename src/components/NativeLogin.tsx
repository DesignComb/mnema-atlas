import { BookOpenCheck } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { GoogleButton, useGoogleSignIn } from '@/components/public/PublicShell'

/**
 * The Capacitor app's entry screen for signed-out users. The web build opens on
 * the marketing landing page; inside the app that's pointless — you already
 * installed it — so we show a focused sign-in screen instead (see LandingScreen,
 * which swaps to this when Capacitor.isNativePlatform()).
 */
export function NativeLogin() {
  const t = useT()
  const { google, busy } = useGoogleSignIn()

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-10 bg-background px-8 text-center">
      <div className="flex flex-col items-center gap-5">
        <div className="grid size-16 place-items-center rounded-[20px] bg-brand text-brand-foreground shadow-pop">
          <BookOpenCheck className="size-8" />
        </div>
        <div className="space-y-2">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Mnema</h1>
          <p className="mx-auto max-w-[16rem] text-sm leading-relaxed text-muted-foreground">
            {t('Study, tasks, money, health — your spaces, filled by your own AI.', '讀書、待辦、記帳、健康 —— 你的空間，交給你自己的 AI 幫你填。')}
          </p>
        </div>
      </div>
      <GoogleButton busy={busy} onClick={google} label={t('Sign in with Google', '用 Google 登入')} />
    </div>
  )
}
