import { humanizeError } from '@/lib/utils'
import { useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Carrot,
  Check,
  ChefHat,
  ListPlus,
  Pencil,
  Plus,
  ShoppingCart,
  Soup,
  Star,
  Trash2,
  Utensils,
} from 'lucide-react'
import {
  useAddShoppingItems,
  useClearCheckedShopping,
  useMealPlans,
  usePantry,
  useRecipes,
  useShopping,
  useUpdateRecipe,
  useUpdateShoppingItem,
} from '@/lib/hooks'
import {
  deleteMealPlan as apiDeleteMealPlan,
  deletePantryItem as apiDeletePantryItem,
  deleteRecipe as apiDeleteRecipe,
  deleteShoppingItem as apiDeleteShoppingItem,
} from '@/lib/api'
import { undoableDelete, useHiddenKeys } from '@/lib/undoable'
import { useI18n, useT } from '@/lib/i18n'
import type { MealPlanRow, PantryItemRow, RecipeRow } from '@/lib/database.types'
import type { RecipeIngredient } from '@shared/schemas'
import { localTodayISO } from '@/lib/health'
import { PageHeader, EmptyState, ErrorState } from '@/components/app-shell/PageHeader'
import { AiChip, useNewSince } from '@/components/common/AiChip'
import { ConnectAiLink } from '@/components/common/ConnectAiLink'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RecipeDialog } from '@/components/kitchen/RecipeDialog'
import { PantryDialog } from '@/components/kitchen/PantryDialog'
import { MealPlanDialog } from '@/components/kitchen/MealPlanDialog'
import { SwipeRow } from '@/components/common/SwipeRow'
import { PullToRefresh } from '@/lib/use-pull-to-refresh'

/** Awaitable mirror of hooks.ts' bumpKitchen, for undoable-delete onSettled. */
function bumpAllKitchen(qc: QueryClient) {
  return Promise.all(
    ['recipes', 'recipe', 'pantry', 'shopping', 'meal-plans'].map((k) => qc.invalidateQueries({ queryKey: [k] })),
  )
}

