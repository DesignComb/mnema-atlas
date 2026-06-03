import { zodToJsonSchema } from 'zod-to-json-schema'
import type { z } from 'zod'
import { tools } from './tools'

/**
 * OpenAPI 3.1 spec generated from the SAME tool registry the MCP/REST server
 * uses — so it can never drift from the real endpoints. Importable by ChatGPT
 * custom-GPT Actions (and any OpenAPI-driven agent) with a Bearer API key.
 */
export function buildOpenApiSpec(origin: string) {
  const paths: Record<string, unknown> = {}

  for (const tool of tools) {
    const requestSchema = zodToJsonSchema(tool.schema as z.ZodType, { $refStrategy: 'none' })
    paths[`/rest/${tool.name}`] = {
      post: {
        operationId: tool.name,
        summary: tool.description,
        description:
          tool.description +
          (tool.requiresScope
            ? ` Requires a FULL key (the '${tool.requiresScope}' scope); add-only keys get 403.`
            : ' Works with any valid key, including add-only.'),
        requestBody: {
          required: true,
          content: { 'application/json': { schema: requestSchema } },
        },
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    summary: { type: 'string' },
                    data: {},
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid input (schema validation failed)' },
          '401': { description: 'Missing or invalid API key' },
          '403': { description: 'Key lacks the required scope (add-only key on an edit tool)' },
        },
      },
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Mnema',
      version: '0.1.0',
      description:
        'A personal notes + assistant workspace the user drives with THEIR OWN AI (Mnema hosts no AI itself). ' +
        'Act as a tool. The workspace has several spaces — pick tools by context: Study (Atlas: notes, decks, ' +
        'flashcards, graph), Travel (Voyage: trips, days, activities, reservations, packing), Tasks (Tempo: ' +
        'to-dos, lists, habits, calendar, recurrence, reminders), and Money (Galleon: ledgers, accounts & balances, ' +
        'budgets, recurring transactions, and Splitwise-style bill-splitting with settle-up). More spaces may be added over time. ' +
        'Authenticate with a Bearer API key minted in the app (Settings → API keys). ' +
        'Add-only keys may only create + read; full keys may also edit/complete/delete. Every write is scoped to the key owner.',
    },
    servers: [{ url: origin }],
    security: [{ bearerApiKey: [] }],
    components: {
      securitySchemes: {
        bearerApiKey: {
          type: 'http',
          scheme: 'bearer',
          description: 'A Mnema Atlas API key (mk_…). Mint one in the app; add-only by default.',
        },
      },
    },
    paths,
  }
}
