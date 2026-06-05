import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, Copy, KeyRound, Plug, Plus, ShieldCheck, Trash2, TriangleAlert, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { createApiKey, listApiKeys, revokeApiKey, type CreatedApiKey } from '@/lib/api'
import { disableReminders, enableReminders, hasPushSubscription, notificationPermission, pushSupported } from '@/lib/push'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { relativeDue } from '@/lib/utils'
import { useT } from '@/lib/i18n'
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
  { id: 'lechat', label: 'Le Chat' },
  { id: 'curl', label: 'curl / REST' },
] as const
type TabId = (typeof SETUP_TABS)[number]['id']

function ReminderCard() {
  const t = useT()
  const [supported] = useState(() => pushSupported())
  const [perm, setPerm] = useState(() => notificationPermission())
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void hasPushSubscription().then(setSubscribed)
  }, [])

  async function toggle() {
    setBusy(true)
    try {
      if (subscribed) {
        await disableReminders()
        setSubscribed(false)
        toast.success(t('Reminders turned off', '已關閉提醒'))
      } else {
        await enableReminders()
        setSubscribed(true)
        setPerm(notificationPermission())
        toast.success(t('Reminders enabled', '已開啟提醒'))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not change reminders', '無法變更提醒'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2.5">
        <span className="flex size-7 items-center justify-center rounded-lg bg-brand-muted text-brand">
          <Bell className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold text-foreground">{t('Reminders', '提醒')}</h2>
          <p className="text-[12.5px] text-muted-foreground">
            {t('Get a push when a Tempo task is due — even when the app is closed.', '當 Tempo 任務到期時收到推播 —— 即使 App 關閉也會通知。')}
          </p>
        </div>
        {supported ? (
          <Button variant={subscribed ? 'outline' : 'brand'} size="sm" onClick={toggle} disabled={busy}>
            {subscribed ? t('Turn off', '關閉') : t('Enable', '開啟')}
          </Button>
        ) : null}
      </div>
      {!supported ? (
        <p className="text-[12px] text-muted-foreground">
          {t('Push isn’t supported here. On iPhone, add Mnema to your Home Screen first.', '此裝置不支援推播。iPhone 請先把 Mnema 加到主畫面。')}
        </p>
      ) : perm === 'denied' ? (
        <p className="text-[12px] text-destructive">
          {t('Notifications are blocked in your browser settings — allow them to enable reminders.', '瀏覽器已封鎖通知 —— 請允許通知才能開啟提醒。')}
        </p>
      ) : null}
    </section>
  )
}

export function IntegrationsScreen() {
  const qc = useQueryClient()
  const t = useT()
  const { data: keys, isLoading } = useQuery({ queryKey: ['api-keys'], queryFn: listApiKeys })
  const [name, setName] = useState('')
  const [fullAccess, setFullAccess] = useState(false)
  const [created, setCreated] = useState<CreatedApiKey | null>(null)
  const [lastKey, setLastKey] = useState<string | null>(null) // stash plaintext so the snippets show the real key
  const [tab, setTab] = useState<TabId>('claude')

  const create = useMutation({
    mutationFn: () => createApiKey(name.trim() || t('Untitled key', '未命名金鑰'), fullAccess ? ['create', 'edit'] : ['create']),
    onSuccess: (k) => {
      setCreated(k)
      setLastKey(k.api_key)
      setName('')
      qc.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t('Failed to create key', '建立金鑰失敗')),
  })
  const revoke = useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })

  const key = lastKey ?? 'mk_your_key'

  return (
    <>
      <PageHeader
        title={t('Connect an AI', '連接 AI')}
        subtitle={t('Bring your own AI — it can add notes, trips & tasks for you', '帶你自己的 AI 來 —— 幫你新增筆記、行程與任務')}
        icon={<Plug className="size-4" />}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-9 px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-4 text-[13px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
            <span>
              {t('An AI you connect can ', '你連接的 AI ')}<strong className="text-foreground">{t('only add', '只能新增')}</strong>{t(" content across your spaces — notes, trips, tasks — and figures out where from what you ask. By default it can never edit, complete, delete, or see anyone else's. Revoke a key anytime below.", '內容到你的各個區塊 —— 筆記、行程、任務 —— 並依你說的內容判斷該放哪裡。預設情況下，它無法編輯、完成、刪除，也看不到其他人的內容。你可以隨時在下方撤銷金鑰。')}
            </span>
          </div>

          <ReminderCard />

          {/* 1 · Keys */}
          <section className="space-y-3">
            <SectionTitle n={1} icon={<KeyRound />}>{t('Create a key', '建立金鑰')}</SectionTitle>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('Key name (e.g. “Cursor laptop”)', '金鑰名稱（例如「Cursor 筆電」）')}
                onKeyDown={(e) => e.key === 'Enter' && create.mutate()}
              />
              <Button variant="brand" onClick={() => create.mutate()} disabled={create.isPending} className="shrink-0">
                <Plus className="size-4" /> {t('Create', '建立')}
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
                {t('Allow this key to ', '允許此金鑰')}<strong className="font-medium text-foreground">{t('edit existing', '編輯既有')}</strong>{t(' notes (full access). Leave off for ', '筆記（完整存取）。不勾選則為')}<strong className="font-medium text-foreground">{t('add-only', '僅新增')}</strong>{t(' — safest for an AI.', ' — 對 AI 而言最安全。')}
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
                          {k.scopes?.includes('edit') ? t('full', '完整') : t('add-only', '僅新增')}
                        </span>
                        {k.revoked_at ? <span className="ml-2 text-xs text-destructive">{t('revoked', '已撤銷')}</span> : null}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {k.key_prefix}••••••• ·{' '}
                        {k.last_used_at
                          ? t(`used ${relativeDue(k.last_used_at, undefined, 'en')}`, `使用於 ${relativeDue(k.last_used_at, undefined, 'zh')}`)
                          : t('never used', '從未使用')}
                      </p>
                    </div>
                    {!k.revoked_at ? (
                      <Button variant="ghost" size="icon-sm" title={t('Revoke', '撤銷')} onClick={() => revoke.mutate(k.id)}>
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<KeyRound className="size-6" />}
                title={t('No keys yet', '尚無金鑰')}
                description={t('Create a key, then use it to connect your AI below.', '先建立一把金鑰，再用它在下方連接你的 AI。')}
              />
            )}
          </section>

          {/* 2 · Set up */}
          <section className="space-y-3">
            <SectionTitle n={2} icon={<Plug />}>{t('Set up your assistant', '設定你的助理')}</SectionTitle>
            {!lastKey ? (
              <p className="text-[13px] text-muted-foreground">
                {t('Create a key above and the snippets below fill in with your real key automatically.', '在上方建立金鑰後，下方的程式碼片段會自動填入你的真實金鑰。')}
              </p>
            ) : null}
            <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
              {SETUP_TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-center text-[11px] font-medium leading-tight transition sm:px-3 sm:text-[13px] ${
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
                <ol className="list-decimal space-y-1 pl-4 text-[13px] leading-relaxed text-muted-foreground sm:pl-5">
                  <li>New GPT → Configure → <strong className="text-foreground">Create new action</strong> → Import from URL → {t('paste the URL above.', '貼上上方的網址。')}</li>
                  <li>Authentication → <strong className="text-foreground">API Key</strong> → <strong className="text-foreground">Bearer</strong> → {t('paste your key.', '貼上你的金鑰。')}</li>
                  <li>{t('In chat: ', '在對話中輸入：')}"save this as flashcards in Mnema".</li>
                </ol>
              </div>
            )}
            {tab === 'lechat' && (
              <div className="space-y-2">
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {t('Le Chat (Mistral) supports custom MCP connectors free — on web ', 'Le Chat（Mistral）免費支援自訂 MCP 連接器 —— 網頁 ')}
                  <strong className="text-foreground">{t('and the iPhone/Android app', '與 iPhone／Android App')}</strong>
                  {t(', so your phone can use Mnema with no computer running.', '都能用，手機就能操作 Mnema，不用開電腦。')}
                </p>
                <CopyBlock code={MCP_URL} />
                <ol className="list-decimal space-y-1 pl-4 text-[13px] leading-relaxed text-muted-foreground sm:pl-5">
                  <li>{t('In Le Chat: ', '在 Le Chat 中：')}<strong className="text-foreground">{t('Connectors', '連接器')}</strong> → <strong className="text-foreground">{t('Add Connector', '新增連接器')}</strong> → <strong className="text-foreground">{t('Custom MCP Connector', '自訂 MCP 連接器')}</strong>.</li>
                  <li>{t('Server URL → paste the URL above; name it “mnema-atlas”.', '伺服器網址 → 貼上上方網址；命名為「mnema-atlas」。')}</li>
                  <li>{t('Connect → choose ', '連接 → 選擇 ')}<strong className="text-foreground">HTTP Bearer Token</strong>{t(' → paste your key: ', ' → 貼上你的金鑰：')}<code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{key}</code></li>
                  <li>{t('In chat: ', '在對話中輸入：')}"save this as flashcards in Mnema".</li>
                </ol>
              </div>
            )}
            {tab === 'curl' && (
              <CopyBlock code={`curl -X POST ${REST_URL}/create_flashcard \\\n  -H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"front":"What is FSRS?","back":"A spaced-repetition algorithm."}'`} />
            )}
          </section>

          {/* 3 · Tools */}
          <section className="space-y-3">
            <SectionTitle n={3} icon={<Wrench />}>{t('What the AI can do', 'AI 能做什麼')}</SectionTitle>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {t('The exact actions a connected AI can perform — read live from the API. It can do these and nothing else.', '已連接的 AI 能執行的確切操作 — 直接從 API 即時讀取。它只能做這些，別無其他。')}
            </p>
            <ToolsList />
          </section>
        </div>
      </div>

      <Dialog open={!!created} onOpenChange={(v) => !v && setCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Copy your API key now', '立即複製你的 API 金鑰')}</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 text-amber-600">
              <TriangleAlert className="size-4" /> {t('Shown once and never again.', '只會顯示這一次，之後不再顯示。')}
            </DialogDescription>
          </DialogHeader>
          <CopyField value={created?.api_key ?? ''} />
          <DialogFooter>
            <Button variant="brand" onClick={() => setCreated(null)}>{t('Done', '完成')}</Button>
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
  const t = useT()
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
        title={t('Copy', '複製')}
      >
        {copied ? <Check className="size-3.5 text-brand" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  )
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const t = useT()
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
        title={t('Copy', '複製')}
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
  const t = useT()
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
  if (isLoading) return <p className="text-sm text-muted-foreground">{t('Loading…', '載入中…')}</p>
  if (error)
    return (
      <p className="rounded-lg border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground">
        {t("Couldn't load the tool list right now — the AI service may be waking up.", '目前無法載入工具清單 — AI 服務可能正在啟動。')}
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
