import { type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  BookOpenCheck,
  Compass,
  FileText,
  GraduationCap,
  Layers,
  Share2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { PageHeader } from '@/components/app-shell/PageHeader'
import { SPACES, type SpaceKey } from '@/components/app-shell/spaces'
import { useShell } from '@/lib/mobile-nav'
import { useT } from '@/lib/i18n'
import { modKey } from '@/lib/utils'

/* Per-space copy for the guide. Keyed by SpaceKey so adding a space to
   spaces.ts without a blurb is a TYPE ERROR — the guide can never drift from
   the rail again (audit A1). */
const SPACE_TITLE: Record<SpaceKey, [string, string]> = {
  study: ['Study · Atlas', '學習 · Atlas'],
  travel: ['Travel · Voyage', '旅遊 · Voyage'],
  tempo: ['Tasks · Tempo', '任務 · Tempo'],
  galleon: ['Money · Galleon', '記帳 · Galleon'],
  health: ['Health · Vitals', '健康 · Vitals'],
  kitchen: ['Kitchen', '廚房 · Kitchen'],
}
const SPACE_BLURB: Record<SpaceKey, [string, string]> = {
  study: ['Notes, flashcards (spaced repetition), and a knowledge graph.', '筆記、閃卡(間隔重複)與知識圖譜。'],
  travel: ['Multi-day trips: days, activities, reservations, packing — shareable.', '多天行程:日期、活動、訂位、打包 —— 可分享。'],
  tempo: ['To-dos & lists, habits, a calendar, recurrence, and reminders.', '待辦與清單、習慣、行事曆、重複與提醒。'],
  galleon: ['Ledgers, accounts & balances, budgets, and Splitwise-style bill-splitting.', '帳本、帳戶與結餘、預算,以及 Splitwise 式分帳結算。'],
  health: ['Vitals, medications, journal & mood — a private health log.', '生命徵象、用藥、日記與心情 —— 你的私人健康紀錄。'],
  kitchen: ['Recipes, pantry, shopping lists, and a weekly meal plan.', '食譜、庫存、購物清單與每週菜單。'],
}

export function GuideScreen() {
  const t = useT()
  const { startTour } = useShell()
  return (
    <>
      <PageHeader title={t('How Mnema works', 'Mnema 如何運作')} subtitle={t('A 2-minute guide', '2 分鐘上手指南')} icon={<BookOpenCheck className="size-4" />} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-9 px-6 py-8">
          {/* The idea */}
          <section className="space-y-2">
            <h2 className="font-serif text-xl text-foreground">{t('The idea', '核心概念')}</h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              {t(
                'A personal workspace you run with your own AI. Mnema hosts no AI itself — connect the assistant you already use (ChatGPT, Claude…) and it fills your spaces for you.',
                '一個由你自己的 AI 驅動的個人工作區。Mnema 不內建 AI —— 連接你已經在用的助理（ChatGPT、Claude…），由它幫你充實各個空間。',
              )}
            </p>
            <button
              type="button"
              onClick={startTour}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-3.5 py-2 text-[13px] font-medium text-brand-foreground shadow-sm transition hover:bg-brand/90"
            >
              <Compass className="size-4" /> {t('Take the quick tour', '看快速使用導覽')}
            </button>
          </section>

          {/* Spaces — rendered from SPACES so the guide always matches the rail. */}
          <section className="space-y-3">
            <h2 className="font-serif text-xl text-foreground">{t('The spaces', '所有區塊')}</h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {SPACES.map((s) => (
                <Step key={s.key} icon={<s.icon />} title={t(...SPACE_TITLE[s.key])} body={t(...SPACE_BLURB[s.key])} />
              ))}
            </div>
            <p className="text-[13px] text-muted-foreground">
              {t(
                'Switch from the rail on the left (tabs below on a phone). Your AI can work in any of them.',
                '從左側空間列切換（手機在下方分頁）。你的 AI 在每個區塊都能幫你做事。',
              )}
            </p>
          </section>

          {/* Daily loop */}
          <section className="space-y-3">
            <h2 className="font-serif text-xl text-foreground">{t('Your daily loop', '你的每日循環')}</h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Step icon={<FileText />} title={t('1 · Capture', '1 · 記錄')} body={t('Write a note, or paste something you want to remember.', '寫一則筆記，或貼上你想記住的內容。')} />
              <Step icon={<Layers />} title={t('2 · Make cards', '2 · 製作閃卡')} body={t('Turn a note into flashcards — a question and its answer.', '把筆記變成閃卡 — 一個問題加上它的答案。')} />
              <Step icon={<GraduationCap />} title={t('3 · Review', '3 · 複習')} body={t("Open Study and review what's due. We schedule the rest.", '開啟學習頁複習到期的閃卡，其餘的交給我們安排。')} />
              <Step icon={<Share2 />} title={t('See connections', '看見連結')} body={t('The Graph shows how your notes link together.', '圖譜會顯示你的筆記如何彼此串連。')} />
            </div>
          </section>

          {/* AI */}
          <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-brand" />
              <h2 className="font-serif text-xl text-foreground">{t('Let your AI do the work', '讓你的 AI 幫你做事')}</h2>
            </div>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              {t(
                'Connect ChatGPT, Claude or any AI once and it adds notes, trips, tasks and more straight into Mnema — picking the right space from what you ask. Set it up in',
                '連接一次 ChatGPT、Claude 或任何 AI，它就能直接新增筆記、行程、任務等到 Mnema —— 並依你說的判斷該放哪個區塊。到',
              )}{' '}
              <Link to="/settings/integrations" className="font-medium text-brand hover:underline">{t('Connect an AI', '連接 AI')}</Link>
              {t('.', ' 設定。')}
            </p>
            <div className="rounded-xl border border-dashed border-border p-3.5 text-[13px] leading-relaxed text-muted-foreground">
              <strong className="text-foreground">{t('No setup? (plain ChatGPT / Gemini)', '不想設定？（一般的 ChatGPT / Gemini）')}</strong>{' '}
              {t('Press', '按')}{' '}
              <kbd className="rounded border border-border bg-card px-1.5 text-[11px]">{modKey}+I</kbd> {t('for', '開啟')}{' '}
              <strong className="text-foreground">{t('Import from AI', '從 AI 匯入')}</strong>
              {t(': copy the prompt, give it to your AI, paste the answer back.', '：複製提示詞給 AI，再把回覆貼回來。')}
            </div>
          </section>

          {/* Safety */}
          <section className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t('Is it safe?', '安全嗎？')}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {t('Yes. Keys are', '安全。金鑰預設')}{' '}
                <strong className="text-foreground">{t('add-only', '僅可新增')}</strong>{' '}
                {t(
                  'by default — an AI can only add to your spaces and read what you can access, never change or delete anything. Revoke a key anytime in',
                  '—— AI 只能新增內容並讀取你有權存取的資料，不能修改或刪除。你隨時可在',
                )}{' '}
                <Link to="/settings/integrations" className="text-brand hover:underline">{t('Connect an AI', '連接 AI')}</Link>
                {t('.', ' 撤銷金鑰。')}
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

function Step({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="text-brand [&_svg]:size-4">{icon}</span>
        <span className="text-[13px] font-semibold text-foreground">{title}</span>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}
