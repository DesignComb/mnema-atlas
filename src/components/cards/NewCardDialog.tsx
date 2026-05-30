import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateCard, useDecks, useDeleteCard, useUpdateCard } from '@/lib/hooks'
import type { CardRow } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function NewCardDialog({
  open,
  onOpenChange,
  noteId,
  deckId,
  card,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  noteId?: string
  deckId?: string
  /** When provided, the dialog edits this card instead of creating one. */
  card?: CardRow
}) {
  const editing = !!card
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [deckSel, setDeckSel] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const createCard = useCreateCard()
  const updateCard = useUpdateCard()
  const deleteCard = useDeleteCard()
  const { data: decks } = useDecks()

  useEffect(() => {
    if (open) {
      setFront(card?.front ?? '')
      setBack(card?.back ?? '')
      setDeckSel(card?.deck_id ?? deckId ?? '')
      setConfirmDel(false)
    }
  }, [open, card, deckId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!front.trim() || !back.trim()) return
    try {
      if (editing && card) {
        await updateCard.mutateAsync({
          id: card.id,
          patch: { front: front.trim(), back: back.trim(), deck_id: deckSel || null },
        })
        toast.success('Flashcard updated')
      } else {
        await createCard.mutateAsync({ front: front.trim(), back: back.trim(), note_id: noteId, deck_id: deckSel || undefined })
        toast.success('Flashcard added — due now')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save card')
    }
  }

  async function remove() {
    if (!card) return
    if (!confirmDel) {
      setConfirmDel(true)
      return
    }
    try {
      await deleteCard.mutateAsync(card.id)
      toast.success('Flashcard deleted')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete card')
    }
  }

  const pending = createCard.isPending || updateCard.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit flashcard' : 'New flashcard'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Changes apply immediately; FSRS scheduling is preserved.'
              : 'It becomes due immediately and enters FSRS scheduling.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-deck">Deck</Label>
            <select
              id="card-deck"
              value={deckSel}
              onChange={(e) => setDeckSel(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand"
            >
              <option value="">No deck</option>
              {decks?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-front">Front</Label>
            <Textarea id="card-front" autoFocus value={front} onChange={(e) => setFront(e.target.value)} placeholder="Question / prompt" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-back">Back</Label>
            <Textarea id="card-back" value={back} onChange={(e) => setBack(e.target.value)} placeholder="Answer" />
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                onClick={remove}
                className={confirmDel ? 'text-destructive' : 'text-muted-foreground'}
              >
                <Trash2 className="size-4" /> {confirmDel ? 'Confirm delete' : 'Delete'}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="brand" disabled={pending || !front.trim() || !back.trim()}>
                {pending ? 'Saving…' : editing ? 'Save' : 'Add card'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
