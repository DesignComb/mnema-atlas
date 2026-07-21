import { Hono } from 'hono'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { z } from 'zod'
import { authenticateAssistant } from './auth'
import { cleanError } from './errors'
import type { Env } from './env'
import { toolAllowed, toolByName, tools } from './tools'

/** System prompt, stamped with today's date so relative dates ("tomorrow",
 *  "next month", "ten days before") resolve correctly. */
function systemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10)
  return (
    'You are a tool-calling agent for Mnema, a personal life OS. ' +
    "Turn the user's request into the smallest correct set of tool calls. " +
    'Infer the right Space from context. ' +
    `Today's date is ${today}. All dates are YYYY-MM-DD; resolve relative dates against today. ` +
    'Do NOT ask clarifying questions — choose sensible defaults and act. ' +
    'If a vague single thought does not map cleanly to a tool, call create_capture so it lands in the inbox. ' +
    'Never invent ids or data the user did not give.'
  )
}
const MAX_TOOL_ROUNDS = 6

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: OpenAiToolCall[]
  tool_call_id?: string
}

interface OpenAiToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

interface ChatCompletion {
  choices?: Array<{ message?: { content?: string | null; tool_calls?: OpenAiToolCall[] } }>
  error?: { message?: string }
}

async function complete(apiKey: string, messages: ChatMessage[], openAiTools: unknown[]): Promise<ChatCompletion> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    // gpt-5.6 rejects function tools on /chat/completions unless reasoning is
    // off ("reasoning_effort must be 'none'"); the alternative is /v1/responses.
    body: JSON.stringify({ model: 'gpt-5.6', reasoning_effort: 'none', messages, tools: openAiTools, tool_choice: 'auto' }),
  })
  const body = (await response.json().catch(() => ({}))) as ChatCompletion
  if (!response.ok) throw new Error(body.error?.message || 'OpenAI request failed')
  return body
}

/** One-shot, authenticated in-app voice/text agent. Mounted at /assistant. */
export const assistant = new Hono<{ Bindings: Env; Variables: { userId: string; scopes: string[] } }>()

assistant.use('*', async (c, next) => {
  const auth = await authenticateAssistant(c.env, c.req.raw)
  if (!auth) return c.json({ error: 'unauthorized: sign in or send a valid Bearer API key' }, 401)
  c.set('userId', auth.userId)
  c.set('scopes', auth.scopes)
  await next()
})

assistant.post('/', async (c) => {
  if (!c.env.OPENAI_API_KEY) return c.json({ error: 'assistant is not configured' }, 503)
  const body = await c.req.json().catch(() => null)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) return c.json({ error: 'text is required' }, 400)
  if (text.length > 10_000) return c.json({ error: 'text is too long' }, 400)

  const scopes = c.get('scopes')
  // OpenAI caps `tools` at 128 functions per request. Send only WRITE tools —
  // voice is for taking actions, not reading — which is both under the cap and
  // higher-signal for the model (the ~40 list/get/search tools just add noise).
  // The slice is a hard backstop so adding tools can never re-breach the limit.
  const openAiTools = tools
    .filter((tool) => !tool.readOnly && toolAllowed(tool, scopes))
    .slice(0, 128)
    .map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.schema as z.ZodType, { $refStrategy: 'none' }),
      },
    }))
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt() },
    { role: 'user', content: text },
  ]
  const actions: Array<{ tool: string; summary: string }> = []

  try {
    let finalSummary = ''
    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const completion = await complete(c.env.OPENAI_API_KEY, messages, openAiTools)
      const message = completion.choices?.[0]?.message
      if (!message) throw new Error('OpenAI returned no response')
      const calls = message.tool_calls ?? []
      messages.push({ role: 'assistant', content: message.content ?? null, ...(calls.length ? { tool_calls: calls } : {}) })
      if (!calls.length) {
        finalSummary = message.content?.trim() || actions.map((action) => action.summary).join(' · ') || 'Done'
        break
      }

      for (const call of calls) {
        const tool = toolByName.get(call.function.name)
        let result: unknown
        if (!tool || !toolAllowed(tool, scopes)) {
          result = { error: 'This tool is unavailable for this caller.' }
        } else {
          let args: unknown
          try {
            args = JSON.parse(call.function.arguments || '{}')
          } catch {
            args = null
          }
          const parsed = tool.schema.safeParse(args)
          if (!parsed.success) {
            result = { error: 'Invalid tool arguments.', issues: parsed.error.issues }
          } else {
            const run = await tool.run(
              { env: c.env, userId: c.get('userId'), via: 'rest' },
              parsed.data as Record<string, unknown>,
            )
            actions.push({ tool: tool.name, summary: run.summary })
            result = { ok: true, summary: run.summary, data: run.data }
          }
        }
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
      }
    }

    const summary = finalSummary || actions.map((action) => action.summary).join(' · ') || 'Done'
    return c.json({ ok: true, summary, actions })
  } catch (error) {
    const { message, status } = cleanError(error)
    return c.json({ error: message }, status)
  }
})
