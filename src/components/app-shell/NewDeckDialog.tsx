import { useState } from 'react'
import { toast } from 'sonner'
import { useCreateDeck } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

export function NewDeckDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const createDeck = useCreateDeck()
  const t = useT()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await createDeck.mutateAsync({ name: name.trim(), description: description.trim() || undefined })
      toast.success(t(`Deck “${name.trim()}” created`, `已建立牌組「${name.trim()}」`))
      setName('')
      setDescription('')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to create deck', '建立牌組失敗'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('New deck', '新增牌組')}</DialogTitle>
          <DialogDescription>{t('A deck groups related notes and flashcards.', '牌組用來歸納相關的筆記與字卡。')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deck-name">{t('Name', '名稱')}</Label>
            <Input
              id="deck-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 日本語 N2 文法"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deck-desc">{t('Description (optional)', '說明（選填）')}</Label>
            <Textarea
              id="deck-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('What is this deck about?', '這個牌組是關於什麼的？')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('Cancel', '取消')}
            </Button>
            <Button type="submit" variant="brand" disabled={createDeck.isPending || !name.trim()}>
              {createDeck.isPending ? t('Creating…', '建立中…') : t('Create deck', '建立牌組')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
