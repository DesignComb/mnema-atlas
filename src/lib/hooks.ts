import { humanizeError, untitledLabel } from '@/lib/utils'
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import * as api from './api'
import { supabase } from './supabase'
import { seedSampleDeck } from './sampleDeck'
import type {
  CreateBookingInput,
  CreateChecklistInput,
  CreateDayInput,
  CreateDeckInput,
  CreateFlashcardInput,
  CreateItemInput,
  CreateItemsBulkInput,
  CreateItineraryInput,
  CreateNoteInput,
  CreateTripBulkInput,
  UpdateBookingInput,
  UpdateChecklistInput,
  UpdateDayInput,
  UpdateItemInput,
  UpdateItineraryInput,
  UpdateNoteInput,
} from '@shared/schemas'
import type {
  AddReminderInput,
  CreateCaptureInput,
  ResolveCaptureInput,
  CreateTaskInput,
  CreateTaskListInput,
  CreateTasksBulkInput,
  ScheduleTaskInput,
  SetRecurrenceInput,
  UpdateTaskInput,
  UpdateTaskListInput,
} from '@shared/schemas'
import type { ItineraryItem, TaskFilters, TxnFilters } from './api'
import type { LayoutSection } from './today'
import type {
  CreateAccountInput,
  CreateCategoryInput,
  CreateLedgerInput,
  CreateSplitExpenseInput,
  CreateTransactionInput,
  CreateTransactionsBulkInput,
  CreateTransferInput,
  RecordSettlementInput,
  SetBudgetInput,
  SetRecurringTransactionInput,
  UpdateAccountInput,
  UpdateCategoryInput,
  UpdateLedgerInput,
  UpdateTransactionInput,
  SetSubscriptionInput,
} from '@shared/schemas'
import type {
  SetHealthSettingsInput,
  LogHealthInput,
  UpdateHealthLogInput,
  SetJournalEntryInput,
  CreateMedicationInput,
  UpdateMedicationInput,
} from '@shared/schemas'
import type {
  CreateRecipeInput,
  UpdateRecipeInput,
  AddPantryItemInput,
  UpdatePantryItemInput,
  AddShoppingItemsInput,
  UpdateShoppingItemInput,
  SetMealPlanInput,
} from '@shared/schemas'

export const qk = {
  decks: ['decks'] as const,
  notes: (deckId?: string) => ['notes', deckId ?? 'all'] as const,
  note: (id: string) => ['note', id] as const,
  cards: (deckId?: string) => ['cards', deckId ?? 'all'] as const,
  cardsByNote: (noteId: string) => ['cards-by-note', noteId] as const,
  due: (deckId?: string, tag?: string) => ['due', deckId ?? 'all', tag ?? 'all'] as const,
  graph: ['graph'] as const,
  itineraries: ['itineraries'] as const,
  itinerary: (id: string) => ['itinerary', id] as const,
  shareLinks: (itineraryId: string) => ['share-links', itineraryId] as const,
  members: (itineraryId: string) => ['members', itineraryId] as const,
  // Mnema Tempo
  taskLists: ['task-lists'] as const,
  tasks: (listId?: string, status?: string) => ['tasks', listId ?? 'all', status ?? 'todo'] as const,
  task: (id: string) => ['task', id] as const,
  habit: (id: string) => ['habit', id] as const,
  streak: (id: string) => ['streak', id] as const,
  recurringSuggestions: ['recurring-suggestions'] as const,
  captures: (status?: string) => ['captures', status ?? 'pending'] as const,
  // Mnema Vitals (health)
  healthSettings: ['health-settings'] as const,
  healthLogs: (key?: string) => ['health-logs', key ?? 'all'] as const,
  journalEntries: (key?: string) => ['journal-entries', key ?? 'all'] as const,
  journalEntry: (date: string) => ['journal-entry', date] as const,
  medications: (activeOnly?: boolean) => ['medications', activeOnly ? 'active' : 'all'] as const,
  reviewPrefs: ['review-prefs'] as const,
  digestPrefs: ['digest-prefs'] as const,
  // Mnema Kitchen
  recipes: (key?: string) => ['recipes', key ?? 'all'] as const,
  recipe: (id: string) => ['recipe', id] as const,
  pantry: ['pantry'] as const,
  shopping: ['shopping'] as const,
  mealPlans: (key?: string) => ['meal-plans', key ?? 'all'] as const,
  // Mnema Galleon
  ledgers: ['ledgers'] as const,
  ledger: (id: string) => ['ledger', id] as const,
  ledgerTxns: (ledgerId: string, key?: string) => ['ledger-txns', ledgerId, key ?? 'all'] as const,
  ledgerSummary: (ledgerId: string, key: string) => ['ledger-summary', ledgerId, key] as const,
  budgetStatus: (ledgerId: string, key: string) => ['budget-status', ledgerId, key] as const,
  recurring: (ledgerId: string) => ['recurring', ledgerId] as const,
  monthlyTrend: (ledgerId: string, months: number) => ['monthly-trend', ledgerId, months] as const,
  balances: (ledgerId: string) => ['ledger-balances', ledgerId] as const,
  settlements: (ledgerId: string) => ['ledger-settlements', ledgerId] as const,
  splitTxnIds: (ledgerId: string) => ['ledger-split-ids', ledgerId] as const,
  subscriptions: (ledgerId: string) => ['subscriptions', ledgerId] as const,
  upcomingSubscriptions: (ledgerId: string) => ['upcoming-subscriptions', ledgerId] as const,
  // Per-surface section order/visibility (Today customization)
  userLayout: ['user-layout'] as const,
}

