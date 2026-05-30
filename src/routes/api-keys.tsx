import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, KeyRound, Plug, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { createApiKey, listApiKeys, revokeApiKey, type CreatedApiKey } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { relativeDue } from '@/lib/utils'
import { MCP_URL, REST_URL } from '@/lib/endpoints'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function ApiKeysScreen() {
  const qc = useQueryClient()
  const { data: keys, isLoading } = useQuery({ queryKey: ['api-keys'], queryFn: listApiKeys })
  const [name, setName] = useState('')
  const [fullAccess, setFullAccess] = useState(false)
  const [created, setCreated] = useState<CreatedApiKey | null>(null)

  const create = useMutation({
    mutationFn: () =>
      createApiKey(name.trim() || 'Untitled key', fullAccess ? ['create', 'edit'] : ['create']),
    onSuccess: (key) => {
      setCreated(key)
      setName('')
      qc.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to create key'),
  })

  const revoke = useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })

  return (
    <>
      <PageHeader title="API keys & MCP" subtitle="Let external AI assistants add content" icon={<KeyRound className="size-4" />} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-8 px-6 py-8">
          {/* Connection card */}
          <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <Plug className="size-4 text-brand" />
              <h3 className="text-sm font-semibold">Connect an AI assistant</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Mnema Atlas exposes a Model Context Protocol (MCP) server so assistants like Claude can create notes
              and flashcards for you — as a tool, not a chatbot baked into the app.
            </p>
            <ConnRow label="MCP endpoint (OAuth · claude.ai connector)" value={MCP_URL} />
            <ConnRow label="REST endpoint (API key · Bearer)" value={REST_URL} />
            <p className="text-xs text-muted-foreground">
              The claude.ai web/desktop connector signs in with OAuth — no key needed. For Claude Code, Cursor,
              scripts, or the REST API, mint a key below and send it as <code className="rounded bg-muted px-1">Authorization: Bearer …</code>.
            </p>
          </section>

          {/* Create key */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Your keys</h3>
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
                Allow this key to <strong className="font-medium text-foreground">edit existing</strong> notes
                (full access). Leave off for an <strong className="font-medium text-foreground">add-only</strong>{' '}
                key — safest to hand to an AI: it can only create, never modify or delete.
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
                            k.scopes?.includes('edit')
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {k.scopes?.includes('edit') ? 'full' : 'add-only'}
                        </span>
                        {k.revoked_at ? <span className="ml-2 text-xs text-destructive">revoked</span> : null}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {k.key_prefix}••••••• ·{' '}
                        {k.last_used_at ? `used ${relativeDue(k.last_used_at)}` : 'never used'}
                      </p>
                    </div>
                    {!k.revoked_at ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Revoke"
                        onClick={() => revoke.mutate(k.id)}
                      >
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
                description="Create a key to let scripts, Cursor, or the Claude API write to your decks."
              />
            )}
          </section>
        </div>
      </div>

      {/* One-time plaintext reveal */}
      <Dialog open={!!created} onOpenChange={(v) => !v && setCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your API key now</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 text-amber-600">
              <TriangleAlert className="size-4" /> This is shown once and never again.
            </DialogDescription>
          </DialogHeader>
          <CopyField value={created?.api_key ?? ''} />
          <DialogFooter>
            <Button variant="brand" onClick={() => setCreated(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ConnRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <CopyField value={value} mono />
    </div>
  )
}

function CopyField({ value, mono }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <code className={`min-w-0 flex-1 truncate text-[13px] ${mono ? 'font-mono' : ''}`}>{value}</code>
      <Button variant="ghost" size="icon-sm" onClick={copy} title="Copy">
        {copied ? <Check className="size-4 text-brand" /> : <Copy className="size-4" />}
      </Button>
    </div>
  )
}
