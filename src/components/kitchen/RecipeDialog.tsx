import { humanizeError } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useCreateRecipe, useUpdateRecipe } from '@/lib/hooks'
import { useI18n } from '@/lib/i18n'
import type { RecipeRow } from '@/lib/database.types'
import type { RecipeIngredient } from '@shared/schemas'
import { TagInput } from '@/components/editor/TagInput'
import { ImageUpload } from '@/components/cards/ImageUpload'
import { removeUploadedImage } from '@/lib/upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** Display an ingredient row as one line, natural reading order: qty unit name. */
function ingredientToLine(i: RecipeIngredient): string {
  return [i.quantity, i.unit, i.name].filter(Boolean).join(' ').trim()
}

/**
 * Best-effort parse of a hand-typed line back into {quantity, unit, name}.
 * Only used for NEW or EDITED lines — untouched lines keep their original
 * structured object exactly (see linesToIngredients), so an AI-written
 * `{quantity: '2', unit: 'cups', name: 'flour'}` survives a human re-save (A4).
 */
function parseIngredientLine(line: string): RecipeIngredient {
  const clamp = (s: string) => s.slice(0, 120)
  const m = line.match(/^([\d¼½¾⅓⅔.,/\-–~×x]+)\s+(.+)$/u)
  if (!m) return { name: clamp(line) }
  const quantity = m[1].slice(0, 60)
  const rest = m[2].trim()
  // A short first token followed by more words is usually the unit ("cup rice" / "杯 牛奶").
  const um = rest.match(/^(\p{L}{1,8})\s+(.+)$/u)
  if (um) return { quantity, unit: um[1].slice(0, 40), name: clamp(um[2]) }
  return { quantity, name: clamp(rest) }
}

export function RecipeDialog({
  open,
  onOpenChange,
  recipe,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  recipe?: RecipeRow
}) {
  const { t } = useI18n()
  const editing = Boolean(recipe)
  const create = useCreateRecipe()
  const update = useUpdateRecipe()

  const [title, setTitle] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [instructions, setInstructions] = useState('')
  const [servings, setServings] = useState('')
  const [minutes, setMinutes] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [sourceUrl, setSourceUrl] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [favorite, setFavorite] = useState(false)
  // rendered line → the original structured ingredient(s) behind it
  const originalByLine = useRef<Map<string, RecipeIngredient[]>>(new Map())

  useEffect(() => {
    if (!open) return
    setTitle(recipe?.title ?? '')
    const ings = (recipe?.ingredients as RecipeIngredient[] | null) ?? []
    const map = new Map<string, RecipeIngredient[]>()
    if (Array.isArray(ings)) {
      for (const i of ings) {
        const line = ingredientToLine(i)
        map.set(line, [...(map.get(line) ?? []), i])
      }
    }
    originalByLine.current = map
    setIngredients(Array.isArray(ings) ? ings.map(ingredientToLine).join('\n') : '')
    setInstructions(recipe?.instructions ?? '')
    setServings(recipe?.servings != null ? String(recipe.servings) : '')
    setMinutes(recipe?.total_minutes != null ? String(recipe.total_minutes) : '')
    setTags(recipe?.tags ?? [])
    setSourceUrl(recipe?.source_url ?? '')
    setImageUrl(recipe?.image_url ?? null)
    setFavorite(recipe?.is_favorite ?? false)
  }, [open, recipe])

  const pending = create.isPending || update.isPending

  /** Untouched lines reuse their exact original object; only changed/new lines are parsed. */
  function linesToIngredients(text: string): RecipeIngredient[] {
    const pool = new Map([...originalByLine.current].map(([k, v]) => [k, [...v]]))
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const originals = pool.get(line)
        if (originals?.length) return originals.shift()!
        return parseIngredientLine(line)
      })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error(t('Title is required', '請輸入標題'))
      return
    }
    const fields = {
      title: title.trim(),
      ingredients: linesToIngredients(ingredients),
      instructions: instructions.trim() || undefined,
      servings: servings.trim() ? Number(servings) : undefined,
      total_minutes: minutes.trim() ? Number(minutes) : undefined,
      tags,
      source_url: sourceUrl.trim() || undefined,
      // update_recipe (0042): null = keep current, '' = clear, value = set.
      image_url: imageUrl ?? (editing && recipe?.image_url ? '' : undefined),
      is_favorite: favorite,
    }
    try {
      if (editing && recipe) {
        await update.mutateAsync({ recipe_id: recipe.id, ...fields })
        // The old saved photo is now unreferenced (cleared or replaced) — best-effort cleanup.
        if (recipe.image_url && recipe.image_url !== imageUrl) void removeUploadedImage(recipe.image_url)
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
          <DialogTitle>{editing ? t('Edit recipe', '編輯食譜') : t('New recipe', '新增食譜')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('Recipe title', '食譜名稱')}
            className="w-full border-b border-border bg-transparent pb-2 text-lg font-semibold outline-none placeholder:text-muted-foreground/50 focus:border-brand"
          />
          <div className="flex flex-col gap-1.5">
            <Label>{t('Photo', '照片')}</Label>
            <ImageUpload value={imageUrl} onChange={setImageUrl} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rc-ing">{t('Ingredients (one per line)', '食材(一行一項)')}</Label>
            <Textarea id="rc-ing" value={ingredients} onChange={(e) => setIngredients(e.target.value)} rows={5} placeholder={t('2 eggs\n1 cup rice\n…', '2 顆蛋\n1 杯米\n…')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rc-steps">{t('Instructions', '作法')}</Label>
            <Textarea id="rc-steps" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={5} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rc-serv">{t('Servings', '份量')}</Label>
              <Input id="rc-serv" inputMode="numeric" value={servings} onChange={(e) => setServings(e.target.value)} placeholder="2" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rc-min">{t('Total minutes', '總時間(分)')}</Label>
              <Input id="rc-min" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="30" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rc-src">{t('Source link', '來源連結')}</Label>
            <Input id="rc-src" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('Tags', '標籤')}</Label>
            <TagInput tags={tags} onChange={setTags} listId="recipe-tags" />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-foreground">
            <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} className="size-4 accent-[var(--brand)]" />
            {t('Favorite', '最愛')}
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
