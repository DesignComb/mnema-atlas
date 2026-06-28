import { humanizeError } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useCreatePlace, useUpdatePlace } from '@/lib/hooks'
import { useI18n } from '@/lib/i18n'
import type { PlaceRow } from '@/lib/database.types'
import { TagInput } from '@/components/editor/TagInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** Create / edit a wishlist place (shop or sight) — mirrors RecipeDialog. */
export function PlaceDialog({
  open,
  onOpenChange,
  place,
  tagSuggestions = [],
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  place?: PlaceRow
  tagSuggestions?: string[]
}) {
  const { t } = useI18n()
  const editing = Boolean(place)
  const create = useCreatePlace()
  const update = useUpdatePlace()

  const [name, setName] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [url, setUrl] = useState('')
  const [address, setAddress] = useState('')
  const [visited, setVisited] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(place?.name ?? '')
    setTags(place?.tags ?? [])
    setNote(place?.note ?? '')
    setUrl(place?.url ?? '')
    setAddress(place?.address ?? '')
    setVisited(place?.visited ?? false)
  }, [open, place])

  const pending = create.isPending || update.isPending

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error(t('Name is required', '請輸入名稱'))
      return
    }
    const fields = {
      name: name.trim(),
      tags,
      note: note.trim() || undefined,
      url: url.trim() || undefined,
      address: address.trim() || undefined,
      visited,
    }
    try {
      if (editing && place) {
        await update.mutateAsync({ place_id: place.id, ...fields })
      } else {
        await create.mutateAsync(fields)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(humanizeError(err, ['Failed to save', '儲存失敗']))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-h-[90dvh]">
        <DialogHeader>
          <DialogTitle>{editing ? t('Edit place', '編輯地點') : t('New place', '新增地點')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('Shop or sight name', '店家或景點名稱')}
            className="w-full border-b border-border bg-transparent pb-2 text-lg font-semibold outline-none placeholder:text-muted-foreground/50 focus:border-brand"
          />
          <div className="flex flex-col gap-1.5">
            <Label>{t('Tags', '標籤')}</Label>
            <TagInput tags={tags} onChange={setTags} suggestions={tagSuggestions} listId="place-tags" />
            <p className="text-[12px] text-muted-foreground/70">
              {t('e.g. 台南東區 · 友愛街附近 · 甜點', '例如：台南東區 · 友愛街附近 · 甜點')}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pl-addr">{t('Address / area', '地址 / 區域')}</Label>
            <Input id="pl-addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('台南市東區…', '台南市東區…')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pl-url">{t('Link / map', '連結 / 地圖')}</Label>
            <Input id="pl-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://maps.google.com/…" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pl-note">{t('Note', '備註')}</Label>
            <Textarea id="pl-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={t('Recommended dish, opening hours, who recommended it…', '推薦招牌菜、營業時間、誰推薦的…')} />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-foreground">
            <input type="checkbox" checked={visited} onChange={(e) => setVisited(e.target.checked)} className="size-4 accent-[var(--brand)]" />
            {t('Already been here', '已去過')}
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('Cancel', '取消')}
            </Button>
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? t('Saving…', '儲存中…') : editing ? t('Save', '儲存') : t('Add', '新增')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
