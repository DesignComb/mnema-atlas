import type { SpaceKey } from '@/components/app-shell/spaces'
import { brandTitleFor } from '@/components/app-shell/spaces'
import { REST_URL, OPENAPI_URL, LLMS_URL } from '@/lib/endpoints'

/**
 * Per-Space "Import from AI" config — the single source of truth for the
 * Space-aware QuickImportDialog. Two modes:
 *  - 'paste': the AI replies with a `mnema` block the app parses + writes
 *    client-side (Study only — notes & flashcards).
 *  - 'rest':  the AI writes directly through the Worker's REST API. The dialog
 *    hands the user a Space-specific prompt naming that Space's REST endpoints;
 *    there is no paste-back (the AI calls the API itself). This matches the
 *    BYO-AI architecture — the same write path the UI/MCP use.
 */
export type ImportMode = 'paste' | 'rest'

export interface SpaceImportConfig {
  space: SpaceKey
  mode: ImportMode
  /** Bilingual noun for what gets imported (e.g. "tasks" / "任務"). */
  thingEn: string
  thingZh: string
  /** REST tool names named in the copied prompt, primary (bulk) first. */
  tools: string[]
  /** One natural example request, embedded in the prompt + the dialog steps. */
  exampleEn: string
  exampleZh: string
}

// Tool names are verified against the Worker registry (worker/src/tools.ts).
// All of these are create/bulk tools — they work with an add-only API key
// (no `edit` scope needed), so a default key is enough to import.
export const SPACE_IMPORT: Record<SpaceKey, SpaceImportConfig> = {
  study: {
    space: 'study',
    mode: 'paste',
    thingEn: 'notes & flashcards',
    thingZh: '筆記與閃卡',
    tools: ['create_note', 'create_flashcards_bulk', 'create_deck', 'link_notes'],
    exampleEn: 'Make 20 flashcards about the French Revolution',
    exampleZh: '幫我做 20 張關於法國大革命的閃卡',
  },
  tempo: {
    space: 'tempo',
    mode: 'rest',
    thingEn: 'tasks',
    thingZh: '任務',
    tools: ['create_tasks_bulk', 'create_task', 'create_task_list', 'create_capture'],
    exampleEn: 'Add these 12 tasks to my work list',
    exampleZh: '把這 12 項任務加到我的工作清單',
  },
  galleon: {
    space: 'galleon',
    mode: 'rest',
    thingEn: 'transactions',
    thingZh: '帳目',
    tools: ['create_transactions_bulk', 'create_transaction', 'create_account', 'create_category'],
    exampleEn: 'Log these 8 expenses from my receipt',
    exampleZh: '記錄我收據上的這 8 筆花費',
  },
  health: {
    space: 'health',
    mode: 'rest',
    thingEn: 'health logs',
    thingZh: '健康紀錄',
    tools: ['log_health', 'set_journal_entry', 'create_medication'],
    exampleEn: 'Log my vitals and mood for the past week',
    exampleZh: '記錄我過去一週的健康指標與心情',
  },
  kitchen: {
    space: 'kitchen',
    mode: 'rest',
    thingEn: 'recipes & shopping items',
    thingZh: '食譜與採買項目',
    tools: ['add_shopping_items', 'create_recipe', 'add_pantry_item', 'set_meal_plan'],
    exampleEn: 'Add these 15 ingredients to my shopping list',
    exampleZh: '把這 15 種食材加到我的購物清單',
  },
  travel: {
    space: 'travel',
    mode: 'rest',
    thingEn: 'trips & itineraries',
    thingZh: '行程',
    tools: ['create_trip_bulk', 'create_itinerary', 'create_booking', 'create_checklist_bulk'],
    exampleEn: 'Plan a 5-day Tokyo trip with a daily itinerary, flights and hotels',
    exampleZh: '規劃 5 天東京行程，含每日行程、航班與旅館',
  },
}

// No hardcoded Worker fallback (mirrors endpoints.ts): a self-hoster who hasn't
// set VITE_REST_URL gets an obvious placeholder, never someone else's server.
const PLACEHOLDER_BASE = 'https://YOUR-WORKER.example.com'

/**
 * The English prompt a user copies and pastes into their own AI (ChatGPT /
 * Claude / Cursor) so it can write this Space's content over the REST API.
 * English on purpose — it's an instruction to a model, not user-facing chrome.
 */
export function buildRestPrompt(cfg: SpaceImportConfig): string {
  const restBase = REST_URL || `${PLACEHOLDER_BASE}/rest`
  const openapi = OPENAPI_URL || `${PLACEHOLDER_BASE}/openapi.json`
  const llms = LLMS_URL || `${PLACEHOLDER_BASE}/llms.txt`
  const brand = brandTitleFor(cfg.space)
  const [primary, ...others] = cfg.tools

  const lines = [
    `You can add ${cfg.thingEn} to my ${brand} (a space in the Mnema life-OS) through its REST API.`,
    ``,
    `• Base URL: ${restBase}`,
    `• Auth: every request needs the header  Authorization: Bearer <MY_API_KEY>  (I'll paste my key).`,
    `• Before calling, read the schema: GET ${openapi} (OpenAPI 3.1). A short index of every tool is at ${llms}.`,
    ``,
    `To import a whole batch in one call, POST JSON to:`,
    `  ${restBase}/${primary}`,
  ]
  if (others.length) {
    lines.push(`Other useful endpoints: ${others.map((tool) => `${restBase}/${tool}`).join(', ')}.`)
  }
  lines.push(
    ``,
    `When I describe ${cfg.thingEn} (for example: "${cfg.exampleEn}"), look up the exact request body in the OpenAPI schema, then call the endpoint to create them. Afterwards, tell me exactly what you created.`,
  )
  return lines.join('\n')
}
