import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, KeyRound, Plug, Plus, ShieldCheck, Trash2, TriangleAlert, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { createApiKey, listApiKeys, revokeApiKey, type CreatedApiKey } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { relativeDue } from '@/lib/utils'
import { MCP_URL, REST_URL, OPENAPI_URL } from '@/lib/endpoints'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const SETUP_TABS = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'curl', label: 'curl / REST' },
] as const
type TabId = (typeof SETUP_TABS)[number]['id']

export function IntegrationsScreen() {
  const qc = useQueryClient()
  const { data: keys, isLoading } = useQuery({ queryKey: ['api-keys'], queryFn: listApiKeys })
  const [name, setName] = useState('')
  const [fullAccess, setFullAccess] = useState(false)
  const [created, setCreated] = useState<CreatedApiKey | null>(null)
  const [lastKey, setLastKey] = useState<string | null>(null) // stash plaintext so the snippets show the real key
  const [tab, setTab] = useState<TabId>('claude')

  const create = useMutation({
    mutationFn: () => createApiKey(name.trim() || 'Untitled key', fullAccess ? ['create', 'edit'] : ['create']),
    onSuccess: (k) => {
      setCreated(k)
      setLastKey(k.api_key)
      setName('')
      qc.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to create key'),
  })
  const revoke = useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })

  const key = lastKey ?? 'mk_your_key'

  return (
    <>
      <PageHeader
        title="Connect an AI"
        subtitle="Let an assistant add notes & flashcards for you"
        icon={<Plug className="size-4" />}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-9 px-6 py-8">
          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-4 text-[13px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
            <span>
              An AI you connect can <strong className="text-foreground">only add</strong> notes &amp; flashcards to
              your library — by default it can never edit, delete, or see anyone else's. Revoke a key anytime below.
            </span>
          </div>

          {/* 1 · Keys */}
          <section className="space-y-3">
            <SectionTitle n={1} icon={<KeyRound />}>Create a key</SectionTitle>
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Key name (e.g. “Cursor laptop”)"
                onKeyDown={(e) => e.key === 'Enter' && create.mutate()}
              />
              <Button variant="brand" onClick={() => create.mutate()} disabled={create.isPending}>
                <Plus className="size-4" /> Create
              </Button>
            </div>
            <label className="flex cursor-pointer select-none items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={fullAccess}
                onChange={(e) => setFullAccess(e.target.checked)}
                className="mt-0.5 size-3.5"
              />
              <span>
                Allow this key to <strong className="font-medium text-foreground">edit existing</strong> notes (full
                access). Leave off for <strong className="font-medium text-foreground">add-only</strong> — safest for an AI.
              </span>
            </label>

            {isLoading ? (
              <div className="h-16 animate-pulse rounded-xl border border-border bg-card/60" />
            ) : keys?.length ? (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {keys.map((k) => (
                  <div key={k.id} className="flex items-center gap-3 px-4 py-3">
                    <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {k.name}
                        <span
                          className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            k.scopes?.includes('edit') ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {k.scopes?.includes('edit') ? 'full' : 'add-only'}
                        </span>
                        {k.revoked_at ? <span className="ml-2 text-xs text-destructive">revoked</span> : null}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {k.key_prefix}••••••• · {k.last_used_at ? `used ${relativeDue(k.last_used_at)}` : 'never used'}
                      </p>
                    </div>
                    {!k.revoked_at ? (
                      <Button variant="ghost" size="icon-sm" title="Revoke" onClick={() => revoke.mutate(k.id)}>
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<KeyRound className="size-6" />}
                title="No keys yet"
                description="Create a key, then use it to connect your AI below."
              />
            )}
          </section>

          {/* 2 · Set up */}
          <section className="space-y-3">
            <SectionTitle n={2} icon={<Plug />}>Set up your assistant</SectionTitle>
            {!lastKey ? (
              <p className="text-[13px] text-muted-foreground">
                Create a key above and the snippets below fill in with your real key automatically.
              </p>
            ) : null}
            <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
              {SETUP_TABS.map((t) => (
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
              <CopyBlock code={`claude mcp add --transport http mnema-atlas \\\n  ${MCP_URL} \\\n  --header "Authorization: Bearer ${key}"`} />
            )}
            {tab === 'cursor' && (
              <CopyBlock
                code={JSON.stringify(
                  { mcpServers: { 'mnema-atlas': { url: MCP_URL, headers: { Authorization: `Bearer ${key}` } } } },
                  null,
                  2,
                )}
              />
            )}
            {tab === 'chatgpt' && (
              <div className="space-y-2">
                <CopyBlock code={OPENAPI_URL} />
                <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-muted-foreground">
                  <li>New GPT → Configure → <strong className="text-foreground">Create new action</strong> → Import from URL → paste the URL above.</li>
                  <li>Authentication → <strong className="text-foreground">API Key</strong> → <strong className="text-foreground">Bearer</strong> → paste your key.</li>
                  <li>In chat: "save this as flashcards in Mnema".</li>
                </ol>
              </div>
            )}
            {tab === 'curl' && (
              <CopyBlock code={`curl -X POST ${REST_URL}/create_flashcard \\\n  -H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"front":"What is FSRS?","back":"A spaced-repetition algorithm."}'`} />
            )}
          </section>

          {/* 3 · Tools */}
          <section className="space-y-3">
            <SectionTitle n={3} icon={<Wrench />}>What the AI can do</SectionTitle>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              The exact actions a connected AI can perform — read live from the API. It can do these and nothing else.
            </p>
            <ToolsList />
          </section>
        </div>
      </div>

      <Dialog open={!!created} onOpenChange={(v) => !v && setCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your API key now</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 text-amber-600">
              <TriangleAlert className="size-4" /> Shown once and never again.
            </DialogDescription>
          </DialogHeader>
          <CopyField value={created?.api_key ?? ''} />
          <DialogFooter>
            <Button variant="brand" onClick={() => setCreated(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function SectionTitle({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand-muted text-[11px] font-semibold text-brand">
        {n}
      </span>
      <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
      {children}
    </h3>
  )
}

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

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{value}</code>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={async () => {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        title="Copy"
      >
        {copied ? <Check className="size-4 text-brand" /> : <Copy className="size-4" />}
      </Button>
    </div>
  )
}

interface Op {
  operationId: string
  summary?: string
  description?: string
  requestBody?: { content: { 'application/json': { schema: { properties?: Record<string, unknown>; required?: string[] } } } }
}
const humanize = (id: string) => id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

function ToolsList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['openapi'],
    queryFn: async () => {
      const r = await fetch(OPENAPI_URL)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<{ paths: Record<string, { post?: Op }> }>
    },
    staleTime: 5 * 60_000,
  })
  const ops = useMemo(
    () => (data ? Object.values(data.paths).filter((m) => m.post).map((m) => m.post as Op) : []),
    [data],
  )
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (error)
    return (
      <p className="rounded-lg border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground">
        Couldn't load the tool list right now — the AI service may be waking up.
      </p>
    )
  return (
    <div className="space-y-2">
      {ops.map((op) => {
        const schema = op.requestBody?.content['application/json'].schema
        const props = schema?.properties ?? {}
        const required = schema?.required ?? []
        return (
          <div key={op.operationId} className="rounded-xl border border-border bg-card p-3.5">
            <p className="text-[13px] font-semibold text-foreground">{humanize(op.operationId)}</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{op.description || op.summary}</p>
            {Object.keys(props).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.keys(props).map((k) => (
                  <span
                    key={k}
                    className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
                      required.includes(k) ? 'bg-muted text-foreground' : 'bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    {k}
                    {required.includes(k) ? '' : '?'}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
