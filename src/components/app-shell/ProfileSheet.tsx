import type { ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { HelpCircle, Languages, LogOut, Moon, Plug, Search, Sun } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { useI18n } from '@/lib/i18n'
import { modKey } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { VersionStamp } from './AppSidebar'

/**
 * Account & settings, relocated out of the old nav drawer into a bottom sheet
 * opened by the header avatar. Holds only cross-cutting utilities (Search/⌘K,
 * help, connect AI, language, theme, sign out) — no navigation altitude.
 * ("Import from AI" is not here — it's a prominent header action on every
 * screen via <AiImportButton>, not buried behind the avatar.)
 */
export function ProfileSheet({
  open,
  onOpenChange,
  onOpenCommand,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onOpenCommand: () => void
}) {
  const { user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const { t, lang, setLang } = useI18n()
  const navigate = useNavigate()
  const initials = (user?.email ?? '?').slice(0, 2).toUpperCase()
  const close = () => onOpenChange(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <Avatar className="size-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">{user?.email}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">{t('Account and settings', '帳號與設定')}</DialogDescription>
        </DialogHeader>

        <div className="-mt-1 flex flex-col gap-0.5">
          <Row
            icon={<Search className="size-4" />}
            label={t('Search', '搜尋')}
            trailing={<kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{modKey}K</kbd>}
            onClick={() => {
              close()
              onOpenCommand()
            }}
          />
          <RowLink icon={<HelpCircle className="size-4" />} label={t('How it works', '使用教學')} to="/guide" onNavigate={close} />
          <RowLink icon={<Plug className="size-4" />} label={t('Connect an AI', '連接 AI')} to="/settings/integrations" onNavigate={close} />

          <div className="my-1 h-px bg-border" />

          <Row
            icon={<Languages className="size-4" />}
            label={t('Language', '語言')}
            trailing={<span className="text-[12px] font-semibold text-muted-foreground">{lang === 'zh' ? '中文' : 'English'}</span>}
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          />
          <Row
            icon={theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            label={t('Theme', '主題')}
            trailing={<span className="text-[12px] font-semibold text-muted-foreground">{theme === 'dark' ? t('Dark', '深色') : t('Light', '淺色')}</span>}
            onClick={toggle}
          />

          <div className="my-1 h-px bg-border" />

          <Row
            icon={<LogOut className="size-4" />}
            label={t('Sign out', '登出')}
            onClick={async () => {
              close()
              await signOut()
              navigate({ to: '/' })
            }}
          />
        </div>

        <div className="px-1">
          <VersionStamp />
        </div>
      </DialogContent>
    </Dialog>
  )
}

const ROW = 'flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-[14px] text-foreground transition hover:bg-accent'

function Row({ icon, label, trailing, onClick }: { icon: ReactNode; label: string; trailing?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={ROW}>
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1">{label}</span>
      {trailing}
    </button>
  )
}

function RowLink({ icon, label, to, onNavigate }: { icon: ReactNode; label: string; to: string; onNavigate: () => void }) {
  return (
    <Link to={to} onClick={onNavigate} className={ROW}>
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1">{label}</span>
    </Link>
  )
}
