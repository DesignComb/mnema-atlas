import { ChevronDown } from 'lucide-react'
import { useT } from '@/lib/i18n'

export interface FaqItem {
  q_en: string
  q_zh: string
  a_en: string
  a_zh: string
}

/** Source of truth for the FAQ — the landing shows the first few, /faq shows all. */
export const FAQ_ITEMS: FaqItem[] = [
  {
    q_en: 'Do I need to be technical?',
    q_zh: '我需要懂技術嗎？',
    a_en: 'No. If you already chat with ChatGPT, Claude, or Gemini, you can use Mnema. Connecting an AI is a single paste — and if you’d rather not set anything up, the copy-paste import works with plain ChatGPT or Gemini.',
    a_zh: '不用。只要你已經在用 ChatGPT、Claude 或 Gemini，就能使用 Mnema。連接 AI 只要貼上一段設定；如果連設定都不想做，也能用複製貼上的方式，搭配一般的 ChatGPT 或 Gemini 匯入。',
  },
  {
    q_en: 'Does Mnema have its own AI? Do you train on my data?',
    q_zh: 'Mnema 有自己的 AI 嗎？你們會用我的資料訓練嗎？',
    a_en: 'No, and no. Mnema hosts no AI and runs no model of its own — you bring the assistant you already use, and Mnema is simply where its work lands. Your content is yours; we never use it to train anything.',
    a_zh: '都不會。Mnema 本身不內建 AI、也不跑任何模型 —— 你帶來自己已經在用的助理，Mnema 只是它成果落腳的地方。你的內容是你的，我們絕不會拿去訓練任何東西。',
  },
  {
    q_en: 'Is my data safe? What does “add-only” mean?',
    q_zh: '我的資料安全嗎？「僅可新增」是什麼意思？',
    a_en: 'By default every key is add-only: a connected AI can only add content — never edit, complete, delete, or see anyone else’s data. It’s enforced in the database, not just the interface, and you can revoke any key in one click.',
    a_zh: '預設每把金鑰都「僅可新增」：連接的 AI 只能新增內容 —— 無法編輯、完成、刪除，也看不到任何其他人的資料。這是在資料庫層強制執行，不只是介面上的限制，而且任何金鑰都能一鍵撤銷。',
  },
  {
    q_en: 'Which AIs can I connect?',
    q_zh: '可以連接哪些 AI？',
    a_en: 'Anything that speaks MCP (Claude, Claude Code, Cursor…) or can call a REST API with a Bearer key (a custom GPT via OpenAPI, your own scripts, the Claude API). Plain ChatGPT or Gemini work through the no-setup copy-paste import.',
    a_zh: '任何支援 MCP 的工具（Claude、Claude Code、Cursor…），或能以 Bearer 金鑰呼叫 REST API 的工具（透過 OpenAPI 的自訂 GPT、你自己的腳本、Claude API）。一般的 ChatGPT 或 Gemini 則可用免設定的複製貼上匯入。',
  },
  {
    q_en: 'What can my AI actually do here?',
    q_zh: '我的 AI 在這裡到底能做什麼？',
    a_en: 'Create notes and flashcards, draft multi-day trips, add tasks, habits, and reminders, and more — it picks the right space from what you ask. The exact, live list of actions appears in Settings once you connect.',
    a_zh: '建立筆記與閃卡、草擬多天行程、新增任務、習慣與提醒等等 —— 它會依你說的內容，選擇正確的區塊。連接之後，設定頁會即時列出它能執行的確切操作。',
  },
  {
    q_en: 'Is it free?',
    q_zh: '免費嗎？',
    a_en: 'The hosted app is free to use with your Google account; you bring (and pay for) your own AI. Mnema is also open source under the MIT license, so you can self-host it for free.',
    a_zh: '託管版可用你的 Google 帳號免費使用，AI 由你自備（費用也由你負擔）。Mnema 同時以 MIT 授權開源，所以你也可以免費自行架設。',
  },
  {
    q_en: 'Can I self-host it?',
    q_zh: '我可以自己架設嗎？',
    a_en: 'Yes. Mnema is open source (MIT) and runs on Supabase + a Cloudflare Worker + any static host. The self-host guide walks through it end to end.',
    a_zh: '可以。Mnema 是開源的（MIT 授權），跑在 Supabase + Cloudflare Worker + 任何靜態主機上。「自行架設」指南會帶你從頭到尾走一遍。',
  },
  {
    q_en: 'Which languages does it support?',
    q_zh: '支援哪些語言？',
    a_en: 'The whole app — and this site — is fully bilingual in English and Traditional Chinese, with a live toggle on every screen.',
    a_zh: '整個 App 與本網站都完整支援雙語：英文與繁體中文，每個畫面都能即時切換。',
  },
  {
    q_en: 'What happens if I revoke a key?',
    q_zh: '撤銷金鑰會怎樣？',
    a_en: 'The AI using that key loses access immediately. Everything it already added stays — it’s your content, and it remains in your workspace.',
    a_zh: '使用該金鑰的 AI 會立刻失去存取權。它先前新增的內容全部保留 —— 那是你的內容，會一直留在你的工作區裡。',
  },
]

/** Accessible accordion built on native <details>, so it works with zero JS. */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const t = useT()
  return (
    <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      {items.map((it) => (
        <details key={it.q_en} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-medium text-foreground transition hover:bg-accent/40 [&::-webkit-details-marker]:hidden">
            <span>{t(it.q_en, it.q_zh)}</span>
            <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <p className="px-5 pb-5 text-[14px] leading-relaxed text-muted-foreground">{t(it.a_en, it.a_zh)}</p>
        </details>
      ))}
    </div>
  )
}
