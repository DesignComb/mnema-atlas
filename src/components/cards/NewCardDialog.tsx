import { useState } from 'react'
import { toast } from 'sonner'
import { useCreateCard } from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function NewCardDialog({
  open,
  onOpenChange,
  noteId,
  deckId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  noteId?: string
  deckId?: string
}) {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const createCard = useCreateCard()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!front.trim() || !back.trim()) return
    try {
      await createCard.mutateAsync({
        front: front.trim(),
        back: back.trim(),
        note_id: noteId,
        deck_id: deckId,
      })
      toast.success('Flashcard added — due now')
      setFront('')
      setBack('')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create card')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New flashcard</DialogTitle>
          <DialogDescription>It becomes due immediately and enters FSRS scheduling.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-front">Front</Label>
            <Textarea
              id="card-front"
              autoFocus
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="Question / prompt"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-back">Back</Label>
            <Textarea
              id="card-back"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="Answer"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={createCard.isPending || !front.trim() || !back.trim()}>
              {createCard.isPending ? 'Adding…' : 'Add card'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
