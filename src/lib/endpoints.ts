/**
 * Single source of truth for the AI Worker's public endpoints, surfaced in the
 * UI (Settings → API keys / Connect). Derived from the build-time env so dev
 * points at localhost and prod at https://mnema-ai.dco.tw.
 */
const fromEnv = (import.meta.env.VITE_MCP_URL as string | undefined)?.replace(/\/mcp\/?$/, '')
const fromRest = (import.meta.env.VITE_REST_URL as string | undefined)?.replace(/\/rest\/?$/, '')

/** e.g. https://mnema-ai.dco.tw */
export const WORKER_BASE = fromEnv || fromRest || 'https://mnema-ai.dco.tw'

export const MCP_URL = (import.meta.env.VITE_MCP_URL as string | undefined) || `${WORKER_BASE}/mcp`
export const REST_URL = (import.meta.env.VITE_REST_URL as string | undefined) || `${WORKER_BASE}/rest`
export const OPENAPI_URL = `${WORKER_BASE}/openapi.json`
export const LLMS_URL = `${WORKER_BASE}/llms.txt`
