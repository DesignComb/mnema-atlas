import { McpServer, StreamableHttpTransport } from 'mcp-lite'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { z } from 'zod'
import { toolAllowed, tools } from './tools'
import type { Env } from './env'

/**
 * Build a stateless MCP server bound to one resolved user. Tool handlers run the
 * shared registry, so MCP writes go through the same RPCs as the UI and REST.
 *
 * zod 3.25 schemas implement Standard Schema (mcp-lite validates with that) and
 * are converted to JSON Schema for tools/list via the schemaAdapter.
 */
export function buildMcpServer(env: Env, userId: string, scopes: string[]): McpServer {
  const server = new McpServer({
    name: 'mnema-atlas',
    version: '0.1.0',
    schemaAdapter: (schema) => zodToJsonSchema(schema as unknown as z.ZodType),
  })

  for (const tool of tools) {
    server.tool(tool.name, {
      description: tool.description,
      annotations: { readOnlyHint: tool.readOnly, destructiveHint: false },
      inputSchema: tool.schema as unknown as StandardSchemaV1<unknown, unknown>,
      handler: async (args) => {
        if (!toolAllowed(tool, scopes)) {
          throw new Error(
            `forbidden: this key is add-only and cannot call '${tool.name}' (needs the 'edit' scope)`,
          )
        }
        const result = await tool.run({ env, userId, via: 'mcp' }, args as Record<string, unknown>)
        return {
          content: [{ type: 'text', text: result.summary }],
          structuredContent: result.data,
        }
      },
    })
  }

  return server
}

/** Handle one MCP HTTP request for an already-authenticated user + their key scopes. */
export function handleMcpRequest(
  env: Env,
  userId: string,
  scopes: string[],
  request: Request,
): Promise<Response> {
  const transport = new StreamableHttpTransport()
  const handler = transport.bind(buildMcpServer(env, userId, scopes))
  return handler(request)
}
