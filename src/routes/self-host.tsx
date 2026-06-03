import { useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Check, Copy, Database, Plug, Rocket, Server } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { Eyebrow, GithubIcon, PublicShell, REPO_URL } from '@/components/public/PublicShell'
import { Button } from '@/components/ui/button'

const CLONE = `git clone ${REPO_URL}
cd mnema-atlas && npm install

# Apply the schema to your own Supabase project. Either:
#   supabase link --project-ref <ref> && supabase db push
#   …or paste supabase/migrations/*.sql into the Supabase SQL editor.

cp .env.example .env.local
#   VITE_SUPABASE_URL=...               (Supabase → Project settings → API)
#   VITE_SUPABASE_PUBLISHABLE_KEY=...   (the publishable / anon key — safe for the browser)

npm run dev          # http://localhost:5173`

const WORKER = `cd worker && npm install
cp .dev.vars.example .dev.vars
#   SUPABASE_URL=...
#   SUPABASE_SECRET_KEY=sb_secret_...   ← server-only. Never ships to the browser.

npm run dev          # wrangler dev → http://localhost:8787`

const DEPLOY = `# Frontend → any static host (Cloudflare Pages / Vercel / Netlify).
npm run build        # set the VITE_* env vars on your host

# Worker → Cloudflare
cd worker
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler deploy
# Then set VITE_MCP_URL / VITE_REST_URL in the frontend so Settings shows them.`

export function SelfHostScreen() {
  const t = useT()

  return (
    <PublicShell>
      <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8 lg:py-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <Eyebrow>{t('Open source · MIT', '開源 · MIT 授權')}</Eyebrow>
          <h1 className="mt-4 font-serif text-[2rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[2.5rem]">
            {t('Run your own Mnema.', '架一套自己的 Mnema。')}
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-[16px]">
            {t(
              'Mnema is open source. Host it yourself on your own Supabase and Cloudflare — your data, your keys, your infrastructure. No account here required.',
              'Mnema 是開源的。在你自己的 Supabase 與 Cloudflare 上自行架設 —— 你的資料、你的金鑰、你的基礎設施，完全不需要這裡的帳號。',
            )}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button asChild variant="outline" className="h-11 gap-2.5 bg-card px-5 shadow-soft hover:shadow-pop">
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                <GithubIcon className="size-[18px]" /> {t('View on GitHub', '在 GitHub 上查看')}
              </a>
            </Button>
            <span className="text-[13px] text-muted-foreground">
              {t('Same code as the hosted app — nothing held back.', '與託管版完全相同的程式碼 —— 沒有任何保留。')}
            </span>
          </div>
        </motion.div>

        {/* What you'll need */}
        <Block delay={0.06}>
          <h2 className="font-serif text-[1.4rem] font-semibold tracking-tight text-foreground">
            {t("What you'll need", '你會需要')}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Need icon={<Server />} title={t('Node ≥ 20.19', 'Node ≥ 20.19')} body={t('To build and run the app.', '用來建置與執行 App。')} />
            <Need icon={<Database />} title={t('A Supabase project', '一個 Supabase 專案')} body={t('Postgres, Auth & RLS — free tier is plenty.', 'Postgres、Auth 與 RLS —— 免費方案就很夠。')} />
            <Need icon={<Plug />} title={t('Cloudflare (optional)', 'Cloudflare（選用）')} body={t('Only for the AI worker (MCP + REST).', '只有 AI worker（MCP + REST）會用到。')} />
          </div>
        </Block>

        {/* Steps */}
        <Block delay={0.1}>
          <Step n={1} title={t('Clone, configure, run', '複製、設定、執行')}>
            {t(
              'Point it at your own Supabase project and apply the schema (migrations live in the repo). Then start the app.',
              '把它指向你自己的 Supabase 專案並套用資料庫結構（migration 都在 repo 裡），接著啟動 App。',
            )}
          </Step>
          <CodeBlock code={CLONE} />
        </Block>

        <Block delay={0.12}>
          <Step n={2} title={t('Add the AI worker (MCP + REST)', '加上 AI worker（MCP + REST）')}>
            {t(
              'This is what lets your own AI connect. It calls the exact same database RPCs as the UI, so AI-added content is identical to what you add by hand.',
              '這就是讓你自己的 AI 連進來的關鍵。它呼叫與介面完全相同的資料庫 RPC，因此 AI 新增的內容，與你親手新增的一模一樣。',
            )}
          </Step>
          <CodeBlock code={WORKER} />
        </Block>

        <Block delay={0.14}>
          <Step n={3} title={t('Deploy', '部署')}>
            {t(
              'The frontend is a static build that goes on any host; the worker deploys to Cloudflare. Set your secrets and ship.',
              '前端是靜態建置，可放上任何主機；worker 部署到 Cloudflare。設好密鑰就能上線。',
            )}
          </Step>
          <CodeBlock code={DEPLOY} />
        </Block>

        {/* Stack note */}
        <Block delay={0.16}>
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <Rocket aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">{t('The stack', '技術組成')}</h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                {t(
                  'React 19 · Vite · TanStack Router/Query · Tailwind v4 on the front; Supabase (Postgres + Auth + RLS) with every write going through shared SECURITY DEFINER RPCs; a Cloudflare Worker exposing an MCP server and a REST API over the same RPCs. The full README in the repo covers each step in detail.',
                  '前端是 React 19 · Vite · TanStack Router/Query · Tailwind v4；後端是 Supabase（Postgres + Auth + RLS），每一次寫入都走共用的 SECURITY DEFINER RPC；另有一個 Cloudflare Worker，以相同的 RPC 對外提供 MCP server 與 REST API。repo 裡完整的 README 會逐步詳細說明。',
                )}
              </p>
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-strong hover:underline">
                <GithubIcon className="size-4" /> {t('Read the full README', '閱讀完整 README')}
              </a>
            </div>
          </div>
        </Block>
      </section>
    </PublicShell>
  )
}

function Block({ children, delay }: { children: ReactNode; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="mt-12"
    >
      {children}
    </motion.div>
  )
}

function Need({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-muted text-brand [&_svg]:size-4">
        {icon}
      </span>
      <p className="mt-2.5 text-[14px] font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="mb-3.5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-semibold text-brand-foreground">
          {n}
        </span>
        <h2 className="font-serif text-[1.25rem] font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{children}</p>
    </div>
  )
}

function CodeBlock({ code }: { code: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-xl border border-border bg-muted/50 px-4 py-3.5 text-[12.5px] leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(code)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        aria-label={t('Copy code', '複製程式碼')}
        className="absolute right-2.5 top-2.5 rounded-md border border-border bg-card p-1.5 text-muted-foreground opacity-0 outline-none transition hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:opacity-100"
      >
        {copied ? <Check aria-hidden className="size-3.5 text-brand" /> : <Copy aria-hidden className="size-3.5" />}
      </button>
    </div>
  )
}
