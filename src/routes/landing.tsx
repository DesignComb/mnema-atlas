import { type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import {
  ArrowRight,
  Check,
  FileText,
  GraduationCap,
  KeyRound,
  Layers,
  ListTodo,
  Map as MapIcon,
  Plug,
  Plus,
  Share2,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { useT } from '@/lib/i18n'
import { modKey } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Eyebrow, GithubIcon, GoogleButton, PublicShell, REPO_URL, useGoogleSignIn } from '@/components/public/PublicShell'
import { LottieMark } from '@/components/public/LottieMark'
import { FAQ_ITEMS, FaqAccordion } from '@/components/public/faq-data'

/* The three current spaces each own a hue in src/index.css. On the landing we
   ration them to a single dot per card so colour stays a whisper, never a
   "three colourful features" grid. */
const ATLAS = 'oklch(0.58 0.13 250)' // Study — editorial blue
const VOYAGE = 'oklch(0.6 0.1 195)' // Travel — teal
const TEMPO = 'oklch(0.62 0.15 300)' // Tasks — violet
const GREEN = 'oklch(0.55 0.14 150)' // the single "can do" check (dark enough for a white tick to clear AA)

/* Single-shot motion variants. PublicShell's MotionConfig flattens these for
   visitors who ask their OS for reduced motion. */
const reveal = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
}
const heroItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
}

