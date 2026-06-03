import { tools } from './tools'

/**
 * llms.txt — a plain-text, AI-readable "how to use me" served at /llms.txt.
 * Generated from the tool registry so it stays in sync with the real tools.
 */
export function buildLlmsTxt(origin: string): string {
  return [
    '# Mnema',
    '',
    '> A personal notes + assistant workspace the user drives with THEIR OWN AI. Mnema does not',
    '> host or call any AI itself — you (an external assistant) connect via MCP or REST and act as',
    '> a TOOL, not a chatbot. Every write goes through one shared path and is scoped to the key',
    '> owner — a key can only ever add to its own data.',
    '',
    '## Spaces (pick tools by context)',
    'The workspace is split into sections. Choose where to act from what the user is asking for;',
    'more sections may be added over time, so route by intent rather than a fixed list.',
    '- Study (Mnema Atlas): markdown notes, decks, spaced-repetition flashcards (FSRS), knowledge graph.',
    '  Tools: create_note, update_note, search_notes, create_deck, create_flashcard(s), link_notes, list_notes, list_cards.',
    '- Travel (Mnema Voyage): multi-day trips — days, activities, reservations, packing/to-do checklists; shareable.',
    '  Tools: create_itinerary, create_trip_bulk, create_day, create_item, create_booking, create_checklist_item.',
    '- Tasks (Mnema Tempo): to-dos & lists, habits with streaks, calendar + time-blocking, RRULE recurrence, reminders.',
    '  Tools: create_task(s), create_task_list, complete_task, set_recurrence, schedule_task, check_in, add_reminder, list_tasks.',
    '- Money (Mnema Galleon): ledgers, accounts & balances, income/expense/transfers, budgets, recurring transactions,',
    '  and Splitwise-style bill-splitting — shared members, who-owes-whom balances, and settle-up.',
    '  Tools: create_ledger, create_transaction, create_transfer, get_ledger_summary, set_budget, set_recurring_transaction,',
    '  add_ledger_member, create_split_expense, get_balances, suggest_settlement, record_settlement.',
    '',
    '## Connect',
    `- MCP (Claude Code, Cursor): ${origin}/mcp  (header: Authorization: Bearer <mk_key>)`,
    `- REST: POST ${origin}/rest/<tool>  (header: Authorization: Bearer <mk_key>)`,
    `- OpenAPI (ChatGPT custom-GPT actions): ${origin}/openapi.json`,
    '',
    '## Keys',
    '- Mint a key in the app: Settings -> API keys.',
    '- Default keys are ADD-ONLY: they can create content across every space (notes, cards, trips,',
    '  tasks, …) and read, but cannot edit, complete, or delete. Full keys can also edit existing items.',
    '',
    '## Tools',
    ...tools.map(
      (t) => `- ${t.name}: ${t.description}${t.requiresScope ? ' [needs a FULL key]' : ''}`,
    ),
    '',
  ].join('\n')
}
