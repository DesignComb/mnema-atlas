# Mnema Atlas Worker — MCP + REST

One Cloudflare Worker that lets external AI assistants add study content. Both transports validate
input with the **shared Zod schemas** (`../shared/schemas.ts`) and call the **shared Postgres RPCs**
via the Supabase secret key, so AI-added content is byte-identical to UI-added content.

```
src/index.ts   routes: POST /mcp · /rest/* · /healthz
src/tools.ts   the one tool registry consumed by BOTH transports
src/mcp.ts     stateless MCP server (mcp-lite, Streamable HTTP)
src/rest.ts    hono REST routes
src/auth.ts    Bearer API key → verify_api_key RPC → user_id
src/db.ts      service-role Supabase client + RPC calls
```

## Auth model

- The Worker holds `SUPABASE_SECRET_KEY` (service role, **bypasses RLS**). It is never the trust
  boundary — the **RPC is**: it stamps the *resolved* `user_id` and validates ownership.
- A caller proves identity with a per-owner **API key** (`Authorization: Bearer mk_…`). The Worker
  SHA-256-hashes it and calls `verify_api_key(hash)` → `user_id`.
- Works today with **Claude Code, Cursor, and the Claude API mcp-connector** (all accept a static Bearer).

## Tools exposed

All tools live in the one registry in `src/tools.ts` (notes/decks/cards, travel, tempo, money,
health, kitchen, …). The OpenAPI spec (`src/openapi.ts`) and `llms.txt` (`src/llms.ts`) are
generated from that registry, so they never go stale.

`GET /rest` lists them; `POST /rest/<tool>` runs one with a JSON body.

## Phase 3b — OAuth 2.1 for the claude.ai connector (not yet wired)

The claude.ai web/desktop **connector UI only accepts OAuth 2.1 + PKCE** (no API-key field). To
support it, wrap this app with [`@cloudflare/workers-oauth-provider`](https://github.com/cloudflare/workers-oauth-provider),
which implements OAuth 2.1 + PKCE + Dynamic Client Registration + RFC 8414/9728 metadata for you:

1. `npm i @cloudflare/workers-oauth-provider` and create a KV namespace; bind it as `OAUTH_KV`
   (uncomment the block in `wrangler.toml`).
2. Wrap the export:
   ```ts
   import { OAuthProvider } from '@cloudflare/workers-oauth-provider'
   export default new OAuthProvider({
     apiRoute: '/mcp',
     apiHandler: app,             // this hono app handles the authed MCP requests
     defaultHandler: loginUiApp,  // your sign-in screen that maps a Supabase user → grant
     authorizeEndpoint: '/authorize',
     tokenEndpoint: '/token',
     clientRegistrationEndpoint: '/register',
   })
   ```
   Inside `/mcp`, read the authenticated user from the provider's context instead of the API-key path.
3. Deploy, then add the `/mcp` URL as a custom connector in claude.ai and run the OAuth flow.

> **Test the full connect-and-call loop** against claude.ai — there is a known 2026 bug where it
> completes OAuth but drops the Bearer on later calls. Verify before relying on the consumer connector.

## Commands

```bash
npm run dev        # wrangler dev (uses .dev.vars)
npm run typecheck  # tsc --noEmit
npm run deploy     # wrangler deploy
```
