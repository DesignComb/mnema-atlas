import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useT } from '@/lib/i18n'
import { Eyebrow, GoogleButton, PublicShell, useGoogleSignIn } from '@/components/public/PublicShell'
import { FAQ_ITEMS, FaqAccordion } from '@/components/public/faq-data'

export function FaqScreen() {
  const t = useT()
  const { google, busy } = useGoogleSignIn()

  return (
    <PublicShell>
      <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <Eyebrow>{t('Questions & answers', '問與答')}</Eyebrow>
          <h1 className="mt-4 font-serif text-[2rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[2.5rem]">
            {t('Everything you might ask first.', '你大概會先想問的事。')}
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-[16px]">
            {t(
              "How Mnema works, what your AI can and can't do, and what happens to your data. Still curious? The guide and the open-source code go deeper.",
              '關於 Mnema 怎麼運作、你的 AI 能做與不能做什麼，以及你的資料會怎麼被處理。還想了解更多？使用教學與開源原始碼有更詳細的說明。',
            )}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10"
        >
          <FaqAccordion items={FAQ_ITEMS} />
        </motion.div>

        {/* close with the primary action + a route to the self-host story */}
        <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl border border-border bg-gradient-to-br from-brand-muted/50 to-card p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="font-serif text-[1.3rem] font-semibold tracking-tight text-foreground">
              {t('Ready when you are.', '隨時可以開始。')}
            </h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              {t('Sign in and connect the AI you already use — or run it yourself.', '登入並連接你已經在用的 AI —— 或自己架一套。')}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-3">
            <GoogleButton busy={busy} onClick={google} label={t('Continue with Google', '使用 Google 繼續')} />
            <Link to="/self-host" className="text-sm font-medium text-brand hover:underline">
              {t('Self-host it →', '自行架設 →')}
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  )
}
