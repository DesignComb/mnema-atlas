import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './api'
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
  due: (deckId?: string) => ['due', deckId ?? 'all'] as const,
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

export function useDueCards(deckId?: string) {
  return useQuery({ queryKey: qk.due(deckId), queryFn: () => api.listDueCards(deckId) })
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
