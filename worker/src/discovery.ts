import { tools } from './tools'

/**
 * Machine-readable discovery document. Served (keyless) at GET / and
 * /.well-known/mnema so an agent can bootstrap before it even has a key.
 */
export function discoveryIndex(origin: string) {
  return {
    name: 'mnema-atlas',
    description: 'Add study notes and spaced-repetition flashcards to a Mnema Atlas library, as an AI tool.',
    endpoints: {
      mcp: `${origin}/mcp`,
      rest: `${origin}/rest`,
      openapi: `${origin}/openapi.json`,
      llms: `${origin}/llms.txt`,
      health: `${origin}/healthz`,
    },
    auth: {
      type: 'bearer',
      scheme: 'API key (mk_…), minted in the app',
      scopes: { 'add-only': 'create + read (default, safest to hand an AI)', full: 'also edit existing notes' },
    },
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      readOnly: t.readOnly,
      requiresScope: t.requiresScope ?? null,
    })),
  }
}
