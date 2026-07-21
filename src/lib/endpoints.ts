/**
 * Single source of truth for the AI Worker's public endpoints, surfaced in the
 * UI (Settings → API keys / Connect). Derived from the build-time env so dev
 * points at localhost and prod at https://mnema-ai.dco.tw.
 */
const fromEnv = (import.meta.env.VITE_MCP_URL as string | undefined)?.replace(/\/mcp\/?$/, '')
const fromRest = (import.meta.env.VITE_REST_URL as string | undefined)?.replace(/\/rest\/?$/, '')

/**
 * e.g. https://your-worker.example.com — derived from VITE_MCP_URL / VITE_REST_URL.
 * Deliberately NO hardcoded fallback: a self-hoster who forgets to set these must
 * NOT silently point their app at the original maintainer's Worker. Empty → the
 * "Connect an AI" URLs render blank (an obvious "configure me"), not someone else's server.
 */
export const WORKER_BASE = fromEnv || fromRest || ''

if (!WORKER_BASE && typeof console !== 'undefined') {
  console.warn(
    '[mnema] VITE_MCP_URL / VITE_REST_URL are not set — AI connector URLs will be blank. Point them at your deployed Worker (see docs/SELF_HOST.md).',
  )
}

export const MCP_URL = (import.meta.env.VITE_MCP_URL as string | undefined) || (WORKER_BASE ? `${WORKER_BASE}/mcp` : '')
export const REST_URL = (import.meta.env.VITE_REST_URL as string | undefined) || (WORKER_BASE ? `${WORKER_BASE}/rest` : '')
export const ASSISTANT_URL = WORKER_BASE ? `${WORKER_BASE}/assistant` : ''
export const OPENAPI_URL = WORKER_BASE ? `${WORKER_BASE}/openapi.json` : ''
export const LLMS_URL = WORKER_BASE ? `${WORKER_BASE}/llms.txt` : ''
