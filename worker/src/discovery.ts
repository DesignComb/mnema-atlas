import { tools } from './tools'

/**
 * Machine-readable discovery document. Served (keyless) at GET / and
 * /.well-known/mnema so an agent can bootstrap before it even has a key.
 */
export function discoveryIndex(origin: string) {
  return {
    name: 'mnema-atlas',
    description:
      'A personal notes + assistant workspace that the user drives with THEIR OWN AI. ' +
      'Mnema does not host, bundle, or call any AI itself — you (an external assistant) connect via MCP or REST and act as a TOOL. ' +
      'The workspace is organized into spaces; choose tools by context (notes/cards → Study; trips → Travel; tasks/habits/reminders → Tasks; money/expenses/splitting bills → Money). ' +
      'More spaces may be added over time, so route by what the user is asking for, not a fixed list.',
    spaces: [
      {
        key: 'study',
        name: 'Study (Mnema Atlas)',
        about: 'Markdown notes, decks, spaced-repetition flashcards (FSRS), and a knowledge graph.',
        tools: 'create_note, update_note, search_notes, create_deck, create_flashcard, create_flashcards_bulk, link_notes, list_notes, list_cards, …',
      },
      {
        key: 'travel',
        name: 'Travel (Mnema Voyage)',
        about: 'Multi-day trips: days, activities, reservations, packing/to-do checklists. Shareable read-only.',
        tools: 'create_itinerary, create_trip_bulk, create_day, create_item, create_booking, create_checklist_item, set_item_status, …',
      },
      {
        key: 'tasks',
        name: 'Tasks (Mnema Tempo)',
        about: 'To-dos & lists, habits with streaks, a calendar with time-blocking, RRULE recurrence, and reminders.',
        tools: 'create_task, create_tasks_bulk, create_task_list, complete_task, set_recurrence, schedule_task, check_in, add_reminder, list_tasks, …',
      },
      {
        key: 'money',
        name: 'Money (Mnema Galleon)',
        about:
          'Ledgers, accounts & balances, categorised income/expense/transfers, monthly budgets, recurring transactions, and Splitwise-style bill-splitting with shared members and settle-up.',
        tools:
          'create_ledger, create_transaction, create_transfer, get_ledger_summary, set_budget, set_recurring_transaction, add_ledger_member, create_split_expense, get_balances, suggest_settlement, record_settlement, …',
      },
    ],
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
