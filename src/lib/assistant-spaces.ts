import { SPACES, type SpaceKey } from '@/components/app-shell/spaces'

export type AssistantSpace = SpaceKey | 'capture'

// Keep these groups aligned with the authoritative Space banners in
// worker/src/tools.ts. This is intentionally frontend-only: the Worker result
// already includes the tool name, so no API or redeploy is needed for routing.
const STUDY_TOOLS = [
  'create_note', 'update_note', 'get_note', 'search_notes', 'create_deck', 'list_decks',
  'create_flashcard', 'create_flashcards_bulk', 'link_notes', 'list_notes', 'list_cards',
  'update_card', 'delete_card', 'delete_note', 'update_deck', 'delete_deck', 'set_deck_parent',
  'set_note_deck', 'set_note_starred', 'set_note_tags', 'set_card_tags', 'set_card_starred', 'unlink_notes',
] as const

const TRAVEL_TOOLS = [
  'list_itineraries', 'get_itinerary', 'create_itinerary', 'create_trip_bulk', 'update_itinerary',
  'delete_itinerary', 'create_day', 'update_day', 'delete_day', 'reorder_days', 'create_item',
  'create_items_bulk', 'update_item', 'delete_item', 'set_item_location', 'set_item_day', 'reorder_items',
  'set_item_status', 'set_item_assignees', 'set_item_tags', 'create_booking', 'create_bookings_bulk',
  'update_booking', 'delete_booking', 'create_checklist_item', 'create_checklist_bulk',
  'update_checklist_item', 'delete_checklist_item', 'list_share_links', 'create_share_link', 'revoke_share_link',
] as const

const TEMPO_TOOLS = [
  'create_task_list', 'update_task_list', 'delete_task_list', 'reorder_task_lists', 'list_task_lists',
  'create_task', 'create_tasks_bulk', 'update_task', 'complete_task', 'uncomplete_task', 'delete_task',
  'move_task', 'reorder_tasks', 'set_recurrence', 'schedule_task', 'snooze_task', 'check_in', 'uncheck_in',
  'add_reminder', 'remove_reminder', 'set_task_url', 'get_task', 'list_tasks', 'search_tasks', 'get_habit',
  'get_streak', 'suggest_recurring_tasks',
] as const

const CAPTURE_TOOLS = ['create_capture', 'list_captures', 'resolve_capture', 'dismiss_capture', 'reopen_capture', 'delete_capture'] as const
const HEALTH_TOOLS = [
  'log_health', 'update_health_log', 'delete_health_log', 'list_health_logs', 'set_journal_entry',
  'delete_journal_entry', 'list_journal_entries', 'create_medication', 'update_medication',
  'delete_medication', 'list_medications', 'set_health_settings', 'set_review_prefs',
] as const
const KITCHEN_TOOLS = [
  'create_recipe', 'update_recipe', 'delete_recipe', 'list_recipes', 'get_recipe', 'add_pantry_item',
  'update_pantry_item', 'delete_pantry_item', 'list_pantry', 'add_shopping_items', 'update_shopping_item',
  'delete_shopping_item', 'clear_checked_shopping', 'list_shopping', 'set_meal_plan', 'delete_meal_plan', 'list_meal_plans',
] as const
const GALLEON_TOOLS = [
  'create_ledger', 'update_ledger', 'delete_ledger', 'list_ledgers', 'get_ledger', 'create_account',
  'update_account', 'delete_account', 'create_category', 'update_category', 'delete_category',
  'create_transaction', 'create_transactions_bulk', 'create_transfer', 'update_transaction',
  'delete_transaction', 'list_transactions', 'search_transactions', 'get_ledger_summary', 'set_budget',
  'delete_budget', 'get_budget_status', 'set_recurring_transaction', 'delete_recurring_transaction',
  'get_monthly_trend', 'add_ledger_member', 'update_ledger_member', 'remove_ledger_member',
  'create_split_expense', 'set_transaction_splits', 'get_balances', 'suggest_settlement', 'record_settlement',
  'delete_settlement', 'list_ledger_members', 'list_settlements', 'list_recurring', 'get_transaction',
  'list_split_txn_ids', 'set_subscription', 'delete_subscription', 'list_subscriptions', 'get_upcoming_subscriptions',
] as const

const TOOL_SPACE: Record<string, AssistantSpace> = Object.fromEntries([
  ...STUDY_TOOLS.map((tool) => [tool, 'study']),
  ...TRAVEL_TOOLS.map((tool) => [tool, 'travel']),
  ...TEMPO_TOOLS.map((tool) => [tool, 'tempo']),
  ...CAPTURE_TOOLS.map((tool) => [tool, 'capture']),
  ...HEALTH_TOOLS.map((tool) => [tool, 'health']),
  ...KITCHEN_TOOLS.map((tool) => [tool, 'kitchen']),
  ...GALLEON_TOOLS.map((tool) => [tool, 'galleon']),
])

export function toolSpace(toolName: string): AssistantSpace {
  return TOOL_SPACE[toolName] ?? 'tempo'
}

export const SPACE_ROUTE = {
  ...Object.fromEntries(SPACES.map((space) => [space.key, space.to])),
  capture: '/tempo',
} as Record<AssistantSpace, string>

export function spaceMeta(space: AssistantSpace) {
  if (space === 'capture') return { key: space, to: SPACE_ROUTE.capture, icon: SPACES.find((item) => item.key === 'tempo')!.icon, en: 'Inbox', zh: '收件匣' }
  return SPACES.find((item) => item.key === space)!
}
