import { type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { BookOpenCheck, FileText, GraduationCap, Layers, Share2, ShieldCheck, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/app-shell/PageHeader'
import { useT } from '@/lib/i18n'
import { modKey } from '@/lib/utils'

export function GuideScreen() {
  const t = useT()
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
                'Capture study notes, turn them into flashcards, and review a few each day — spaced repetition makes them stick. You can even let an AI fill your library for you.',
                '記下學習筆記，把它們變成字卡，每天複習幾張 — 間隔重複能讓記憶更牢固。你甚至可以讓 AI 幫你充實資料庫。',
              )}
            </p>
          </section>

          {/* Daily loop */}
          <section className="space-y-3">
            <h2 className="font-serif text-xl text-foreground">{t('Your daily loop', '你的每日循環')}</h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Step icon={<FileText />} title={t('1 · Capture', '1 · 記錄')} body={t('Write a note, or paste something you want to remember.', '寫一則筆記，或貼上你想記住的內容。')} />
              <Step icon={<Layers />} title={t('2 · Make cards', '2 · 製作卡片')} body={t('Turn a note into flashcards — a question and its answer.', '把筆記變成字卡 — 一個問題加上它的答案。')} />
              <Step icon={<GraduationCap />} title={t('3 · Review', '3 · 複習')} body={t("Open Study and review what's due. We schedule the rest.", '開啟學習頁複習到期的卡片，其餘的交給我們安排。')} />
              <Step icon={<Share2 />} title={t('See connections', '看見連結')} body={t('The Graph shows how your notes link together.', '圖譜會顯示你的筆記如何彼此串連。')} />
            </div>
          </section>

          {/* AI */}
          <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-brand" />
              <h2 className="font-serif text-xl text-foreground">{t('Let an AI fill your library', '讓 AI 充實你的資料庫')}</h2>
            </div>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              {t(
                'Already chatting with ChatGPT, Claude, or another AI? Connect it once and it can drop notes & flashcards straight into Mnema. The full setup — create a key, pick your assistant, see what it can do — lives on',
                '已經在用 ChatGPT、Claude 或其他 AI 聊天了嗎？只要連接一次，它就能直接把筆記與字卡放進 Mnema。完整設定 — 建立金鑰、挑選你的助理、了解它能做什麼 — 都在',
              )}{' '}
              <Link to="/settings/integrations" className="font-medium text-brand hover:underline">{t('Connect an AI', '連接 AI')}</Link>.
            </p>
            <div className="rounded-xl border border-dashed border-border p-3.5 text-[13px] leading-relaxed text-muted-foreground">
              <strong className="text-foreground">{t('No setup? (plain ChatGPT / Gemini)', '不想設定？（一般的 ChatGPT / Gemini）')}</strong>{' '}
              {t('Press', '按')}{' '}
              <kbd className="rounded border border-border bg-card px-1.5 text-[11px]">{modKey}+I</kbd> {t('for', '開啟')}{' '}
              <strong className="text-foreground">{t('Import from AI', '從 AI 匯入')}</strong>
              {t(': copy the prompt, paste it to your AI, then paste its answer back here.', '：複製提示詞，貼給你的 AI，再把它的回覆貼回這裡。')}
            </div>
          </section>

          {/* Safety */}
          <section className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t('Is it safe?', '安全嗎？')}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {t('Yes. Keys are', '安全。金鑰預設為')}{' '}
                <strong className="text-foreground">{t('add-only', '僅可新增')}</strong>{' '}
                {t(
                  "by default — an AI can only add to your library, never change or delete it, and never see anyone else's. Revoke a key anytime in",
                  '— AI 只能為你的資料庫新增內容，無法修改或刪除，也看不到其他人的資料。你隨時可以在',
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
