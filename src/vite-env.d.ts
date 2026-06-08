/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  readonly VITE_MCP_URL?: string
  readonly VITE_REST_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Build version (YYYYMMDDHHmm) baked in by scripts/_build-web.mjs; "dev" locally. */
declare const __BUILD_VERSION__: string
