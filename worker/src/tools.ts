import { z } from 'zod'
import {
  createDeckInput,
  createFlashcardInput,
  createFlashcardsBulkInput,
  createNoteInput,
  getNoteInput,
  linkNotesInput,
  searchNotesInput,
  toolDescriptions,
  updateNoteInput,
} from '../../shared/schemas'
import { callRpc, ownedSelect, serviceClient } from './db'
import type { ToolContext } from './env'

export interface ToolResult {
  summary: string
  data: unknown
}

export interface ToolDef {
  name: string
  description: string
  schema: z.ZodTypeAny
  readOnly: boolean
  /** Scope a key must carry to call this tool. Undefined ⇒ any valid key (add-only). */
  requiresScope?: 'edit'
  run: (ctx: ToolContext, args: Record<string, unknown>) => Promise<ToolResult>
}

const noArgs = z.object({})

/**
 * One registry, consumed by BOTH the MCP server and the REST routes. Every entry
 * calls a shared SECURITY DEFINER RPC (or an owner-scoped read) — no tool ever
 * touches a table directly, so AI-added content is identical to UI-added content.
 */
export const tools: ToolDef[] = [
  {
    name: 'create_note',
    description: toolDescriptions.create_note,
    schema: createNoteInput,
    readOnly: false,
    run: async (ctx, a) => {
      const note = await callRpc<{ id: string; title: string }>(ctx.env, ctx.userId, 'create_note', {
        p_title: a.title,
        p_body: a.body ?? '',
        p_deck_id: a.deck_id ?? null,
        p_created_via: ctx.via,
      })
      return { summary: `Created note “${note.title}” (${note.id})`, data: note }
    },
  },
  {
    name: 'update_note',
    description: toolDescriptions.update_note,
    schema: updateNoteInput,
    readOnly: false,
    requiresScope: 'edit', // mutates existing content — add-only keys may not call this
    run: async (ctx, a) => {
      const note = await callRpc<{ id: string; title: string }>(ctx.env, ctx.userId, 'update_note', {
        p_note_id: a.note_id,
        p_title: a.title ?? null,
        p_body: a.body ?? null,
        p_deck_id: a.deck_id ?? null,
      })
      return { summary: `Updated note “${note.title}”`, data: note }
    },
  },
  {
    name: 'get_note',
    description: toolDescriptions.get_note,
    schema: getNoteInput,
    readOnly: true,
    run: async (ctx, a) => {
      const { data, error } = await serviceClient(ctx.env)
        .from('notes')
        .select('id, title, body, deck_id, updated_at')
        .eq('user_id', ctx.userId)
        .eq('id', a.note_id as string)
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) throw new Error('note not found')
      return { summary: `Note “${(data as { title: string }).title}”`, data }
    },
  },
  {
    name: 'search_notes',
    description: toolDescriptions.search_notes,
    schema: searchNotesInput,
    readOnly: true,
    run: async (ctx, a) => {
      const notes = await callRpc<unknown[]>(ctx.env, ctx.userId, 'search_notes', {
        p_query: a.query,
        p_limit: a.limit ?? 20,
      })
      return { summary: `${notes.length} note(s) matched`, data: notes }
    },
  },
  {
    name: 'create_deck',
    description: toolDescriptions.create_deck,
    schema: createDeckInput,
    readOnly: false,
    run: async (ctx, a) => {
      const deck = await callRpc<{ id: string; name: string }>(ctx.env, ctx.userId, 'create_deck', {
        p_name: a.name,
        p_parent_deck_id: a.parent_deck_id ?? null,
        p_description: a.description ?? null,
      })
      return { summary: `Created deck “${deck.name}” (${deck.id})`, data: deck }
    },
  },
  {
    name: 'list_decks',
    description: toolDescriptions.list_decks,
    schema: noArgs,
    readOnly: true,
    run: async (ctx) => {
      const decks = await ownedSelect(ctx.env, ctx.userId, 'decks', 'id, name, description, parent_deck_id')
      return { summary: `${decks.length} deck(s)`, data: decks }
    },
  },
  {
    name: 'create_flashcard',
    description: toolDescriptions.create_flashcard,
    schema: createFlashcardInput,
    readOnly: false,
    run: async (ctx, a) => {
      const card = await callRpc<{ id: string }>(ctx.env, ctx.userId, 'create_card', {
        p_front: a.front,
        p_back: a.back,
        p_note_id: a.note_id ?? null,
        p_deck_id: a.deck_id ?? null,
        p_created_via: ctx.via,
      })
      return { summary: `Created flashcard (${card.id}) — due now`, data: card }
    },
  },
  {
    name: 'create_flashcards_bulk',
    description: toolDescriptions.create_flashcards_bulk,
    schema: createFlashcardsBulkInput,
    readOnly: false,
    run: async (ctx, a) => {
      const cards = await callRpc<unknown[]>(ctx.env, ctx.userId, 'create_flashcards_bulk', {
        p_cards: a.cards,
        p_deck_id: a.deck_id ?? null,
        p_created_via: ctx.via,
      })
      return { summary: `Created ${cards.length} flashcards`, data: cards }
    },
  },
  {
    name: 'link_notes',
    description: toolDescriptions.link_notes,
    schema: linkNotesInput,
    readOnly: false,
    run: async (ctx, a) => {
      const link = await callRpc(ctx.env, ctx.userId, 'link_notes', {
        p_source_note_id: a.source_note_id,
        p_target_note_id: a.target_note_id,
        p_link_type: a.link_type ?? 'reference',
        p_weight: a.weight ?? 1,
      })
      return { summary: `Linked notes (${a.link_type ?? 'reference'})`, data: link }
    },
  },
]

export const toolByName = new Map(tools.map((t) => [t.name, t]))

/**
 * Add-only keys lack the 'edit' scope, so they can create + read but never call
 * a mutating tool. Returns true if a key with `scopes` may run `tool`.
 */
export function toolAllowed(tool: ToolDef, scopes: string[]): boolean {
  return tool.requiresScope ? scopes.includes(tool.requiresScope) : true
}
