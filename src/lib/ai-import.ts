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
  /** 3–4 short bullets: what a connected AI can add in THIS Space. Shown in the
   *  dialog so the user knows the scope before they ask. */
  capabilitiesEn: string[]
  capabilitiesZh: string[]
  /** 2–3 natural example requests, shown as "try asking" chips in the dialog and
   *  embedded in the copied prompt so the AI has a concrete pattern. First is the
   *  primary example. */
  examplesEn: string[]
  examplesZh: string[]
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
    capabilitiesEn: [
      'Draft notes from anything you paste',
      'Generate flashcards (question ⇄ answer)',
      'Group them into a named deck',
      'Link related notes together',
    ],
    capabilitiesZh: [
      '把你貼上的任何內容整理成筆記',
      '產生閃卡（問題 ⇄ 答案）',
      '整理成一個命名牌組',
      '把相關筆記互相連結',
    ],
    examplesEn: [
      'Make 20 flashcards about the French Revolution',
      'Turn these lecture notes into a deck with cards',
      'Summarize this article into notes I can review',
    ],
    examplesZh: [
      '幫我做 20 張關於法國大革命的閃卡',
      '把這份上課筆記變成一個含閃卡的牌組',
      '把這篇文章整理成我可以複習的筆記',
    ],
  },
  tempo: {
    space: 'tempo',
    mode: 'rest',
    thingEn: 'tasks',
    thingZh: '任務',
    tools: ['create_tasks_bulk', 'create_task', 'create_task_list', 'create_capture'],
    capabilitiesEn: [
      'Add many tasks at once',
      'Sort them into lists',
      'Set due dates, reminders & repeats',
      'Capture quick ideas to sort later',
    ],
    capabilitiesZh: [
      '一次新增多項任務',
      '分類到不同清單',
      '設定截止日、提醒與重複',
      '暫存靈感，之後再整理',
    ],
    examplesEn: [
      'Add these 12 tasks to my work list',
      'Turn this meeting note into action items',
      'Remind me to pay rent on the 1st every month',
    ],
    examplesZh: [
      '把這 12 項任務加到我的工作清單',
      '把這則會議記錄變成待辦事項',
      '每月 1 號提醒我繳房租',
    ],
  },
  galleon: {
    space: 'galleon',
    mode: 'rest',
    thingEn: 'transactions',
    thingZh: '帳目',
    tools: ['create_transactions_bulk', 'create_transaction', 'create_account', 'create_category'],
    capabilitiesEn: [
      'Log expenses & income in bulk',
      'Read a whole receipt into entries',
      'Create accounts & categories',
      'Keep running balances up to date',
    ],
    capabilitiesZh: [
      '批次記錄支出與收入',
      '把整張收據拆成一筆筆帳目',
      '建立帳戶與分類',
      '即時更新各帳戶結餘',
    ],
    examplesEn: [
      'Log these 8 expenses from my receipt',
      'Add a $4.50 coffee under Food today',
      'Import last month’s expenses from this list',
    ],
    examplesZh: [
      '記錄我收據上的這 8 筆花費',
      '在「餐飲」記一筆今天 $4.50 的咖啡',
      '從這份清單匯入上個月的花費',
    ],
  },
  health: {
    space: 'health',
    mode: 'rest',
    thingEn: 'health logs',
    thingZh: '健康紀錄',
    tools: ['log_health', 'set_journal_entry', 'create_medication'],
    capabilitiesEn: [
      'Log vitals, weight & mood',
      'Add journal entries',
      'Track medications & doses',
    ],
    capabilitiesZh: [
      '記錄生命徵象、體重與心情',
      '新增日記',
      '追蹤用藥與劑量',
    ],
    examplesEn: [
      'Log my vitals and mood for the past week',
      'Record that I took my meds this morning',
      'Add a short journal entry about today',
    ],
    examplesZh: [
      '記錄我過去一週的健康指標與心情',
      '記錄我今天早上吃了藥',
      '幫今天寫一則簡短日記',
    ],
  },
  kitchen: {
    space: 'kitchen',
    mode: 'rest',
    thingEn: 'recipes & shopping items',
    thingZh: '食譜與採買項目',
    tools: ['add_shopping_items', 'create_recipe', 'add_pantry_item', 'set_meal_plan'],
    capabilitiesEn: [
      'Build a shopping list fast',
      'Save recipes with ingredients & steps',
      'Stock your pantry',
      'Plan the week’s meals',
    ],
    capabilitiesZh: [
      '快速建立購物清單',
      '儲存含食材與步驟的食譜',
      '整理你的庫存',
      '規劃一週菜單',
    ],
    examplesEn: [
      'Add these 15 ingredients to my shopping list',
      'Save this recipe for me',
      'Plan dinners for next week',
    ],
    examplesZh: [
      '把這 15 種食材加到我的購物清單',
      '幫我儲存這道食譜',
      '規劃下週的晚餐',
    ],
  },
  travel: {
    space: 'travel',
    mode: 'rest',
    thingEn: 'trips & itineraries',
    thingZh: '行程',
    tools: ['create_trip_bulk', 'create_itinerary', 'create_booking', 'create_checklist_bulk'],
    capabilitiesEn: [
      'Plan a multi-day itinerary',
      'Add flights, hotels & reservations',
      'Build a packing checklist',
      'Set a trip budget',
    ],
    capabilitiesZh: [
      '規劃多天行程',
      '新增航班、旅館與訂位',
      '建立打包清單',
      '設定行程預算',
    ],
    examplesEn: [
      'Plan a 5-day Tokyo trip with a daily itinerary, flights and hotels',
      'Add my flight and hotel confirmations',
      'Make a packing list for a 5-day winter trip',
    ],
    examplesZh: [
      '規劃 5 天東京行程，含每日行程、航班與旅館',
      '新增我的航班與旅館訂位',
      '幫 5 天冬季旅行做打包清單',
    ],
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
  const examples = cfg.examplesEn.map((e) => `"${e}"`).join(', ')
  lines.push(
    ``,
    `When I describe ${cfg.thingEn} (for example: ${examples}), look up the exact request body in the OpenAPI schema, then call the endpoint to create them. Afterwards, tell me exactly what you created.`,
  )
  return lines.join('\n')
}
