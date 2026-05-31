import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateCard, useDecks, useDeleteCard, useUpdateCard } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
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
  const t = useT()

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
        toast.success(t('Flashcard updated', '已更新字卡'))
      } else {
        await createCard.mutateAsync({ front: front.trim(), back: back.trim(), note_id: noteId, deck_id: deckSel || undefined })
        toast.success(t('Flashcard added — due now', '已新增字卡 — 立即到期'))
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to save card', '儲存字卡失敗'))
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
      toast.success(t('Flashcard deleted', '已刪除字卡'))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to delete card', '刪除字卡失敗'))
    }
  }

  const pending = createCard.isPending || updateCard.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t('Edit flashcard', '編輯字卡') : t('New flashcard', '新增字卡')}</DialogTitle>
          <DialogDescription>
            {editing
              ? t('Changes apply immediately; FSRS scheduling is preserved.', '變更立即生效；FSRS 排程會保留。')
              : t('It becomes due immediately and enters FSRS scheduling.', '字卡會立即到期並進入 FSRS 排程。')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-deck">{t('Deck', '牌組')}</Label>
            <select
              id="card-deck"
              value={deckSel}
              onChange={(e) => setDeckSel(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand"
            >
              <option value="">{t('No deck', '無牌組')}</option>
              {decks?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-front">{t('Front', '正面')}</Label>
            <Textarea id="card-front" autoFocus value={front} onChange={(e) => setFront(e.target.value)} placeholder={t('Question / prompt', '問題 / 提示')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-back">{t('Back', '背面')}</Label>
            <Textarea id="card-back" value={back} onChange={(e) => setBack(e.target.value)} placeholder={t('Answer', '答案')} />
          </div>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                onClick={remove}
                className={confirmDel ? 'text-destructive' : 'text-muted-foreground'}
              >
                <Trash2 className="size-4" /> {confirmDel ? t('Confirm delete', '確認刪除') : t('Delete', '刪除')}
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}
            <div className="flex gap-2 sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
                {t('Cancel', '取消')}
              </Button>
              <Button type="submit" variant="brand" disabled={pending || !front.trim() || !back.trim()} className="flex-1 sm:flex-none">
                {pending ? t('Saving…', '儲存中…') : editing ? t('Save', '儲存') : t('Add card', '新增字卡')}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
