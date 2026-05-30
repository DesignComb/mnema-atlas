import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { ArrowRight, FilePlus2, FileText, GraduationCap, Layers, Sparkles } from 'lucide-react'
import { useDecks, useDueCards, useNewNote, useNotes, useSeedSample } from '@/lib/hooks'
import { PageHeader } from '@/components/app-shell/PageHeader'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'
import { modKey, relativeDue } from '@/lib/utils'

export function HomeScreen() {
  const t = useT()
  const { data: due } = useDueCards()
  const { data: notes } = useNotes()
  const { data: decks } = useDecks()
  const seed = useSeedSample()
  const newNote = useNewNote()

  const dueCount = due?.length ?? 0
  const isNew = (decks?.length ?? 0) === 0 && (notes?.length ?? 0) === 0
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <>
      <PageHeader title="Today" subtitle={today} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-8 px-6 py-8">
          {isNew ? (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-brand-muted/70 to-card p-6 shadow-soft"
            >
              <div className="absolute inset-0 bg-dots opacity-40" />
              <div className="relative space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-brand">{t('Welcome', '歡迎')}</p>
                <h2 className="font-serif text-2xl text-foreground">{t("Let's get your first cards going", '來建立你的第一批卡片吧')}</h2>
                <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                  {t(
                    'Add a tiny sample deck to see the whole loop in 30 seconds, or write your first note. An AI can also fill your library for you —',
                    '加入一個小小的範例牌組，30 秒內看完整個流程，或寫下你的第一則筆記。也可以讓 AI 幫你充實資料庫 —',
                  )}{' '}
                  <Link to="/guide" className="font-medium text-brand hover:underline">{t('see how it works', '看看它如何運作')}</Link>.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="brand" onClick={() => seed.mutate()} disabled={seed.isPending}>
                    <Sparkles className="size-4" /> {seed.isPending ? t('Adding…', '加入中…') : t('Add a sample deck', '加入範例牌組')}
                  </Button>
                  <Button variant="outline" onClick={() => void newNote.run()} disabled={newNote.isPending}>
                    <FilePlus2 className="size-4" /> {t('Write a note', '寫一則筆記')}
                  </Button>
                </div>
              </div>
            </motion.section>
          ) : (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-brand-muted/70 to-card p-6 shadow-soft"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-brand">{t('Spaced repetition', '間隔重複')}</p>
                  <h2 className="font-serif text-2xl text-foreground">
                    {dueCount > 0
                      ? t(`${dueCount} card${dueCount === 1 ? '' : 's'} due`, `${dueCount} 張卡片待複習`)
                      : t('All caught up 🌿', '全部完成 🌿')}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {dueCount > 0
                      ? t('Review them now to keep your memory fresh.', '現在就複習，讓記憶保持新鮮。')
                      : t('Nothing to review right now — add notes or come back later.', '目前沒有要複習的內容 — 新增筆記，或稍後再回來。')}
                  </p>
                </div>
                <GraduationCap className="size-12 shrink-0 text-brand/30" />
              </div>
              {dueCount > 0 ? (
                <Button asChild variant="brand" className="mt-4">
                  <Link to="/study">
                    {t('Start review', '開始複習')} <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : null}
            </motion.section>
          )}

          {/* Stat tiles */}
          <section className="grid grid-cols-3 gap-3">
            <StatTile icon={<Layers className="size-4" />} label={t('Decks', '牌組')} value={decks?.length ?? 0} />
            <StatTile icon={<FileText className="size-4" />} label={t('Notes', '筆記')} value={notes?.length ?? 0} />
            <StatTile icon={<GraduationCap className="size-4" />} label={t('Due now', '待複習')} value={dueCount} />
          </section>

          {/* Recent notes */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t('Recent notes', '最近的筆記')}</h3>
              <Link to="/notes" className="text-xs font-medium text-brand hover:underline">
                {t('View all', '查看全部')}
              </Link>
            </div>
            {notes?.length ? (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {notes.slice(0, 6).map((n) => (
                  <Link
                    key={n.id}
                    to="/notes/$noteId"
                    params={{ noteId: n.id }}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-accent/50"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{n.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{relativeDue(n.updated_at)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-4 py-5 text-sm text-muted-foreground">
                <Sparkles className="size-4 text-brand" />
                {t('No notes yet — press', '還沒有筆記 — 按')}{' '}
                <kbd className="rounded border border-border bg-card px-1.5 text-xs">{modKey}+K</kbd>{' '}
                {t('to create one, or connect an AI to fill them in.', '即可建立一則，或連接 AI 來幫你充實內容。')}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-soft">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}