export function useDecks() {
  return useQuery({ queryKey: qk.decks, queryFn: api.listDecks })
}

export function useNotes(deckId?: string) {
  return useQuery({ queryKey: qk.notes(deckId), queryFn: () => api.listNotes(deckId) })
}

export function useNote(id: string) {
  return useQuery({ queryKey: qk.note(id), queryFn: () => api.getNote(id), enabled: !!id })
}

export function useCards(deckId?: string) {
  return useQuery({ queryKey: qk.cards(deckId), queryFn: () => api.listCards(deckId) })
}

export function useDueCards(deckId?: string, tag?: string) {
  return useQuery({ queryKey: qk.due(deckId, tag), queryFn: () => api.listDueCards(deckId, tag) })
}

export function useCardsByNote(noteId: string) {
  return useQuery({
    queryKey: qk.cardsByNote(noteId),
    queryFn: () => api.listCardsByNote(noteId),
    enabled: !!noteId,
  })
}

export function useCreateDeck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDeckInput) => api.createDeck(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.decks }),
  })
}
export function useReorderDecks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => api.reorderDecks(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.decks }),
  })
}

export function useCreateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateNoteInput) => api.createNote(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      qc.invalidateQueries({ queryKey: qk.graph })
    },
  })
}

export function useUpdateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateNoteInput) => api.updateNote(input),
    onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      qc.invalidateQueries({ queryKey: qk.note(note.id) })
    },
  })
}

export function useCreateCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFlashcardInput) => api.createCard(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cards'] })
      qc.invalidateQueries({ queryKey: ['cards-by-note'] })
      qc.invalidateQueries({ queryKey: ['due'] })
    },
  })
}

/** Onboarding: seed the sample deck, then drop the user into a review. */
export function useSeedSample() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: seedSampleDeck,
    onSuccess: async ({ deckId }) => {
      await qc.invalidateQueries()
      toast.success('Sample deck added — try a review!')
      navigate({ to: '/study/$deckId', params: { deckId } })
    },
    onError: (e) => toast.error(humanizeError(e, ['Failed to add sample deck', '加入範例牌組失敗'])),
  })
}

export function useUpdateCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; patch: Parameters<typeof api.updateCard>[1] }) => api.updateCard(v.id, v.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cards'] })
      qc.invalidateQueries({ queryKey: ['cards-by-note'] })
      qc.invalidateQueries({ queryKey: ['due'] })
    },
  })
}
export function useDeleteCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteCard(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cards'] })
      qc.invalidateQueries({ queryKey: ['cards-by-note'] })
      qc.invalidateQueries({ queryKey: ['due'] })
    },
  })
}
export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteNote(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      qc.invalidateQueries({ queryKey: qk.graph })
      qc.invalidateQueries({ queryKey: ['cards-by-note'] })
    },
  })
}
export function useDeleteDeck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteDeck(id),
    onSuccess: () => qc.invalidateQueries(),
  })
}

export function useUpdateDeck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; patch: Parameters<typeof api.updateDeck>[1] }) => api.updateDeck(v.id, v.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.decks }),
  })
}

/** Move a note to another deck (or out of all decks when deckId is null). */
export function useSetNoteDeck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { noteId: string; deckId: string | null }) => api.setNoteDeck(v.noteId, v.deckId),
    onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      qc.invalidateQueries({ queryKey: qk.note(note.id) })
      qc.invalidateQueries({ queryKey: ['cards'] })
      qc.invalidateQueries({ queryKey: qk.graph })
    },
  })
}

/** Set a flashcard's tags (enables study-by-tag). */
export function useSetCardTags() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { cardId: string; tags: string[] }) => api.setCardTags(v.cardId, v.tags),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cards'] })
      qc.invalidateQueries({ queryKey: ['cards-by-note'] })
      qc.invalidateQueries({ queryKey: ['due'] })
    },
  })
}

/** Set a note's tags (drives the graph's colours / clusters). */
export function useSetNoteTags() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { noteId: string; tags: string[] }) => api.setNoteTags(v.noteId, v.tags),
    onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      qc.invalidateQueries({ queryKey: qk.note(note.id) })
      qc.invalidateQueries({ queryKey: qk.graph })
    },
  })
}

