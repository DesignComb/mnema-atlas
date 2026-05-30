import * as api from './api'

/**
 * One-click onboarding: seed a tiny "Welcome" deck (1 note + 3 cards, all due
 * now) so a brand-new user lands straight in the review loop with zero typing.
 * Opt-in only — never auto-seeded.
 */
const SAMPLE = {
  deck: 'Welcome to Mnema',
  note: {
    title: 'How Mnema works',
    body:
      '## The loop\n\n1. **Capture** a note (or let an AI write one).\n2. Turn it into **flashcards**.\n3. **Review** what is due — spaced repetition (FSRS) schedules the rest so it sticks.\n\nDelete this sample deck whenever you like.',
  },
  cards: [
    {
      front: 'What does Mnema do for you?',
      back: 'Turns your notes into flashcards and schedules them with FSRS so you review each one at the right moment.',
    },
    {
      front: 'Besides you, who can add to your library?',
      back: 'Any AI you connect (Claude, ChatGPT, …). With an add-only key it can only add — never edit or delete.',
    },
    {
      front: 'How do you keep a card in long-term memory?',
      back: 'Review it when it is due and rate honestly (Again / Hard / Good / Easy). FSRS spaces the next review.',
    },
  ],
}

export async function seedSampleDeck(): Promise<{ deckId: string }> {
  const deck = await api.createDeck({ name: SAMPLE.deck, description: 'A 2-minute tour — review these, then delete it.' })
  const note = await api.createNote({ title: SAMPLE.note.title, body: SAMPLE.note.body, deck_id: deck.id })
  await api.createFlashcardsBulk(
    SAMPLE.cards.map((c) => ({ ...c, note_id: note.id, deck_id: deck.id })),
    deck.id,
  )
  return { deckId: deck.id }
}
