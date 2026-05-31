import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import * as api from './api'
import { seedSampleDeck } from './sampleDeck'
import type {
  CreateDeckInput,
  CreateFlashcardInput,
  CreateNoteInput,
  UpdateNoteInput,
} from '@shared/schemas'

export const qk = {
  decks: ['decks'] as const,
  notes: (deckId?: string) => ['notes', deckId ?? 'all'] as const,
  note: (id: string) => ['note', id] as const,
  cards: (deckId?: string) => ['cards', deckId ?? 'all'] as const,
  cardsByNote: (noteId: string) => ['cards-by-note', noteId] as const,
  due: (deckId?: string, tag?: string) => ['due', deckId ?? 'all', tag ?? 'all'] as const,
  graph: ['graph'] as const,
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