/** Manual graph editing: create / remove an association between two notes. */
export function useLinkNotes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof api.linkNotes>[0]) => api.linkNotes(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.graph }),
  })
}
export function useUnlinkNotes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { a: string; b: string }) => api.unlinkNotes(v.a, v.b),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.graph }),
  })
}

// ── Itineraries (travel trips) ────────────────────────────────────
export function useItineraries() {
  return useQuery({ queryKey: qk.itineraries, queryFn: api.listItineraries })
}
export function useItinerary(id: string) {
  return useQuery({ queryKey: qk.itinerary(id), queryFn: () => api.getItinerary(id), enabled: !!id })
}

/** Day/item edits touch one trip's tree; refetch any open tree + the list. */
function bumpTrips(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['itinerary'] })
  qc.invalidateQueries({ queryKey: ['itineraries'] })
}

export function useCreateItinerary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateItineraryInput) => api.createItinerary(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.itineraries }),
  })
}
export function useUpdateItinerary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateItineraryInput) => api.updateItinerary(input),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: qk.itineraries })
      qc.invalidateQueries({ queryKey: qk.itinerary(row.id) })
    },
  })
}
export function useDeleteItinerary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteItinerary(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.itineraries }),
  })
}

export function useCreateDay() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: CreateDayInput) => api.createDay(input), onSuccess: () => bumpTrips(qc) })
}
export function useUpdateDay() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: UpdateDayInput) => api.updateDay(input), onSuccess: () => bumpTrips(qc) })
}
export function useDeleteDay() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteDay(id), onSuccess: () => bumpTrips(qc) })
}
export function useReorderDays() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { itineraryId: string; dayIds: string[] }) => api.reorderDays(v.itineraryId, v.dayIds),
    onSuccess: () => bumpTrips(qc),
  })
}

export function useCreateItem() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: CreateItemInput) => api.createItem(input), onSuccess: () => bumpTrips(qc) })
}
export function useUpdateItem() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: UpdateItemInput) => api.updateItem(input), onSuccess: () => bumpTrips(qc) })
}
export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteItem(id), onSuccess: () => bumpTrips(qc) })
}
export function useSetItemDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { itemId: string; dayId: string | null }) => api.setItemDay(v.itemId, v.dayId),
    onSuccess: () => bumpTrips(qc),
  })
}
export function useReorderItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { dayId: string | null; itemIds: string[] }) => api.reorderItems(v.dayId, v.itemIds),
    onSuccess: () => bumpTrips(qc),
  })
}
export function useCreateItemsBulk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateItemsBulkInput) => api.createItemsBulk(input),
    onSuccess: () => bumpTrips(qc),
  })
}
export function useSetItemStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { itemId: string; status: ItineraryItem['status'] }) => api.setItemStatus(v.itemId, v.status),
    onSuccess: () => bumpTrips(qc),
  })
}
export function useSetItemAssignees() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { itemId: string; assignees: string[] }) => api.setItemAssignees(v.itemId, v.assignees),
    onSuccess: () => bumpTrips(qc),
  })
}

// ── Reservations (bookings) ──
export function useCreateBooking() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: CreateBookingInput) => api.createBooking(input), onSuccess: () => bumpTrips(qc) })
}
export function useUpdateBooking() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: UpdateBookingInput) => api.updateBooking(input), onSuccess: () => bumpTrips(qc) })
}
export function useDeleteBooking() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteBooking(id), onSuccess: () => bumpTrips(qc) })
}

// ── Checklist (packing / to-dos) ──
export function useCreateChecklistItem() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: CreateChecklistInput) => api.createChecklistItem(input), onSuccess: () => bumpTrips(qc) })
}
export function useUpdateChecklistItem() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: UpdateChecklistInput) => api.updateChecklistItem(input), onSuccess: () => bumpTrips(qc) })
}
export function useDeleteChecklistItem() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteChecklistItem(id), onSuccess: () => bumpTrips(qc) })
}
export function useCreateTripBulk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTripBulkInput) => api.createTripBulk(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.itineraries }),
  })
}

export function useShareLinks(itineraryId: string) {
  return useQuery({
    queryKey: qk.shareLinks(itineraryId),
    queryFn: () => api.listShareLinks(itineraryId),
    enabled: !!itineraryId,
  })
}
export function useCreateShareLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { itineraryId: string; hideCosts?: boolean }) =>
      api.createShareLink(v.itineraryId, { hideCosts: v.hideCosts }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: qk.shareLinks(v.itineraryId) }),
  })
}
export function useRevokeShareLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; itineraryId: string }) => api.revokeShareLink(v.id),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: qk.shareLinks(v.itineraryId) }),
  })
}

