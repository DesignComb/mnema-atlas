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
        subtitle="What an AI can do with your library — live from the API"
        icon={<Wrench className="size-4" />}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-3 px-6 py-8">
          {isLoading && <p className="text-sm text-muted-foreground">Loading from {OPENAPI_URL}…</p>}
          {error && (
            <p className="text-sm text-destructive">
              Couldn't reach the API at {OPENAPI_URL}. Is the worker running?
            </p>
          )}
          {ops.map((op) => {
            const schema = op.requestBody?.content['application/json'].schema
            const props = schema?.properties ?? {}
            const required = schema?.required ?? []
            return (
              <div key={op.path} className="rounded-xl border border-border bg-card p-4 shadow-soft">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-brand-muted px-1.5 py-0.5 text-xs font-medium text-brand">
                    POST {op.path}
                  </code>
                  <span className="font-mono text-[13px] font-medium text-foreground">{op.operationId}</span>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {op.description || op.summary}
                </p>
                {Object.keys(props).length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {Object.keys(props).map((k) => (
                      <span
                        key={k}
                        className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
                          required.includes(k) ? 'bg-muted text-foreground' : 'bg-muted/50 text-muted-foreground'
                        }`}
                      >
                        {k}
                        {required.includes(k) ? '*' : '?'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
