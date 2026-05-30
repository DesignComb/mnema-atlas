import { importPayload, type ImportPayload } from '@shared/schemas'

export interface ParseResult {
  ok: boolean
  data?: ImportPayload
  error?: string
}

/**
 * Pull the JSON blob out of pasted AI text. Prefers a ```mnema fence, then any
 * ```json/``` fence, then a bare {…} — so it survives the AI wrapping prose
 * around the block.
 */
export function extractBlock(text: string): string | null {
  const fenced = text.match(/```(?:mnema|json)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()
  const brace = text.match(/\{[\s\S]*\}/)
  return brace ? brace[0] : null
}

/** Forgive the common ways pasted JSON breaks: smart quotes, trailing commas. */
function softRepair(s: string): string {
  return s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
}

export function parseMnema(text: string): ParseResult {
  const block = extractBlock(text)
  if (!block) return { ok: false, error: 'No JSON or ```mnema block found in the pasted text.' }

  let json: unknown
  try {
    json = JSON.parse(softRepair(block))
  } catch (e) {
    return { ok: false, error: `Couldn't parse JSON: ${e instanceof Error ? e.message : 'invalid'}` }
  }

  const parsed = importPayload.safeParse(json)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ') }
  }
  return { ok: true, data: parsed.data }
}
