import { z } from 'zod'

/**
 * Single source of truth for write-tool inputs.
 * Imported by BOTH the React app (form validation) and the Cloudflare Worker
 * (MCP tool args + REST body validation), so UI / MCP / REST cannot drift.
 *
 * Each schema maps 1:1 to a Postgres SECURITY DEFINER RPC in 0001_init.sql.
 */

export const linkType = z.enum(['reference', 'related', 'parent', 'child', 'elaborates'])
export type LinkType = z.infer<typeof linkType>

const uuid = z.string().uuid()
const title = z.string().trim().min(1, 'Title is required').max(300)

export const createNoteInput = z.object({
  title,
  body: z.string().max(100_000).default(''),
  deck_id: uuid.optional(),
})
export type CreateNoteInput = z.infer<typeof createNoteInput>

export const updateNoteInput = z.object({
  note_id: uuid,
  title: title.optional(),
  body: z.string().max(100_000).optional(),
  deck_id: uuid.optional(),
})
export type UpdateNoteInput = z.infer<typeof updateNoteInput>

export const getNoteInput = z.object({ note_id: uuid })

export const searchNotesInput = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(100).default(20),
})
export type SearchNotesInput = z.infer<typeof searchNotesInput>

export const createDeckInput = z.object({
  name: z.string().trim().min(1).max(120),
  parent_deck_id: uuid.optional(),
  description: z.string().max(2_000).optional(),
})
export type CreateDeckInput = z.infer<typeof createDeckInput>

const flashcardFace = z.string().trim().min(1).max(8_000)

export const createFlashcardInput = z.object({
  front: flashcardFace,
  back: flashcardFace,
  note_id: uuid.optional(),
  deck_id: uuid.optional(),
})
export type CreateFlashcardInput = z.infer<typeof createFlashcardInput>

export const createFlashcardsBulkInput = z.object({
  cards: z
    .array(
      z.object({
        front: flashcardFace,
        back: flashcardFace,
        note_id: uuid.optional(),
        deck_id: uuid.optional(),
      }),
    )
    .min(1)
    .max(200),
  deck_id: uuid.optional(),
})
export type CreateFlashcardsBulkInput = z.infer<typeof createFlashcardsBulkInput>

export const linkNotesInput = z.object({
  source_note_id: uuid,
  target_note_id: uuid,
  link_type: linkType.default('reference'),
  weight: z.number().min(0).max(10).default(1),
})
export type LinkNotesInput = z.infer<typeof linkNotesInput>

/** Human-readable descriptions reused as MCP tool descriptions. */
export const toolDescriptions = {
  create_note: 'Create a study note (markdown body). Returns the new note id.',
  update_note: 'Update an existing note’s title and/or body.',
  get_note: 'Fetch one note by id.',
  search_notes: 'Full-text search the user’s notes by keyword.',
  create_deck: 'Create a deck (folder) to organise notes and flashcards.',
  list_decks: 'List the user’s decks.',
  create_flashcard: 'Create one spaced-repetition flashcard (front/back). Schedulable immediately.',
  create_flashcards_bulk: 'Create many flashcards in one call.',
  link_notes: 'Create a typed link between two notes (feeds the knowledge graph).',
} as const
