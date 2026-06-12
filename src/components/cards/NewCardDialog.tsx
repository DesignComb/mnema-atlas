import { humanizeError } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCards, useCreateCard, useDecks, useDeleteCard, useNotes, useSetCardTags, useUpdateCard } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import type { CardRow } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { removeUploadedImage } from '@/lib/upload'
import { TagInput } from '@/components/editor/TagInput'
import { ImageUpload } from './ImageUpload'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ExpanderSection } from '@/components/ui/expander-section'

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
  const [tags, setTags] = useState<string[]>([])
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const createCard = useCreateCard()
  const updateCard = useUpdateCard()
  const deleteCard = useDeleteCard()
  const setCardTags = useSetCardTags()
  const { data: decks } = useDecks()
  const { data: notes } = useNotes()
  const { data: allCards } = useCards()
  const t = useT()

  // Tag suggestions = every tag already used on a note or card.
  const tagSuggestions = Array.from(
    new Set([...(notes ?? []).flatMap((n) => n.tags ?? []), ...(allCards ?? []).flatMap((c) => c.tags ?? [])]),
  ).sort()
  const notesRef = useRef(notes)
  notesRef.current = notes

  useEffect(() => {
    if (open) {
      setFront(card?.front ?? '')
      setBack(card?.back ?? '')
      setDeckSel(card?.deck_id ?? deckId ?? '')
      // New cards inherit their source note's tags as a sensible default.
      setTags(card?.tags ?? (noteId ? notesRef.current?.find((n) => n.id === noteId)?.tags ?? [] : []))
      setImageUrl(card?.image_url ?? null)
      setConfirmDel(false)
    }
  }, [open, card, deckId, noteId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!front.trim() || !back.trim()) return
    try {
      if (editing && card) {
        await updateCard.mutateAsync({
          id: card.id,
          patch: { front: front.trim(), back: back.trim(), deck_id: deckSel || null, image_url: imageUrl ?? '' },
        })
        await setCardTags.mutateAsync({ cardId: card.id, tags })
        toast.success(t('Flashcard updated', '已更新字卡'))
      } else {
        const created = await createCard.mutateAsync({
          front: front.trim(),
          back: back.trim(),
          note_id: noteId,
          deck_id: deckSel || undefined,
          image_url: imageUrl ?? undefined,
        })
        if (tags.length) await setCardTags.mutateAsync({ cardId: created.id, tags })
        toast.success(t('Flashcard added — due now', '已新增字卡 — 立即到期'))
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(humanizeError(err, ['Failed to save card', '儲存字卡失敗']))
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
      // Best-effort storage cleanup — card deletes are immediate (no undo window).
      if (card.image_url) void removeUploadedImage(card.image_url)
      toast.success(t('Flashcard deleted', '已刪除字卡'))
      onOpenChange(false)
    } catch (err) {
      toast.error(humanizeError(err, ['Failed to delete card', '刪除字卡失敗']))
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
          <div className="flex flex-col gap-1.5">
            <Label>{t('Image', '圖片')}</Label>
            <ImageUpload value={imageUrl} onChange={setImageUrl} />
          </div>
          {/* Tags — auto-open when the card (or its source note, whose tags new cards inherit) already has some. */}
          <ExpanderSection
            label={t('Tags', '標籤')}
            filledCount={tags.length}
            defaultOpen={Boolean(
              card?.tags?.length || (noteId && (notes?.find((n) => n.id === noteId)?.tags?.length ?? 0) > 0),
            )}
          >
            <div className="rounded-lg border border-border bg-card px-2.5 py-2">
              <TagInput tags={tags} onChange={setTags} suggestions={tagSuggestions} listId="mnema-card-tags" />
            </div>
          </ExpanderSection>
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