type Section = 'recipes' | 'pantry' | 'shopping' | 'plan'
const SLOT_LABEL: Record<string, { en: string; zh: string }> = {
  breakfast: { en: 'Breakfast', zh: '早餐' },
  lunch: { en: 'Lunch', zh: '午餐' },
  dinner: { en: 'Dinner', zh: '晚餐' },
  snack: { en: 'Snack', zh: '點心' },
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function KitchenScreen() {
  const t = useT()
  const { lang } = useI18n()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { ksection?: Section }
  const section: Section = search.ksection ?? 'recipes'

  const today = localTodayISO()
  const weekEnd = addDaysISO(today, 6)

  const qc = useQueryClient()
  const hiddenKeys = useHiddenKeys()
  const isNew = useNewSince('kitchen')
  const { data: allRecipes = [], isError: recipesError, refetch: refetchRecipes } = useRecipes()
  const { data: allPantry = [], isError: pantryError, refetch: refetchPantry } = usePantry()
  const { data: allShopping = [], isError: shoppingError, refetch: refetchShopping } = useShopping()
  const { data: allPlans = [], isError: plansError, refetch: refetchPlans } = useMealPlans(today, weekEnd)
  // The active section's failed fetch must not render as "empty" (A5).
  const sectionError =
    section === 'recipes' ? recipesError : section === 'pantry' ? pantryError : section === 'shopping' ? shoppingError : plansError
  const sectionRetry =
    section === 'recipes' ? refetchRecipes : section === 'pantry' ? refetchPantry : section === 'shopping' ? refetchShopping : refetchPlans
  const recipes = allRecipes.filter((r) => !hiddenKeys.has(`recipe:${r.id}`))
  const pantry = allPantry.filter((it) => !hiddenKeys.has(`pantry:${it.id}`))
  const shopping = allShopping.filter((s) => !hiddenKeys.has(`shopitem:${s.id}`))
  const plans = allPlans.filter((p) => !hiddenKeys.has(`mealplan:${p.id}`))

  const updateRecipe = useUpdateRecipe()
  const addShopping = useAddShoppingItems()
  const updateShopping = useUpdateShoppingItem()
  const clearChecked = useClearCheckedShopping()

  function removeKitchenItem(key: string, message: string, commit: () => Promise<unknown>) {
    undoableDelete({
      key,
      message,
      undoLabel: t('Undo', '復原'),
      errorMessage: t('Delete failed — the item is back', '刪除失敗,項目已還原'),
      commit,
      onSettled: () => bumpAllKitchen(qc),
    })
  }

  const [recipeDialog, setRecipeDialog] = useState<{ open: boolean; recipe?: RecipeRow }>({ open: false })
  const [pantryDialog, setPantryDialog] = useState<{ open: boolean; item?: PantryItemRow }>({ open: false })
  const [planDialog, setPlanDialog] = useState<{ open: boolean; plan?: MealPlanRow; date?: string }>({ open: false })
  const [newShop, setNewShop] = useState('')

  function setSection(s: Section) {
    navigate({ to: '/kitchen', search: { ksection: s === 'recipes' ? undefined : s }, replace: true })
  }

  const SECTIONS: { k: Section; en: string; zh: string }[] = [
    { k: 'recipes', en: 'Recipes', zh: '食譜' },
    { k: 'pantry', en: 'Pantry', zh: '庫存' },
    { k: 'shopping', en: 'Shopping', zh: '購物' },
    { k: 'plan', en: 'Plan', zh: '菜單' },
  ]

  function fmtDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-GB', { month: 'short', day: 'numeric', weekday: 'short' })
  }

  function addRecipeToShopping(r: RecipeRow) {
    const ings = (r.ingredients as RecipeIngredient[] | null) ?? []
    if (!ings.length) {
      toast.error(t('This recipe has no ingredients', '這份食譜沒有食材'))
      return
    }
    addShopping.mutate(
      { items: ings.map((i) => ({ name: i.name, quantity: i.quantity, recipe_id: r.id })) },
      {
        onSuccess: () => toast.success(t('Added to shopping list', '已加入購物清單')),
        onError: (e) => toast.error(humanizeError(e)),
      },
    )
  }

  function addShoppingLine() {
    const name = newShop.trim()
    if (!name) return
    setNewShop('')
    addShopping.mutate({ items: [{ name }] }, { onError: (e) => toast.error(humanizeError(e)) })
  }

  // Pantry grouped by category.
  const pantryByCat = useMemo(() => {
    const map = new Map<string, PantryItemRow[]>()
    for (const it of pantry) {
      const c = it.category || t('Other', '其他')
      if (!map.has(c)) map.set(c, [])
      map.get(c)!.push(it)
    }
    return [...map.entries()]
  }, [pantry, t])

  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(today, i))

  return (
    <>
      <PageHeader
        title={t('Kitchen', '廚房')}
        icon={<ChefHat className="size-4" />}
        actions={
          section === 'recipes' ? (
            <Button variant="brand" size="sm" onClick={() => setRecipeDialog({ open: true })}>
              <Plus className="size-4" /> {t('Recipe', '食譜')}
            </Button>
          ) : section === 'pantry' ? (
            <Button variant="brand" size="sm" onClick={() => setPantryDialog({ open: true })}>
              <Plus className="size-4" /> {t('Item', '項目')}
            </Button>
          ) : section === 'plan' ? (
            <Button variant="brand" size="sm" onClick={() => setPlanDialog({ open: true })}>
              <Plus className="size-4" /> {t('Meal', '餐點')}
            </Button>
          ) : null
        }
      />

      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-2 sm:px-6">
        {SECTIONS.map((s) => (
          <button
            key={s.k}
            onClick={() => setSection(s.k)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
              section === s.k ? 'bg-brand-muted text-brand' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {t(s.en, s.zh)}
          </button>
        ))}
      </div>

      <PullToRefresh onRefresh={() => bumpAllKitchen(qc)}>
        <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6">
          {sectionError ? <ErrorState onRetry={() => void sectionRetry()} /> : null}
          {/* ── Recipes ────────────────────────────────────────────── */}
          {section === 'recipes' && !sectionError ? (
            recipes.length ? (
              <div className="flex flex-col gap-2.5">
                {recipes.map((r) => {
                  const ings = (r.ingredients as RecipeIngredient[] | null) ?? []
                  return (
                    <div key={r.id} className="group rounded-xl border border-border bg-card p-4">
                      <div className="flex items-start gap-2">
                        <button onClick={() => setRecipeDialog({ open: true, recipe: r })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          {r.image_url ? (
                            <img src={r.image_url} alt="" loading="lazy" className="size-12 shrink-0 rounded-lg border border-border object-cover" />
                          ) : null}
                          <span className="block min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground">
                              <span className="truncate">{r.title}</span>
                              {r.created_via === 'mcp' ? <AiChip isNew={isNew(r.created_at)} /> : null}
                            </span>
                            <span className="block truncate text-[12.5px] text-muted-foreground">
                              {[
                                r.servings ? t(`${r.servings} servings`, `${r.servings} 份`) : '',
                                r.total_minutes ? `${r.total_minutes} ${t('min', '分')}` : '',
                                ings.length ? t(`${ings.length} ingredients`, `${ings.length} 種食材`) : '',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                        </button>
                        <button
                          onClick={() => updateRecipe.mutate({ recipe_id: r.id, is_favorite: !r.is_favorite })}
                          className="rounded p-1 text-muted-foreground transition hover:text-brand"
                          title={t('Favorite', '最愛')}
                        >
                          <Star className={`size-4 ${r.is_favorite ? 'fill-brand text-brand' : ''}`} />
                        </button>
                        <div className="flex gap-1 opacity-0 transition group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                          <button onClick={() => addRecipeToShopping(r)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title={t('Add to shopping', '加入購物清單')}>
                            <ListPlus className="size-4" />
                          </button>
                          <button
                            onClick={() => removeKitchenItem(`recipe:${r.id}`, t(`Deleted “${r.title}”`, `已刪除「${r.title}」`), () => apiDeleteRecipe(r.id, r.image_url))}
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                            aria-label={t('Delete', '刪除')}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon={<Soup className="size-5" />}
                title={t('No recipes yet', '還沒有食譜')}
                description={t('Add one, or tell your AI “幫我存這份食譜”.', '新增一份,或跟你的 AI 說「幫我存這份食譜」。')}
                action={
                  <div className="flex flex-col items-center gap-2">
                    <Button variant="brand" size="sm" onClick={() => setRecipeDialog({ open: true })}><Plus className="size-4" /> {t('New recipe', '新增食譜')}</Button>
                    <ConnectAiLink />
                  </div>
                }
              />
            )
          ) : null}

          {/* ── Pantry ─────────────────────────────────────────────── */}
          {section === 'pantry' && !sectionError ? (
            pantry.length ? (
              <div className="flex flex-col gap-4">
                {pantryByCat.map(([cat, items]) => (
                  <div key={cat}>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">{cat}</p>
                    <div className="flex flex-col gap-1.5">
                      {items.map((it) => (
                        <SwipeRow
                          key={it.id}
                          className="rounded-lg border border-border"
                          right={{
                            icon: <Pencil className="size-5" />,
                            label: t('Edit', '編輯'),
                            className: 'bg-foreground text-background',
                            onTrigger: () => setPantryDialog({ open: true, item: it }),
                          }}
                          left={{
                            icon: <Trash2 className="size-5" />,
                            label: t('Delete', '刪除'),
                            className: 'bg-destructive text-destructive-foreground',
                            onTrigger: () =>
                              removeKitchenItem(`pantry:${it.id}`, t(`Deleted “${it.name}”`, `已刪除「${it.name}」`), () => apiDeletePantryItem(it.id)),
                            commit: 'exit',
                          }}
                        >
                          <div className="group flex items-center gap-3 bg-card px-3 py-2">
                            <Carrot className="size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13.5px] text-foreground">
                                {it.name}
                                {it.quantity != null ? <span className="text-muted-foreground"> · {it.quantity}{it.unit ? ` ${it.unit}` : ''}</span> : null}
                              </p>
                              {it.expires_on ? <p className="text-[11.5px] text-muted-foreground">{t('Expires', '到期')} {fmtDate(it.expires_on)}</p> : null}
                            </div>
                            <div className="flex gap-1 opacity-0 transition group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                              <button onClick={() => setPantryDialog({ open: true, item: it })} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                onClick={() => removeKitchenItem(`pantry:${it.id}`, t(`Deleted “${it.name}”`, `已刪除「${it.name}」`), () => apiDeletePantryItem(it.id))}
                                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                                aria-label={t('Delete', '刪除')}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        </SwipeRow>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Carrot className="size-5" />}
                title={t('Pantry is empty', '庫存是空的')}
                description={t('Track what you have so your AI can suggest meals.', '記下現有食材,讓 AI 幫你想菜。')}
                action={
                  <div className="flex flex-col items-center gap-2">
                    <Button variant="brand" size="sm" onClick={() => setPantryDialog({ open: true })}>
                      <Plus className="size-4" /> {t('Add item', '新增項目')}
                    </Button>
                    <ConnectAiLink />
                  </div>
                }
              />
            )
          ) : null}

          {/* ── Shopping ───────────────────────────────────────────── */}
          {section === 'shopping' && !sectionError ? (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Input
                  value={newShop}
                  onChange={(e) => setNewShop(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addShoppingLine()
                    }
                  }}
                  placeholder={t('Add an item…', '新增項目…')}
                />
                <Button variant="brand" onClick={addShoppingLine} disabled={!newShop.trim()}>
                  <Plus className="size-4" />
                </Button>
              </div>
              {shopping.some((s) => s.is_checked) ? (
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => clearChecked.mutate()}>
                    {t('Clear checked', '清除已勾選')}
                  </Button>
                </div>
              ) : null}
              {shopping.length ? (
                <div className="flex flex-col gap-1">
                  {shopping.map((s) => (
                    // Swipe → fires the same optimistic check toggle as the
                    // checkbox; swipe ← the same undoable delete as the trash.
                    <SwipeRow
                      key={s.id}
                      className="rounded-lg border border-border"
                      right={{
                        icon: <Check className="size-5" />,
                        label: s.is_checked ? t('Uncheck', '取消勾選') : t('Check', '勾選'),
                        className: 'bg-success text-success-foreground',
                        onTrigger: () => updateShopping.mutate({ item_id: s.id, is_checked: !s.is_checked }),
                      }}
                      left={{
                        icon: <Trash2 className="size-5" />,
                        label: t('Delete', '刪除'),
                        className: 'bg-destructive text-destructive-foreground',
                        onTrigger: () =>
                          removeKitchenItem(`shopitem:${s.id}`, t(`Deleted “${s.name}”`, `已刪除「${s.name}」`), () => apiDeleteShoppingItem(s.id)),
                        commit: 'exit',
                      }}
                    >
                      <div className="group flex items-center gap-3 bg-card px-3 py-2">
                        <input
                          type="checkbox"
                          checked={s.is_checked}
                          onChange={(e) => updateShopping.mutate({ item_id: s.id, is_checked: e.target.checked })}
                          className="size-4 accent-[var(--brand)]"
                        />
                        <span className={`min-w-0 flex-1 truncate text-[13.5px] ${s.is_checked ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                          {s.name}
                          {s.quantity ? <span className="text-muted-foreground"> · {s.quantity}</span> : null}
                        </span>
                        <button
                          onClick={() => removeKitchenItem(`shopitem:${s.id}`, t(`Deleted “${s.name}”`, `已刪除「${s.name}」`), () => apiDeleteShoppingItem(s.id))}
                          className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-destructive group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                          aria-label={t('Delete', '刪除')}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </SwipeRow>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<ShoppingCart className="size-5" />}
                  title={t('Nothing to buy', '沒有要買的東西')}
                  description={t('Add items above, or fill it from a recipe.', '在上方新增項目,或從食譜帶入。')}
                  action={<ConnectAiLink />}
                />
              )}
            </div>
          ) : null}

          {/* ── Meal plan (this week) ──────────────────────────────── */}
          {section === 'plan' && !sectionError ? (
            <div className="flex flex-col gap-3">
              {days.map((d) => {
                const todays = plans.filter((p) => p.plan_date === d)
                return (
                  <div key={d} className="rounded-xl border border-border bg-card p-3.5">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[13px] font-semibold text-foreground">{fmtDate(d)}{d === today ? <span className="ml-2 text-[11px] text-brand">{t('today', '今天')}</span> : null}</p>
                      <button onClick={() => setPlanDialog({ open: true, date: d })} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title={t('Plan a meal', '安排餐點')}>
                        <Plus className="size-4" />
                      </button>
                    </div>
                    {todays.length ? (
                      <div className="flex flex-col gap-1">
                        {todays.map((p) => {
                          const recipe = recipes.find((r) => r.id === p.recipe_id)
                          return (
                            <div key={p.id} className="group flex items-center gap-2 text-[13px]">
                              <Utensils className="size-3.5 shrink-0 text-muted-foreground" />
                              <span className="w-12 shrink-0 text-muted-foreground">{t(SLOT_LABEL[p.slot]?.en ?? p.slot, SLOT_LABEL[p.slot]?.zh ?? p.slot)}</span>
                              <button onClick={() => setPlanDialog({ open: true, plan: p })} className="min-w-0 flex-1 truncate text-left text-foreground hover:text-brand">
                                {recipe?.title ?? p.title ?? '—'}
                              </button>
                              <button
                                onClick={() => removeKitchenItem(`mealplan:${p.id}`, t('Meal removed', '已移除餐點'), () => apiDeleteMealPlan(p.id))}
                                className="rounded p-0.5 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                                aria-label={t('Delete', '刪除')}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-[12.5px] text-muted-foreground/70">{t('Nothing planned', '尚未安排')}</p>
                    )}
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </PullToRefresh>

      <RecipeDialog open={recipeDialog.open} onOpenChange={(v) => setRecipeDialog((s) => ({ ...s, open: v }))} recipe={recipeDialog.recipe} />
      <PantryDialog open={pantryDialog.open} onOpenChange={(v) => setPantryDialog((s) => ({ ...s, open: v }))} item={pantryDialog.item} />
      <MealPlanDialog
        open={planDialog.open}
        onOpenChange={(v) => setPlanDialog((s) => ({ ...s, open: v }))}
        plan={planDialog.plan}
        recipes={recipes}
        defaultDate={planDialog.date}
      />
    </>
  )
}
