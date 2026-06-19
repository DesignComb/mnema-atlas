import { humanizeError } from '@/lib/utils'
import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { MotionConfig } from 'motion/react'
import { BookOpenCheck, Loader2, Moon, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import { Button } from '@/components/ui/button'

/** The public GitHub repo, surfaced in the footer and the self-host page. */
export const REPO_URL = 'https://github.com/DesignComb/mnema-atlas'

/** Google "G" mark (lucide ships no brand icons). */
export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}

/** One-tap Google sign-in (full-page redirect), shared by every public page. */
export function useGoogleSignIn() {
  const { signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState(false)
  async function google() {
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      toast.error(humanizeError(err, ['Could not start Google sign-in', '無法啟動 Google 登入']))
      setBusy(false)
    }
  }
  return { google, busy }
}

/** The one primary action, reused in the hero and the closing CTA. */
export function GoogleButton({ busy, onClick, label, className }: { busy: boolean; onClick: () => void; label: string; className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={busy}
      className={`h-12 gap-3 bg-card px-6 text-[15px] font-medium shadow-soft hover:shadow-pop ${className ?? ''}`}
    >
      {busy ? <Loader2 className="size-[18px] animate-spin" /> : <GoogleIcon className="size-[18px]" />}
      {label}
    </Button>
  )
}

/** GitHub mark (this lucide version dropped brand icons). */
export function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.6 8.21 11.16.6.11.82-.25.82-.58 0-.29-.01-1.04-.02-2.05-3.34.71-4.04-1.58-4.04-1.58-.55-1.37-1.34-1.74-1.34-1.74-1.09-.73.08-.72.08-.72 1.2.08 1.84 1.22 1.84 1.22 1.07 1.8 2.81 1.28 3.5.98.11-.76.42-1.28.76-1.57-2.67-.3-5.47-1.31-5.47-5.83 0-1.29.47-2.34 1.24-3.17-.12-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.21a11.6 11.6 0 0 1 3-.4c1.02 0 2.05.13 3 .4 2.29-1.53 3.3-1.21 3.3-1.21.66 1.64.24 2.86.12 3.16.77.83 1.24 1.88 1.24 3.17 0 4.53-2.81 5.53-5.49 5.82.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.29C24 5.78 18.63.5 12 .5z" />
    </svg>
  )
}

/** Small uppercase letterspaced label — the app's existing eyebrow motif. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-strong">{children}</p>
}

/** Language + theme toggles, mirroring the in-app pair. */
function Toggles() {
  const { t, lang, setLang } = useI18n()
  const { theme, toggle } = useTheme()
  return (
    <>
      <button
        onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
        aria-label={lang === 'zh' ? 'Switch to English' : '切換為中文'}
        className="rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-muted-foreground outline-none transition hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {lang === 'zh' ? 'EN' : '中'}
      </button>
      <button
        onClick={toggle}
        aria-label={theme === 'dark' ? t('Switch to light theme', '切換為淺色主題') : t('Switch to dark theme', '切換為深色主題')}
        className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
      >
        {theme === 'dark' ? <Sun aria-hidden className="size-[18px]" /> : <Moon aria-hidden className="size-[18px]" />}
      </button>
    </>
  )
}

/**
 * Chrome shared by every public (logged-out) page: sticky header with the
 * wordmark + toggles + Sign in, a <main> landmark, and the footer. Wraps the
 * tree in MotionConfig so reduced-motion visitors get a calm, static page.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const { google, busy } = useGoogleSignIn()

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh bg-background text-foreground">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-sm">
                <BookOpenCheck aria-hidden className="size-[18px]" />
              </span>
              <span className="font-serif text-[17px] font-semibold tracking-tight">Mnema</span>
            </Link>
            <div className="flex items-center gap-1">
              <Toggles />
              <Button variant="ghost" size="sm" onClick={google} disabled={busy} className="ml-1">
                {t('Sign in', '登入')}
              </Button>
            </div>
          </div>
        </header>

        <main>{children}</main>

        <footer className="border-t border-border/60">
          <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm">
                <BookOpenCheck aria-hidden className="size-4" />
              </span>
              <div className="leading-tight">
                <p className="font-serif text-sm font-semibold tracking-tight">Mnema</p>
                <p className="text-[12px] text-muted-foreground">
                  {t('Your AI. Your memory. One quiet home that keeps growing.', '你的 AI，你的記憶。一個持續成長的安靜居所。')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted-foreground">
              <nav aria-label={t('Footer', '頁尾')} className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Link to="/faq" className="transition hover:text-foreground">{t('FAQ', '常見問題')}</Link>
                <Link to="/self-host" className="transition hover:text-foreground">{t('Self-host', '自行架設')}</Link>
                <a href={REPO_URL} target="_blank" rel="noreferrer" className="transition hover:text-foreground">GitHub</a>
              </nav>
              <span aria-hidden className="hidden text-muted-foreground/60 sm:inline">·</span>
              <span>{t('Open source · MIT', '開源 · MIT 授權')}</span>
              <span aria-hidden className="h-4 w-px bg-border" />
              <Toggles />
            </div>
          </div>
        </footer>
      </div>
    </MotionConfig>
  )
}