export function LandingScreen() {
  const t = useT()
  const { google, busy } = useGoogleSignIn()

  function scrollToHow(e: ReactMouseEvent) {
    e.preventDefault()
    const el = document.getElementById('how')
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
    el.setAttribute('tabindex', '-1')
    el.focus({ preventScroll: true })
  }

  return (
    <PublicShell>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-dots opacity-50 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:py-28">
          {/* Left — the promise */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } } }}
            className="max-w-xl"
          >
            <motion.div variants={heroItem}>
              <Eyebrow>{t('Bring your own AI', '帶上你自己的 AI')}</Eyebrow>
            </motion.div>
            <motion.h1
              variants={heroItem}
              className="mt-5 font-serif text-[2.15rem] font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl sm:leading-[1.06]"
            >
              {t('Your AI. Your memory.', '你的 AI，你的記憶。')}
              <span className="mt-1.5 block">{t('One quiet workspace it fills for you.', '一個由它為你充實的安靜工作區。')}</span>
            </motion.h1>
            <motion.p variants={heroItem} className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground sm:text-[16px]">
              {t(
                'Mnema hosts no AI of its own. Connect the assistant you already use — ChatGPT, Claude, Cursor — once, and it creates and organizes your notes, trips, and tasks for you.',
                'Mnema 本身不內建任何 AI。把你已經在用的助理 —— ChatGPT、Claude、Cursor —— 連接一次，它就會幫你建立並整理筆記、行程與任務。',
              )}
            </motion.p>
            <motion.div variants={heroItem} className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <GoogleButton busy={busy} onClick={google} label={t('Continue with Google', '使用 Google 繼續')} />
              <a
                href="#how"
                onClick={scrollToHow}
                className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                {t('See how it works', '看看它如何運作')}
                <ArrowRight aria-hidden className="size-4 rotate-90 transition group-hover:translate-y-0.5" />
              </a>
            </motion.div>
            <motion.p variants={heroItem} className="mt-6 text-[12.5px] leading-relaxed text-muted-foreground">
              {t('Add-only by default · revoke anytime · we host no AI of our own', '預設僅可新增 · 隨時可撤銷 · 我們不內建任何 AI')}
            </motion.p>
          </motion.div>

          {/* Right — a message becomes a workspace */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-sm lg:mx-0 lg:ml-auto lg:max-w-md"
          >
            <div className="pointer-events-none absolute -inset-x-6 -inset-y-5 bg-dots opacity-40 [mask-image:radial-gradient(ellipse,black,transparent_72%)]" />
            {/* A calm "living intelligence" pulse — the AI that quietly fills the workspace below. */}
            <LottieMark className="pointer-events-none absolute -right-7 -top-12 size-36 opacity-60 sm:-right-10 sm:size-44" />

            <div className="relative rounded-2xl rounded-bl-md border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <Sparkles aria-hidden className="size-3.5 text-brand" /> {t('you → your AI', '你 → 你的 AI')}
              </div>
              <p className="mt-2 font-serif text-[15px] leading-snug text-foreground">
                {t('“Plan my Kyoto trip, and turn these five kanji into flashcards.”', '「幫我安排京都行程，再把這五個漢字做成字卡。」')}
              </p>
            </div>

            <div className="relative mx-auto my-2 h-9 w-px">
              <div className="absolute inset-0 border-l border-dashed border-border" />
              <span className="landing-travel-dot absolute -left-[3px] top-0 size-1.5 rounded-full bg-brand" />
            </div>

            <div className="relative rounded-2xl border border-border bg-card/85 p-2.5 shadow-soft backdrop-blur-sm">
              <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t('your workspace', '你的工作區')}</span>
                <span className="text-[10.5px] text-muted-foreground">{t('just now', '剛剛')}</span>
              </div>
              <div className="space-y-1.5">
                <ResultRow dot={ATLAS} icon={<FileText />} title={t('Kyoto temples — notes', '京都寺院 — 筆記')} meta={t('note', '筆記')} />
                <ResultRow dot={ATLAS} icon={<Layers />} title={t('5 kanji → flashcards', '5 個漢字 → 字卡')} meta={t('due in 3d', '3 天後到期')} />
                <ResultRow dot={VOYAGE} icon={<MapIcon />} title={t('Day 1 · Kyoto', '第 1 天 · 京都')} meta={t('trip', '行程')} />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── The idea + three pillars ───────────────────────────────────── */}
      <section className="border-t border-border/60 bg-secondary/30">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <motion.div {...reveal} className="max-w-2xl">
            <Eyebrow>{t('The idea', '理念')}</Eyebrow>
            <h2 className="mt-4 font-serif text-[1.8rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[2.1rem]">
              {t("We don't sell you an AI. We give your AI somewhere to keep things.", '我們不賣你 AI，我們給你的 AI 一個安放之處。')}
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground sm:text-[16px]">
              {t(
                "Every other app is racing to add its own chatbot. Mnema does the opposite: the assistant you already trust connects once — over MCP, or plain REST — and from then on it builds your flashcards, drafts whole trips, and files this week's tasks into the right place. No new model to learn, no second subscription.",
                '其他每一款 App 都急著加上自己的聊天機器人，Mnema 卻反其道而行：你早已信任的助理只要連接一次 —— 透過 MCP 或單純的 REST —— 從此就能替你做字卡、草擬整趟行程，把本週的任務歸到正確的位置。不必學新的模型，也不必再付一份訂閱。',
              )}
            </p>
          </motion.div>

          <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-3">
            <Pillar
              icon={<Plug />}
              title={t('Bring your own AI', '帶上你自己的 AI')}
              body={t(
                'No chatbot to learn, no model to pay for. Connect ChatGPT, Claude, or Cursor once — the content is written by the assistant you already trust.',
                '沒有要重新學的聊天機器人，也沒有要另外付費的模型。連接一次 ChatGPT、Claude 或 Cursor —— 內容就交給你早已信任的助理來寫。',
              )}
            />
            <Pillar
              icon={<Share2 />}
              title={t('A home that remembers', '一個會記得的家')}
              body={t(
                'Most AI answers vanish into a chat log. Here everything your AI makes stays — organized, searchable, linked in a living graph.',
                '多數 AI 的回答都消失在對話紀錄裡。在這裡，你的 AI 所做的一切都留得下來 —— 有條理、可搜尋，並串連成一張動態圖譜。',
              )}
            />
            <Pillar
              icon={<ShieldCheck />}
              title={t('Safe to hand over', '放心交付')}
              body={t(
                "Every key is add-only by default — a connected AI can only add, never edit, complete, or delete, and never sees anyone else's data.",
                '每把金鑰預設僅可新增 —— 連接的 AI 只能新增，無法編輯、完成或刪除，也看不到任何其他人的資料。',
              )}
            />
          </div>
        </div>
      </section>

      {/* ── How your AI connects (the write path) ──────────────────────── */}
      <section id="how" className="scroll-mt-16 border-t border-border/60">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <motion.div {...reveal} className="max-w-2xl">
            <Eyebrow>{t('How your AI connects', '你的 AI 如何連接')}</Eyebrow>
            <h2 className="mt-4 font-serif text-[1.8rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[2.1rem]">
              {t('Connect once, then just talk.', '連接一次，之後只要開口。')}
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground sm:text-[16px]">
              {t(
                'Three calm steps. After the one-time setup you never touch a config again — you just ask, in plain language.',
                '三個從容的步驟。一次設定完成後，你再也不必碰任何設定 —— 只要用自然語言開口就好。',
              )}
            </p>
          </motion.div>

          <div className="mt-14 grid gap-6 lg:grid-cols-3 lg:gap-8">
            <Step
              n="01"
              delay={0}
              icon={<KeyRound />}
              title={t('Create a key', '建立一把金鑰')}
              body={t(
                "Make an API key in seconds. By default it's add-only — the safest setting for an AI to hold.",
                '幾秒鐘就能建立一把 API 金鑰。預設為僅可新增 —— 這是讓 AI 持有最安全的設定。',
              )}
            />
            <Step
              n="02"
              delay={0.08}
              icon={<Plug />}
              title={t('Connect once', '連接一次')}
              body={t(
                'Paste the key into Claude, Cursor, or a custom GPT. It links over MCP or REST — one setup, then it just works.',
                '把金鑰貼進 Claude、Cursor 或自訂 GPT。透過 MCP 或 REST 連接 —— 設定一次，之後就一直管用。',
              )}
            />
            <Step
              n="03"
              delay={0.16}
              icon={<Sparkles />}
              title={t('Just ask', '直接開口')}
              body={t(
                '“Save this chapter as flashcards.” “Plan our Kyoto trip.” Your AI writes it into the right space for you.',
                '「把這章存成字卡。」「幫我們安排京都行程。」你的 AI 就會把它寫進正確的區塊。',
              )}
            />
          </div>
        </div>
      </section>

      {/* ── Trust: add-only by default ─────────────────────────────────── */}
      <section className="border-t border-border/60 bg-secondary/30">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <motion.div
            {...reveal}
            className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-brand-muted/60 to-card p-7 shadow-soft sm:p-10 lg:grid lg:grid-cols-2 lg:items-center lg:gap-12"
          >
            <div className="relative">
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-card text-brand shadow-sm">
                <ShieldCheck aria-hidden className="size-5" />
              </span>
              <h2 className="mt-4 font-serif text-[1.8rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[2.1rem]">
                {t('Safe to hand to an AI.', '放心交給 AI。')}
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                {t(
                  "Opening your data to an agent shouldn't mean risking it. By default every key is add-only, and you can revoke any of them in one click.",
                  '把資料開放給代理，不該等於拿它去冒險。預設情況下，每把金鑰都僅可新增，而且任何一把都能一鍵撤銷。',
                )}
              </p>
              <div className="mt-5 rounded-xl border border-dashed border-border bg-card/60 p-3.5 text-[13px] leading-relaxed text-muted-foreground">
                <strong className="font-semibold text-foreground">{t('No setup?', '不想設定？')}</strong>{' '}
                {t(
                  'Copy a prompt, paste it into plain ChatGPT or Gemini, then paste the reply back.',
                  '複製一段提示詞，貼進一般的 ChatGPT 或 Gemini，再把回覆貼回來。',
                )}
              </div>
            </div>

            <div className="relative mt-8 space-y-2 lg:mt-0">
              <PermissionRow allow label={t('Add notes, cards, trips & tasks', '新增筆記、字卡、行程與任務')} />
              <PermissionRow label={t('Edit, complete, or delete', '編輯、完成或刪除')} />
              <PermissionRow label={t("See anyone else's data", '看見其他人的資料')} />
              <p className="px-1 pt-2 text-[12.5px] text-muted-foreground">
                {t(
                  'Need editing? A deliberate full-access key turns it on — your choice, never the default.',
                  '需要編輯？刻意改用完整存取金鑰即可開啟 —— 由你決定，絕非預設。',
                )}
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── What's here today — and it keeps growing ───────────────────── */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <motion.div {...reveal} className="max-w-2xl">
            <Eyebrow>{t("What's here today", '目前已有的')}</Eyebrow>
            <h2 className="mt-4 font-serif text-[1.8rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[2.1rem]">
              {t('A few focused spaces — and it keeps growing.', '幾個專注的區塊 —— 而且持續成長。')}
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground sm:text-[16px]">
              {t(
                'These are simply what your AI can fill today. Mnema is built to keep adding spaces over time, and a connected AI can work in every one of them.',
                '這些只是你的 AI 今天就能充實的部分。Mnema 會隨時間持續加入新的區塊，而你連接的 AI 在每一個區塊都能幫你做事。',
              )}
            </p>
          </motion.div>

          <motion.div {...reveal} className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <SpaceCard dot={ATLAS} icon={<GraduationCap />} name={t('Study', '讀書')} code="Atlas" body={t('Notes, spaced-repetition flashcards, and a knowledge graph.', '筆記、間隔重複字卡，以及一張知識圖譜。')} />
            <SpaceCard dot={VOYAGE} icon={<MapIcon />} name={t('Travel', '旅遊')} code="Voyage" body={t('Multi-day itineraries with bookings, packing, and a share link.', '多天行程，含訂位、打包，還能用連結分享。')} />
            <SpaceCard dot={TEMPO} icon={<ListTodo />} name={t('Tasks', '任務')} code="Tempo" body={t('To-dos and lists, habits with streaks, a calendar, and reminders.', '待辦與清單、習慣連續紀錄、行事曆與提醒。')} />
            <div className="flex flex-col items-start justify-center rounded-2xl border border-dashed border-border p-5">
              <span className="flex size-9 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground">
                <Plus aria-hidden className="size-4" />
              </span>
              <p className="mt-3 text-[14px] font-semibold text-foreground">{t('More spaces coming', '更多區塊即將到來')}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{t('A new space appears and your AI can use it at once.', '新的區塊一出現，你的 AI 就能立刻用上。')}</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Durable memory + craft ─────────────────────────────────────── */}
      <section className="border-t border-border/60 bg-secondary/30">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <motion.div {...reveal} className="mx-auto max-w-2xl text-center">
            <MiniGraph />
            <h2 className="mt-6 font-serif text-[1.8rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[2.1rem]">
              {t('Chats forget. Your workspace remembers.', '對話會遺忘，工作區會記得。')}
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground sm:text-[16px]">
              {t(
                'Mnema is the quiet, durable layer behind whatever AI you use — notes link into a graph, facts return as cards just before you forget, and reminders arrive on time.',
                'Mnema 是你所用任何 AI 背後，那層沉靜而長久的記憶 —— 筆記串成圖譜，知識在你快要遺忘前化為字卡，提醒也準時送達。',
              )}
            </p>
          </motion.div>

          <motion.div {...reveal} className="mx-auto mt-12 grid max-w-3xl gap-x-10 gap-y-3.5 sm:grid-cols-2">
            <CraftItem text={t('FSRS spaced repetition — review only what you’re about to forget', 'FSRS 間隔重複 —— 只複習你即將遺忘的內容')} />
            <CraftItem text={t('Obsidian-style knowledge graph that links your notes', 'Obsidian 風格的知識圖譜，串連你的筆記')} />
            <CraftItem text={t('Fully bilingual — English and 繁體中文, toggled on every line', '完整雙語 —— 英文與繁體中文，每一句都能切換')} />
            <CraftItem text={t('Warm dark and light themes, both built to live in', '溫潤的深色與淺色主題，都讓人想久待其中')} />
            <CraftItem text={t('Installable PWA — keep it on your Home Screen, reminders included', '可安裝的 PWA —— 放進主畫面，連提醒一起帶著走')} />
            <CraftItem text={t(`Keyboard-first — ${modKey}K to search and jump anywhere`, `鍵盤優先 —— ${modKey}K 搜尋並跳到任何地方`)} />
          </motion.div>
        </div>
      </section>

      {/* ── FAQ teaser ─────────────────────────────────────────────────── */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8 lg:py-28">
          <motion.div {...reveal} className="max-w-2xl">
            <Eyebrow>{t('Questions & answers', '問與答')}</Eyebrow>
            <h2 className="mt-4 font-serif text-[1.8rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[2.1rem]">
              {t('A few quick answers.', '幾個快速解答。')}
            </h2>
          </motion.div>
          <motion.div {...reveal} className="mt-8">
            <FaqAccordion items={FAQ_ITEMS.slice(0, 4)} />
            <Link to="/faq" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-strong hover:underline">
              {t('See all questions', '查看所有問題')} <ArrowRight aria-hidden className="size-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Open source / self-host teaser ─────────────────────────────── */}
      <section className="border-t border-border/60 bg-secondary/30">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <motion.div
            {...reveal}
            className="rounded-3xl border border-border bg-card p-7 shadow-soft sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10"
          >
            <div className="max-w-xl">
              <Eyebrow>{t('Open source · MIT', '開源 · MIT 授權')}</Eyebrow>
              <h2 className="mt-4 font-serif text-[1.8rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[2.1rem]">
                {t('Prefer to run it yourself?', '想自己架一套？')}
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground sm:text-[16px]">
                {t(
                  'Mnema is open source. Self-host it on your own Supabase and Cloudflare — the same code that runs here, with your data and your keys.',
                  'Mnema 是開源的。用你自己的 Supabase 與 Cloudflare 自行架設 —— 與這裡完全相同的程式碼，資料與金鑰都在你手上。',
                )}
              </p>
            </div>
            <div className="mt-6 flex shrink-0 flex-wrap items-center gap-x-5 gap-y-3 lg:mt-0">
              <Button asChild variant="outline" className="h-11 gap-2.5 bg-card px-5 shadow-soft hover:shadow-pop">
                <a href={REPO_URL} target="_blank" rel="noreferrer">
                  <GithubIcon className="size-[18px]" /> GitHub
                </a>
              </Button>
              <Link to="/self-host" className="text-sm font-medium text-brand-strong hover:underline">
                {t('Read the self-host guide →', '閱讀自行架設指南 →')}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Closing CTA ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-border/60">
        <div className="pointer-events-none absolute inset-0 bg-dots opacity-50 [mask-image:radial-gradient(ellipse_at_bottom,black,transparent_72%)]" />
        <div className="relative mx-auto max-w-3xl px-5 py-24 text-center sm:px-8 lg:py-32">
          <motion.div {...reveal}>
            <h2 className="mx-auto max-w-2xl font-serif text-[2.15rem] font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl sm:leading-[1.08]">
              {t('Connect your AI. It does the rest.', '連接你的 AI，其餘交給它。')}
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              {t(
                'Sign in with Google and connect the AI you already use. Nothing to learn, nothing to migrate.',
                '使用 Google 登入，連接你已經在用的 AI。沒有要學的，也沒有要搬遷的。',
              )}
            </p>
            <div className="mt-8 flex justify-center">
              <GoogleButton busy={busy} onClick={google} label={t('Continue with Google', '使用 Google 繼續')} />
            </div>
            <p className="mt-5 text-[12.5px] text-muted-foreground">
              {t('We only use your Google account to sign you in.', '我們僅使用你的 Google 帳號為你登入。')}
            </p>
          </motion.div>
        </div>
      </section>
    </PublicShell>
  )
}

