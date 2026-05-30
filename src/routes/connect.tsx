import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, Copy, Plug } from 'lucide-react'
import { PageHeader } from '@/components/app-shell/PageHeader'
import { MCP_URL, REST_URL, OPENAPI_URL } from '@/lib/endpoints'

function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 px-4 py-3 text-[12.5px] leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(code)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        className="absolute right-2 top-2 rounded-md border border-border bg-card p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100"
        title="Copy"
      >
        {copied ? <Check className="size-3.5 text-brand" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  )
}

function Section({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-[13px] text-muted-foreground">{desc}</p>
      </div>
      {children}
    </section>
  )
}

const TABS = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'curl', label: 'curl / REST' },
] as const
type TabId = (typeof TABS)[number]['id']

export function ConnectScreen() {
  const [tab, setTab] = useState<TabId>('claude')

  return (
    <>
      <PageHeader
        title="Connect an AI"
        subtitle="Let an assistant add notes & flashcards for you"
        icon={<Plug className="size-4" />}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 px-6 py-8">
          <div className="rounded-xl border border-border bg-card p-4 text-[13px] leading-relaxed text-muted-foreground">
            First,{' '}
            <Link to="/settings/keys" className="font-medium text-brand hover:underline">
              mint an API key
            </Link>
            . Default keys are <strong className="text-foreground">add-only</strong> — safe to hand to any AI:
            it can only <em>add</em> to your library, never edit or delete, and never touch anyone else's.
          </div>

          <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                  tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'claude' && (
            <Section title="Claude Code" desc="Add the MCP server once; Claude can then add content in any session.">
              <CopyBlock
                code={`claude mcp add --transport http mnema-atlas \\\n  ${MCP_URL} \\\n  --header "Authorization: Bearer mk_your_key"`}
              />
            </Section>
          )}
          {tab === 'cursor' && (
            <Section title="Cursor" desc="Add to your MCP config (Settings → MCP → Add new server).">
              <CopyBlock
                code={JSON.stringify(
                  { mcpServers: { 'mnema-atlas': { url: MCP_URL, headers: { Authorization: 'Bearer mk_your_key' } } } },
                  null,
                  2,
                )}
              />
            </Section>
          )}
          {tab === 'chatgpt' && (
            <Section title="ChatGPT — custom GPT Action" desc="No tools? A custom GPT can call the REST API directly.">
              <CopyBlock code={OPENAPI_URL} />
              <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-muted-foreground">
                <li>
                  New GPT → Configure → <strong className="text-foreground">Create new action</strong> → Import
                  from URL → paste the URL above.
                </li>
                <li>
                  Authentication → <strong className="text-foreground">API Key</strong> → Auth Type{' '}
                  <strong className="text-foreground">Bearer</strong> → paste your{' '}
                  <code className="rounded bg-muted px-1">mk_…</code> key.
                </li>
                <li>In chat: "save this as flashcards in Mnema".</li>
              </ol>
            </Section>
          )}
          {tab === 'curl' && (
            <Section title="curl / any REST client" desc="The exact same shared write path the UI uses.">
              <CopyBlock
                code={`curl -X POST ${REST_URL}/create_flashcard \\\n  -H "Authorization: Bearer mk_your_key" \\\n  -H "Content-Type: application/json" \\\n  -d '{"front":"What is FSRS?","back":"A modern spaced-repetition algorithm."}'`}
              />
              <p className="text-[13px] text-muted-foreground">
                Discover every tool programmatically: <code className="rounded bg-muted px-1">GET {OPENAPI_URL}</code>
              </p>
            </Section>
          )}
        </div>
      </div>
    </>
  )
}
