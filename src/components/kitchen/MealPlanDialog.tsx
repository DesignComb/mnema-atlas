import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useSetMealPlan } from '@/lib/hooks'
import { useI18n } from '@/lib/i18n'
import type { MealPlanRow, RecipeRow } from '@/lib/database.types'
import type { MealSlot } from '@shared/schemas'
import { localTodayISO } from '@/lib/health'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const SLOTS: { v: MealSlot; en: string; zh: string }[] = [
  { v: 'breakfast', en: 'Breakfast', zh: '早餐' },
  { v: 'lunch', en: 'Lunch', zh: '午餐' },
  { v: 'dinner', en: 'Dinner', zh: '晚餐' },
  { v: 'snack', en: 'Snack', zh: '點心' },
]

export function MealPlanDialog({
  open,
  onOpenChange,
  plan,
  recipes,
  defaultDate,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  plan?: MealPlanRow
  recipes: RecipeRow[]
  defaultDate?: string
}) {
  const { t } = useI18n()
  const save = useSetMealPlan()

  const [date, setDate] = useState(localTodayISO())
  const [slot, setSlot] = useState<MealSlot>('dinner')
  const [recipeId, setRecipeId] = useState('')
  const [title, setTitle] = useState('')

  useEffect(() => {
    if (!open) return
    setDate(plan?.plan_date ?? defaultDate ?? localTodayISO())
    setSlot((plan?.slot as MealSlot) ?? 'dinner')
    setRecipeId(plan?.recipe_id ?? '')
    setTitle(plan?.title ?? '')
  }, [open, plan, defaultDate])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!recipeId && !title.trim()) {
      toast.error(t('Pick a recipe or type a meal', '選一個食譜或輸入餐點'))
      return
    }
    try {
      await save.mutateAsync({
        plan_id: plan?.id,
        plan_date: date,
        slot,
        recipe_id: recipeId || undefined,
        title: recipeId ? undefined : title.trim(),
      })
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to save', '儲存失敗'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plan ? t('Edit meal', '編輯餐點') : t('Plan a meal', '安排餐點')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mp-date">{t('Date', '日期')}</Label>
              <Input id="mp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mp-slot">{t('Meal', '餐別')}</Label>
              <Select id="mp-slot" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
                {SLOTS.map((s) => (
                  <option key={s.v} value={s.v}>
                    {t(s.en, s.zh)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mp-recipe">{t('Recipe', '食譜')}</Label>
            <Select id="mp-recipe" value={recipeId} onChange={(e) => setRecipeId(e.target.value)}>
              <option value="">{t('— none (type below) —', '— 無(下方輸入) —')}</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </Select>
          </div>
          {!recipeId ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mp-title">{t('Or a meal', '或輸入餐點')}</Label>
              <Input id="mp-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('e.g. eat out', '例如:外食')} />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('Cancel', '取消')}
            </Button>
            <Button type="submit" variant="brand" disabled={save.isPending}>
              {save.isPending ? t('Saving…', '儲存中…') : t('Save', '儲存')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
