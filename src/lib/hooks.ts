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
import type { ItineraryItem } from './api'

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
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to add sample deck'),
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

/** Create a blank note and open it (deduped from deck/notes/home). */
export function useNewNote() {
  const navigate = useNavigate()
  const create = useCreateNote()
  return {
    isPending: create.isPending,
    run: async () => {
      try {
        const note = await create.mutateAsync({ title: 'Untitled', body: '' })
        navigate({ to: '/notes/$noteId', params: { noteId: note.id } })
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to create note')
      }
    },
  }
}
