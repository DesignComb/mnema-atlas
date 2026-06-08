import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAddPantryItem, useUpdatePantryItem } from '@/lib/hooks'
import { useI18n } from '@/lib/i18n'
import type { PantryItemRow } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function PantryDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  item?: PantryItemRow
}) {
  const { t } = useI18n()
  const editing = Boolean(item)
  const add = useAddPantryItem()
  const update = useUpdatePantryItem()

  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [expires, setExpires] = useState('')

  useEffect(() => {
    if (!open) return
    setName(item?.name ?? '')
    setQuantity(item?.quantity != null ? String(item.quantity) : '')
    setUnit(item?.unit ?? '')
    setCategory(item?.category ?? '')
    setLocation(item?.location ?? '')
    setExpires(item?.expires_on ?? '')
  }, [open, item])

  const pending = add.isPending || update.isPending

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error(t('Name is required', '請輸入名稱'))
      return
    }
    const fields = {
      name: name.trim(),
      quantity: quantity.trim() ? Number(quantity) : undefined,
      unit: unit.trim() || undefined,
      category: category.trim() || undefined,
      location: location.trim() || undefined,
      expires_on: expires || undefined,
    }
    try {
      if (editing && item) {
        await update.mutateAsync({ item_id: item.id, ...fields })
      } else {
        await add.mutateAsync(fields)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to save', '儲存失敗'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t('Edit item', '編輯項目') : t('Add to pantry', '加入庫存')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pn-name">{t('Name', '名稱')}</Label>
            <Input id="pn-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Eggs', '例如:雞蛋')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pn-qty">{t('Quantity', '數量')}</Label>
              <Input id="pn-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pn-unit">{t('Unit', '單位')}</Label>
              <Input id="pn-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t('e.g. pcs', '例如:顆')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pn-cat">{t('Category', '分類')}</Label>
              <Input id="pn-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t('e.g. Dairy', '例如:乳製品')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pn-loc">{t('Location', '位置')}</Label>
              <Input id="pn-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('e.g. Fridge', '例如:冰箱')} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pn-exp">{t('Expires', '到期日')}</Label>
            <Input id="pn-exp" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="w-44" />
          </div>
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
