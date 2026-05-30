import { useQuery } from '@tanstack/react-query'
import { Wrench } from 'lucide-react'
import { PageHeader } from '@/components/app-shell/PageHeader'
import { OPENAPI_URL } from '@/lib/endpoints'

interface SchemaObject {
  properties?: Record<string, unknown>
  required?: string[]
}
interface Operation {
  operationId: string
  summary?: string
  description?: string
  requestBody?: { content: { 'application/json': { schema: SchemaObject } } }
}
interface OpenApiDoc {
  paths: Record<string, { post?: Operation }>
}

const humanize = (id: string) => id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

export function ToolsScreen() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['openapi'],
    queryFn: async (): Promise<OpenApiDoc> => {
      const r = await fetch(OPENAPI_URL)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    },
    staleTime: 5 * 60_000,
  })

  const ops = data
    ? Object.entries(data.paths)
        .filter(([, m]) => m.post)
        .map(([path, m]) => ({ path, ...(m.post as Operation) }))
    : []

  return (
    <>
      <PageHeader
        title="Tools"
        subtitle="What a connected AI can do for you"
        icon={<Wrench className="size-4" />}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-3 px-6 py-8">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            These are the exact actions an AI can perform on your library once you connect it — read live from
            the API. An assistant with one of your keys can do <strong className="text-foreground">these and nothing
            else</strong>.
          </p>

          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && (
            <p className="rounded-lg border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground">
              Couldn't load the tool list right now. The AI service may be waking up — try again in a moment.
            </p>
          )}

          {ops.map((op) => {
            const schema = op.requestBody?.content['application/json'].schema
            const props = schema?.properties ?? {}
            const required = schema?.required ?? []
            return (
              <div key={op.path} className="rounded-xl border border-border bg-card p-4 shadow-soft">
                <p className="text-sm font-semibold text-foreground">{humanize(op.operationId)}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {op.description || op.summary}
                </p>
                {Object.keys(props).length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {Object.keys(props).map((k) => (
                      <span
                        key={k}
                        title={required.includes(k) ? 'required' : 'optional'}
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
                <code className="mt-2.5 inline-block rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground/80">
                  POST /rest/{op.operationId}
                </code>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