export function useMembers(itineraryId: string, enabled = true) {
  return useQuery({
    queryKey: qk.members(itineraryId),
    queryFn: () => api.listMembers(itineraryId),
    enabled: !!itineraryId && enabled,
  })
}
export function useAddMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { itineraryId: string; email: string; role: 'viewer' | 'editor' }) =>
      api.addMember(v.itineraryId, v.email, v.role),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: qk.members(v.itineraryId) }),
  })
}
export function useRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { itineraryId: string; memberUserId: string }) =>
      api.removeMember(v.itineraryId, v.memberUserId),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: qk.members(v.itineraryId) }),
  })
}

/** Live-refresh an open trip when a collaborator edits it (best-effort realtime). */
export function useItineraryRealtime(itineraryId: string) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!itineraryId) return
    const refetch = () => qc.invalidateQueries({ queryKey: qk.itinerary(itineraryId) })
    const channel = supabase
      .channel(`itinerary-${itineraryId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'itinerary_items', filter: `itinerary_id=eq.${itineraryId}` },
        refetch,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'itinerary_days', filter: `itinerary_id=eq.${itineraryId}` },
        refetch,
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [itineraryId, qc])
}

// ════════════════════ Mnema Tempo (todos / habits / reminders) ════════════════════

/** Any task/list/habit edit invalidates the lists, task views, and any open detail. */
function bumpTasks(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['tasks'] })
  qc.invalidateQueries({ queryKey: ['task-lists'] })
  qc.invalidateQueries({ queryKey: ['task'] })
  qc.invalidateQueries({ queryKey: ['habit'] })
  qc.invalidateQueries({ queryKey: ['streak'] })
  qc.invalidateQueries({ queryKey: ['checkins'] })
}

export function useTaskLists() {
  return useQuery({ queryKey: qk.taskLists, queryFn: api.listTaskLists })
}
export function useTasks(filters: TaskFilters = {}) {
  return useQuery({ queryKey: qk.tasks(filters.listId, filters.status), queryFn: () => api.listTasks(filters) })
}
export function useTask(id: string) {
  return useQuery({ queryKey: qk.task(id), queryFn: () => api.getTask(id), enabled: !!id })
}
export function useHabit(id: string) {
  return useQuery({ queryKey: qk.habit(id), queryFn: () => api.getHabit(id), enabled: !!id })
}
export function useStreak(id: string) {
  return useQuery({ queryKey: qk.streak(id), queryFn: () => api.getStreak(id), enabled: !!id })
}
export function useRecurringSuggestions(enabled = true) {
  return useQuery({ queryKey: qk.recurringSuggestions, queryFn: () => api.suggestRecurringTasks(), enabled })
}

export function useCreateTaskList() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: CreateTaskListInput) => api.createTaskList(input), onSuccess: () => bumpTasks(qc) })
}
export function useUpdateTaskList() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: UpdateTaskListInput) => api.updateTaskList(input), onSuccess: () => bumpTasks(qc) })
}
export function useDeleteTaskList() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteTaskList(id), onSuccess: () => bumpTasks(qc) })
}
export function useReorderTaskLists() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (ids: string[]) => api.reorderTaskLists(ids), onSuccess: () => bumpTasks(qc) })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: CreateTaskInput) => api.createTask(input), onSuccess: () => bumpTasks(qc) })
}
export function useCreateTasksBulk() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: CreateTasksBulkInput) => api.createTasksBulk(input), onSuccess: () => bumpTasks(qc) })
}
export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: UpdateTaskInput) => api.updateTask(input), onSuccess: () => bumpTasks(qc) })
}
/**
 * Optimistically flip a task's status across every cached ['tasks', …] list
 * (QW2 — completion must feel instant). Returns the snapshots for rollback.
 */
function flipTaskStatus(qc: ReturnType<typeof useQueryClient>, taskId: string, status: 'done' | 'todo') {
  const snapshots = qc.getQueriesData<{ id: string; status: string }[]>({ queryKey: ['tasks'] })
  qc.setQueriesData<{ id: string; status: string }[]>({ queryKey: ['tasks'] }, (rows) =>
    rows?.map((r) => (r.id === taskId ? { ...r, status } : r)),
  )
  return snapshots
}
type TaskSnapshots = ReturnType<typeof flipTaskStatus>

function rollbackTasks(qc: ReturnType<typeof useQueryClient>, snapshots?: TaskSnapshots) {
  for (const [key, data] of snapshots ?? []) qc.setQueryData(key, data)
}

export function useCompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { taskId: string; nextOccurrence?: string; completedAt?: string }) =>
      api.completeTask(v.taskId, { nextOccurrence: v.nextOccurrence, completedAt: v.completedAt }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      return { snapshots: flipTaskStatus(qc, v.taskId, 'done') }
    },
    onError: (_e, _v, ctx) => rollbackTasks(qc, ctx?.snapshots),
    onSettled: () => bumpTasks(qc),
  })
}
export function useUncompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => api.uncompleteTask(taskId),
    onMutate: async (taskId) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      return { snapshots: flipTaskStatus(qc, taskId, 'todo') }
    },
    onError: (_e, _v, ctx) => rollbackTasks(qc, ctx?.snapshots),
    onSettled: () => bumpTasks(qc),
  })
}
export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (taskId: string) => api.deleteTask(taskId), onSuccess: () => bumpTasks(qc) })
}
export function useMoveTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { taskId: string; listId: string | null; parentId?: string | null }) =>
      api.moveTask(v.taskId, v.listId, v.parentId ?? null),
    onSuccess: () => bumpTasks(qc),
  })
}
export function useReorderTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { listId: string | null; taskIds: string[] }) => api.reorderTasks(v.listId, v.taskIds),
    onSuccess: () => bumpTasks(qc),
  })
}
export function useSetRecurrence() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: SetRecurrenceInput) => api.setRecurrence(input), onSuccess: () => bumpTasks(qc) })
}
export function useScheduleTask() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: ScheduleTaskInput) => api.scheduleTask(input), onSuccess: () => bumpTasks(qc) })
}
export function useSnoozeTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { taskId: string; until: string; untilTime?: string }) => api.snoozeTask(v.taskId, v.until, v.untilTime),
    onSuccess: () => bumpTasks(qc),
  })
}
export function useCheckIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { taskId: string; date?: string; note?: string }) => api.checkIn(v.taskId, v.date, v.note),
    onSuccess: () => bumpTasks(qc),
  })
}
export function useUncheckIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { taskId: string; date?: string }) => api.uncheckIn(v.taskId, v.date),
    onSuccess: () => bumpTasks(qc),
  })
}
/** Check-in / completion history for the calendar (inclusive date range, ISO strings). */
export function useCheckInsInRange(from: string, to: string, enabled = true) {
  return useQuery({ queryKey: ['checkins', from, to], queryFn: () => api.listCheckIns(from, to), enabled })
}
export function useAddReminder() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: AddReminderInput) => api.addReminder(input), onSuccess: () => bumpTasks(qc) })
}
export function useRemoveReminder() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (reminderId: string) => api.removeReminder(reminderId), onSuccess: () => bumpTasks(qc) })
}
export function useSetTaskUrl() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (v: { taskId: string; url: string }) => api.setTaskUrl(v.taskId, v.url), onSuccess: () => bumpTasks(qc) })
}

// ── Captures (quick-capture inbox / 暫存區) ──
function bumpCaptures(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['captures'] })
}
export function useCaptures(status: api.CaptureStatus | 'all' = 'pending') {
  return useQuery({ queryKey: qk.captures(status), queryFn: () => api.listCaptures(status) })
}
export function useCreateCapture() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: CreateCaptureInput) => api.createCapture(input), onSuccess: () => bumpCaptures(qc) })
}
export function useResolveCapture() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: ResolveCaptureInput) => api.resolveCapture(input), onSuccess: () => bumpCaptures(qc) })
}
export function useDismissCapture() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.dismissCapture(id), onSuccess: () => bumpCaptures(qc) })
}
export function useReopenCapture() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.reopenCapture(id), onSuccess: () => bumpCaptures(qc) })
}
export function useDeleteCapture() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteCapture(id), onSuccess: () => bumpCaptures(qc) })
}

// ════════════════════ Mnema Vitals (health) ════════════════════
function bumpHealth(qc: ReturnType<typeof useQueryClient>) {
  for (const k of ['health-logs', 'journal-entries', 'journal-entry', 'medications']) {
    qc.invalidateQueries({ queryKey: [k] })
  }
}

export function useHealthSettings() {
  return useQuery({ queryKey: qk.healthSettings, queryFn: api.getHealthSettings })
}
export function useSetHealthSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetHealthSettingsInput) => api.setHealthSettings(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.healthSettings }),
  })
}

export function useHealthLogs(filters: api.HealthLogFilters = {}) {
  const key = [filters.kind, filters.from, filters.to, filters.limit].join('|')
  return useQuery({ queryKey: qk.healthLogs(key), queryFn: () => api.listHealthLogs(filters) })
}
export function useLogHealth() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: LogHealthInput) => api.logHealth(input), onSuccess: () => bumpHealth(qc) })
}
export function useUpdateHealthLog() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: UpdateHealthLogInput) => api.updateHealthLog(input), onSuccess: () => bumpHealth(qc) })
}
export function useDeleteHealthLog() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteHealthLog(id), onSuccess: () => bumpHealth(qc) })
}

export function useJournalEntries(from?: string, to?: string) {
  return useQuery({ queryKey: qk.journalEntries(`${from ?? ''}_${to ?? ''}`), queryFn: () => api.listJournalEntries(from, to) })
}
export function useJournalEntry(date: string) {
  return useQuery({ queryKey: qk.journalEntry(date), queryFn: () => api.getJournalEntry(date), enabled: !!date })
}
export function useSetJournalEntry() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: SetJournalEntryInput) => api.setJournalEntry(input), onSuccess: () => bumpHealth(qc) })
}
export function useDeleteJournalEntry() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteJournalEntry(id), onSuccess: () => bumpHealth(qc) })
}

export function useMedications(activeOnly = false) {
  return useQuery({ queryKey: qk.medications(activeOnly), queryFn: () => api.listMedications(activeOnly) })
}
export function useCreateMedication() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: CreateMedicationInput) => api.createMedication(input), onSuccess: () => bumpHealth(qc) })
}
export function useUpdateMedication() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: UpdateMedicationInput) => api.updateMedication(input), onSuccess: () => bumpHealth(qc) })
}
export function useDeleteMedication() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteMedication(id), onSuccess: () => bumpHealth(qc) })
}

// Daily review (end-of-day) preferences
export function useReviewPrefs() {
  return useQuery({ queryKey: qk.reviewPrefs, queryFn: api.getReviewPrefs })
}
export function useSetReviewPrefs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (isEnabled: boolean) => api.setReviewPrefs(isEnabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.reviewPrefs }),
  })
}

// Daily to-do digest preferences
export function useDigestPrefs() {
  return useQuery({ queryKey: qk.digestPrefs, queryFn: api.getDigestPrefs })
}
export function useSetDigestPrefs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { isEnabled: boolean; time?: string; tz?: string }) => api.setDigestPrefs(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.digestPrefs }),
  })
}
export function useSetHabitReminderPref() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (enabled: boolean) => api.setHabitReminderPref(enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.digestPrefs }),
  })
}

// ════════════════════ Mnema Kitchen (recipes / pantry / shopping / meal plan) ════════════════════
function bumpKitchen(qc: ReturnType<typeof useQueryClient>) {
  for (const k of ['recipes', 'recipe', 'pantry', 'shopping', 'meal-plans']) {
    qc.invalidateQueries({ queryKey: [k] })
  }
}

export function useRecipes(query?: string, favoritesOnly = false) {
  return useQuery({ queryKey: qk.recipes(`${query ?? ''}_${favoritesOnly}`), queryFn: () => api.listRecipes(query, favoritesOnly) })
}
export function useRecipe(id: string) {
  return useQuery({ queryKey: qk.recipe(id), queryFn: () => api.getRecipe(id), enabled: !!id })
}
export function useCreateRecipe() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: CreateRecipeInput) => api.createRecipe(input), onSuccess: () => bumpKitchen(qc) })
}
export function useUpdateRecipe() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: UpdateRecipeInput) => api.updateRecipe(input), onSuccess: () => bumpKitchen(qc) })
}
export function useDeleteRecipe() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteRecipe(id), onSuccess: () => bumpKitchen(qc) })
}

export function usePantry() {
  return useQuery({ queryKey: qk.pantry, queryFn: api.listPantry })
}
export function useAddPantryItem() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: AddPantryItemInput) => api.addPantryItem(input), onSuccess: () => bumpKitchen(qc) })
}
export function useUpdatePantryItem() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: UpdatePantryItemInput) => api.updatePantryItem(input), onSuccess: () => bumpKitchen(qc) })
}
export function useDeletePantryItem() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deletePantryItem(id), onSuccess: () => bumpKitchen(qc) })
}

export function useShopping() {
  return useQuery({ queryKey: qk.shopping, queryFn: api.listShopping })
}
export function useAddShoppingItems() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: AddShoppingItemsInput) => api.addShoppingItems(input), onSuccess: () => bumpKitchen(qc) })
}
export function useUpdateShoppingItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateShoppingItemInput) => api.updateShoppingItem(input),
    // Optimistic: checking off groceries in the store must not wait on a round-trip (QW2).
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: qk.shopping })
      const prev = qc.getQueryData(qk.shopping)
      const { item_id, ...patch } = input
      qc.setQueryData<{ id: string }[]>(qk.shopping, (rows) =>
        rows?.map((r) => (r.id === item_id ? { ...r, ...patch } : r)),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(qk.shopping, ctx.prev)
    },
    onSettled: () => bumpKitchen(qc),
  })
}
export function useDeleteShoppingItem() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteShoppingItem(id), onSuccess: () => bumpKitchen(qc) })
}
export function useClearCheckedShopping() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: () => api.clearCheckedShopping(), onSuccess: () => bumpKitchen(qc) })
}

export function useMealPlans(from?: string, to?: string) {
  return useQuery({ queryKey: qk.mealPlans(`${from ?? ''}_${to ?? ''}`), queryFn: () => api.listMealPlans(from, to) })
}
export function useSetMealPlan() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: SetMealPlanInput) => api.setMealPlan(input), onSuccess: () => bumpKitchen(qc) })
}
export function useDeleteMealPlan() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteMealPlan(id), onSuccess: () => bumpKitchen(qc) })
}

// ════════════════════ Mnema Galleon (money) ════════════════════

function bumpGalleon(qc: ReturnType<typeof useQueryClient>) {
  for (const k of ['ledgers', 'ledger', 'ledger-txns', 'ledger-summary', 'budget-status', 'recurring', 'monthly-trend', 'ledger-balances', 'ledger-settlements', 'ledger-split-ids', 'subscriptions', 'upcoming-subscriptions']) {
    qc.invalidateQueries({ queryKey: [k] })
  }
}

export function useLedgers() {
  return useQuery({ queryKey: qk.ledgers, queryFn: api.listLedgers })
}
export function useLedger(id: string) {
  return useQuery({ queryKey: qk.ledger(id), queryFn: () => api.getLedger(id), enabled: !!id })
}
export function useLedgerTransactions(filters: TxnFilters) {
  const key = [filters.accountId, filters.categoryId, filters.type, filters.from, filters.to].join('|')
  return useQuery({
    queryKey: qk.ledgerTxns(filters.ledgerId, key),
    queryFn: () => api.listTransactions(filters),
    enabled: !!filters.ledgerId,
  })
}
export function useLedgerSummary(ledgerId: string, from: string, to: string) {
  return useQuery({
    queryKey: qk.ledgerSummary(ledgerId, `${from}_${to}`),
    queryFn: () => api.getLedgerSummary(ledgerId, from, to),
    enabled: !!ledgerId,
  })
}

export function useCreateLedger() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: CreateLedgerInput) => api.createLedger(input), onSuccess: () => bumpGalleon(qc) })
}
export function useUpdateLedger() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: UpdateLedgerInput) => api.updateLedger(input), onSuccess: () => bumpGalleon(qc) })
}
export function useDeleteLedger() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteLedger(id), onSuccess: () => bumpGalleon(qc) })
}
export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: CreateAccountInput) => api.createAccount(input), onSuccess: () => bumpGalleon(qc) })
}
export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: UpdateAccountInput) => api.updateAccount(input), onSuccess: () => bumpGalleon(qc) })
}
export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: string | { id: string; reassignTo?: string }) =>
      typeof v === 'string' ? api.deleteAccount(v) : api.deleteAccount(v.id, v.reassignTo),
    onSuccess: () => bumpGalleon(qc),
  })
}
export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: CreateCategoryInput) => api.createCategory(input), onSuccess: () => bumpGalleon(qc) })
}
export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: UpdateCategoryInput) => api.updateCategory(input), onSuccess: () => bumpGalleon(qc) })
}
export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteCategory(id), onSuccess: () => bumpGalleon(qc) })
}
export function useReorderAccounts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { ledgerId: string; accountIds: string[] }) => api.reorderAccounts(v.ledgerId, v.accountIds),
    onSuccess: () => bumpGalleon(qc),
  })
}
export function useReorderCategories() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { ledgerId: string; categoryIds: string[] }) => api.reorderCategories(v.ledgerId, v.categoryIds),
    onSuccess: () => bumpGalleon(qc),
  })
}
export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: CreateTransactionInput) => api.createTransaction(input), onSuccess: () => bumpGalleon(qc) })
}
export function useCreateTransactionsBulk() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: CreateTransactionsBulkInput) => api.createTransactionsBulk(input), onSuccess: () => bumpGalleon(qc) })
}
export function useUpdateTransaction() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: UpdateTransactionInput) => api.updateTransaction(input), onSuccess: () => bumpGalleon(qc) })
}
export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteTransaction(id), onSuccess: () => bumpGalleon(qc) })
}
export function useCreateTransfer() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: CreateTransferInput) => api.createTransfer(input), onSuccess: () => bumpGalleon(qc) })
}

export function useBudgetStatus(ledgerId: string, from: string, to: string) {
  return useQuery({
    queryKey: qk.budgetStatus(ledgerId, `${from}_${to}`),
    queryFn: () => api.getBudgetStatus(ledgerId, from, to),
    enabled: !!ledgerId,
  })
}
export function useRecurring(ledgerId: string) {
  return useQuery({ queryKey: qk.recurring(ledgerId), queryFn: () => api.listRecurring(ledgerId), enabled: !!ledgerId })
}
export function useMonthlyTrend(ledgerId: string, months = 6) {
  return useQuery({
    queryKey: qk.monthlyTrend(ledgerId, months),
    queryFn: () => api.getMonthlyTrend(ledgerId, months),
    enabled: !!ledgerId,
  })
}
export function useSetBudget() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: SetBudgetInput) => api.setBudget(input), onSuccess: () => bumpGalleon(qc) })
}
export function useDeleteBudget() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteBudget(id), onSuccess: () => bumpGalleon(qc) })
}
export function useSetRecurringTransaction() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: SetRecurringTransactionInput) => api.setRecurringTransaction(input), onSuccess: () => bumpGalleon(qc) })
}
export function useDeleteRecurringTransaction() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteRecurringTransaction(id), onSuccess: () => bumpGalleon(qc) })
}
export function useRunDueRecurring() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (ledgerId: string) => api.runDueRecurring(ledgerId), onSuccess: () => bumpGalleon(qc) })
}

// ── Members + splitting (P3) ──
export function useBalances(ledgerId: string) {
  return useQuery({ queryKey: qk.balances(ledgerId), queryFn: () => api.getBalances(ledgerId), enabled: !!ledgerId })
}
export function useSettlements(ledgerId: string) {
  return useQuery({ queryKey: qk.settlements(ledgerId), queryFn: () => api.listSettlements(ledgerId), enabled: !!ledgerId })
}
export function useSplitTxnIds(ledgerId: string) {
  return useQuery({ queryKey: qk.splitTxnIds(ledgerId), queryFn: () => api.listSplitTxnIds(ledgerId), enabled: !!ledgerId })
}
export function useAddLedgerMember() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: Parameters<typeof api.addLedgerMember>[0]) => api.addLedgerMember(input), onSuccess: () => bumpGalleon(qc) })
}
export function useUpdateLedgerMember() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: Parameters<typeof api.updateLedgerMember>[0]) => api.updateLedgerMember(input), onSuccess: () => bumpGalleon(qc) })
}
export function useRemoveLedgerMember() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.removeLedgerMember(id), onSuccess: () => bumpGalleon(qc) })
}
export function useCreateSplitExpense() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: CreateSplitExpenseInput) => api.createSplitExpense(input), onSuccess: () => bumpGalleon(qc) })
}
export function useRecordSettlement() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: RecordSettlementInput) => api.recordSettlement(input), onSuccess: () => bumpGalleon(qc) })
}
export function useDeleteSettlement() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteSettlement(id), onSuccess: () => bumpGalleon(qc) })
}

// Galleon: subscriptions
export function useSubscriptions(ledgerId: string) {
  return useQuery({ queryKey: qk.subscriptions(ledgerId), queryFn: () => api.listSubscriptions(ledgerId), enabled: !!ledgerId })
}
export function useUpcomingSubscriptions(ledgerId: string, daysAhead = 14) {
  return useQuery({
    queryKey: qk.upcomingSubscriptions(ledgerId),
    queryFn: () => api.getUpcomingSubscriptions(ledgerId, daysAhead),
    enabled: !!ledgerId,
  })
}
export function useSetSubscription() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: SetSubscriptionInput) => api.setSubscription(input), onSuccess: () => bumpGalleon(qc) })
}

// ════════════════════ User layout (Today customization) ════════════════════

export function useUserLayout() {
  return useQuery({ queryKey: qk.userLayout, queryFn: api.getUserLayout })
}

export function useSetUserLayout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { surface: string; sections: LayoutSection[] }) => api.setUserLayout(v.surface, v.sections),
    // Optimistic: reordering sections must feel instant (same rule as QW2).
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: qk.userLayout })
      const prev = qc.getQueryData<api.UserLayoutMap>(qk.userLayout)
      const next = { ...(prev ?? {}), [v.surface]: v.sections }
      qc.setQueryData(qk.userLayout, next)
      api.writeLayoutMirror(next)
      return { prev }
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(qk.userLayout, ctx.prev)
        api.writeLayoutMirror(ctx.prev)
      }
      toast.error(humanizeError(e, ['Failed to save layout', '版面儲存失敗']))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.userLayout }),
  })
}
export function useDeleteSubscription() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteSubscription(id), onSuccess: () => bumpGalleon(qc) })
}
export function usePostDueSubscriptions() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (ledgerId: string) => api.postDueSubscriptions(ledgerId), onSuccess: () => bumpGalleon(qc) })
}

// Reminders already surfaced this session (so the poll doesn't re-toast them).
const shownReminders = new Set<string>()

/** In-app reminder fallback: on load (and every 60s) toast any due reminders.
 *  Covers users who blocked push or aren't on an installed PWA. */
export function useDueReminders() {
  useEffect(() => {
    let cancelled = false
    async function run() {
      const nowIso = new Date().toISOString()
      const { data } = await supabase
        .from('task_reminders')
        .select('id, remind_at, tasks(title)')
        .eq('status', 'pending')
        .lte('remind_at', nowIso)
        .order('remind_at', { ascending: true })
        .limit(10)
      if (cancelled || !data) return
      for (const r of data as unknown as Array<{ id: string; tasks: { title: string } | null }>) {
        if (shownReminders.has(r.id)) continue
        shownReminders.add(r.id)
        toast(`⏰ ${r.tasks?.title ?? 'Reminder'}`)
      }
    }
    void run()
    const iv = setInterval(() => void run(), 60_000)
    return () => {
      cancelled = true
      clearInterval(iv)
    }
  }, [])
}

/** Create a blank note and open it (deduped from deck/notes/home). */
export function useNewNote() {
  const navigate = useNavigate()
  const create = useCreateNote()
  return {
    isPending: create.isPending,
    run: async () => {
      try {
        const note = await create.mutateAsync({ title: untitledLabel(), body: '' })
        navigate({ to: '/notes/$noteId', params: { noteId: note.id } })
      } catch (e) {
        toast.error(humanizeError(e, ['Failed to create note', '建立筆記失敗']))
      }
    },
  }
}