function ResultRow({ dot, icon, title, meta }: { dot: string; icon: ReactNode; title: string; meta: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-background/70 px-2.5 py-2">
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: dot }} />
      <span className="shrink-0 text-muted-foreground [&_svg]:size-3.5">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{title}</span>
      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{meta}</span>
    </div>
  )
}

function Pillar({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="border-t border-border pt-5">
      <span className="inline-flex size-9 items-center justify-center rounded-xl bg-brand-muted text-brand [&_svg]:size-[18px]">{icon}</span>
      <h3 className="mt-3.5 text-[15px] font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}

function Step({ n, icon, title, body, delay }: { n: string; icon: ReactNode; title: string; body: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-soft"
    >
      <span className="pointer-events-none absolute -right-1 -top-3 select-none font-serif text-[5.5rem] font-semibold leading-none text-brand/[0.06]">{n}</span>
      <span className="relative inline-flex size-10 items-center justify-center rounded-xl bg-brand-muted text-brand [&_svg]:size-5">{icon}</span>
      <h3 className="relative mt-4 font-serif text-[1.05rem] font-semibold text-foreground">{title}</h3>
      <p className="relative mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
    </motion.div>
  )
}

function PermissionRow({ allow, label }: { allow?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-soft">
      {allow ? (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full" style={{ background: GREEN }}>
          <Check aria-hidden className="size-3.5 text-white" />
        </span>
      ) : (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <X aria-hidden className="size-3" />
        </span>
      )}
      <span className={allow ? 'text-[14px] font-medium text-foreground' : 'text-[14px] text-muted-foreground line-through decoration-border'}>{label}</span>
    </div>
  )
}

function SpaceCard({ dot, icon, name, code, body }: { dot: string; icon: ReactNode; name: string; code: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:shadow-pop">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground [&_svg]:size-[18px]">{icon}</span>
        <span className="text-[14px] font-semibold text-foreground">{name}</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full" style={{ background: dot }} />
          {code}
        </span>
      </div>
      <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}

function CraftItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
      <span className="text-[14px] leading-relaxed text-muted-foreground">{text}</span>
    </div>
  )
}

function MiniGraph() {
  return (
    <svg viewBox="0 0 120 60" className="mx-auto h-14 w-auto text-brand" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1" opacity="0.35">
        <line x1="22" y1="40" x2="50" y2="20" />
        <line x1="50" y1="20" x2="80" y2="30" />
        <line x1="50" y1="20" x2="46" y2="46" />
        <line x1="80" y1="30" x2="100" y2="14" />
        <line x1="80" y1="30" x2="90" y2="48" />
      </g>
      <g fill="currentColor">
        <circle cx="22" cy="40" r="3" />
        <circle cx="50" cy="20" r="4.5" />
        <circle cx="80" cy="30" r="4" />
        <circle cx="46" cy="46" r="2.5" />
        <circle cx="100" cy="14" r="2.5" />
        <circle cx="90" cy="48" r="2.5" />
      </g>
    </svg>
  )
}
