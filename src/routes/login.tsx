import { useState } from 'react'
import { motion } from 'motion/react'
import { BookOpenCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'

/** Google "G" mark (lucide ships no brand icons). */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}

export function LoginScreen() {
  const t = useT()
  const { signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState(false)

  async function google() {
    setBusy(true)
    try {
      // Redirects the whole page to Google; on success the browser comes back
      // already authenticated, so there's nothing to navigate to here.
      await signInWithGoogle()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Could not start Google sign-in', '無法啟動 Google 登入'))
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh w-screen lg:grid-cols-2">
      {/* Left — brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 lg:flex">
        <div className="absolute inset-0 bg-dots opacity-60" />
        <div className="relative flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-sm">
            <BookOpenCheck className="size-5" />
          </div>
          <span className="font-serif text-xl font-semibold tracking-tight">Mnema Atlas</span>
        </div>
        <div className="relative max-w-md space-y-4">
          <h2 className="font-serif text-3xl leading-tight text-foreground">
            {t('Your notes, distilled into memory.', '把筆記，淬煉成記憶。')}
          </h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {t(
              'Capture study notes, review them as spaced-repetition flashcards, and watch ideas connect in a living graph. Let any AI assistant fill your decks for you — through a tool, not a chatbot.',
              '記錄學習筆記，以間隔重複字卡複習，並在動態知識圖中看見概念彼此串連。讓任何 AI 助理為你填充牌組——透過工具，而非聊天機器人。',
            )}
          </p>
        </div>
        <div className="relative text-xs text-muted-foreground/70">{t('FSRS spaced repetition · MCP · Knowledge graph', 'FSRS 間隔重複 · MCP · 知識圖譜')}</div>
      </div>

      {/* Right — sign in */}
      <div className="flex items-center justify-center bg-background px-4 py-8 sm:px-6 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="space-y-1.5 lg:hidden">
            <div className="flex items-center gap-2">
              <BookOpenCheck className="size-5 text-brand" />
              <span className="font-serif text-lg font-semibold">Mnema Atlas</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{t('Welcome', '歡迎')}</h1>
            <p className="text-sm text-muted-foreground">{t('Sign in with Google to start studying.', '使用 Google 登入即可開始學習。')}</p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full gap-3 text-[14px] font-medium"
            onClick={google}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon className="size-4" />}
            {t('Continue with Google', '使用 Google 繼續')}
          </Button>

          <p className="text-center text-xs leading-relaxed text-muted-foreground/80">
            {t(
              'We only use your Google account to sign you in. By continuing you agree to let Mnema Atlas store the notes and flashcards you (or your AI assistants) create.',
              '我們僅使用你的 Google 帳號為你登入。繼續即表示你同意讓 Mnema Atlas 儲存你（或你的 AI 助理）建立的筆記與字卡。',
            )}
          </p>
        </motion.div>
      </div>
    </div>
  )
}
