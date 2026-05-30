import { tools } from './tools'

/**
 * llms.txt — a plain-text, AI-readable "how to use me" served at /llms.txt.
 * Generated from the tool registry so it stays in sync with the real tools.
 */
export function buildLlmsTxt(origin: string): string {
  return [
    '# Mnema Atlas',
    '',
    '> A study-notes flashcard app. External AI assistants add notes and spaced-repetition',
    '> flashcards as a TOOL (not a chatbot), via MCP or REST. Every write goes through one',
    '> shared path and is scoped to the key owner — a key can only ever add to its own library.',
    '',
    '## Connect',
    `- MCP (Claude Code, Cursor): ${origin}/mcp  (header: Authorization: Bearer <mk_key>)`,
    `- REST: POST ${origin}/rest/<tool>  (header: Authorization: Bearer <mk_key>)`,
    `- OpenAPI (ChatGPT custom-GPT actions): ${origin}/openapi.json`,
    '',
    '## Keys',
    '- Mint a key in the app: Settings -> API keys.',
    '- Default keys are ADD-ONLY: they can create notes/decks/flashcards/links and read,',
    '  but cannot edit or delete. Full keys can also edit existing notes.',
    '',
    '## Tools',
    ...tools.map(
      (t) => `- ${t.name}: ${t.description}${t.requiresScope ? ' [needs a FULL key]' : ''}`,
    ),
    '',
  ].join('\n')
}
