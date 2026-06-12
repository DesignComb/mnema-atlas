import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { FilePlus2, FileText, FolderInput, GraduationCap, Layers, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCards,
  useCreateNote,
  useDecks,
  useDeleteDeck,
  useDueCards,
  useNotes,
  useSetDeckParent,
} from '@/lib/hooks'
import { ancestors, buildDeckTree, compareDecks, descendantIds, flattenTree } from '@/lib/deck-tree'
import type { DeckRow } from '@/lib/database.types'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { NewCardDialog } from '@/components/cards/NewCardDialog'
import { NewDeckDialog } from '@/components/app-shell/NewDeckDialog'
import { FlashcardTile } from '@/components/cards/FlashcardTile'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn, relativeDue, humanizeError, untitledLabel } from '@/lib/utils'
import { useI18n, useT } from '@/lib/i18n'

// Global preference: whether deck pages also list notes/cards from descendant decks.
const INCLUDE_SUBDECKS_KEY = 'mnema:deck-include-subdecks'

export function DeckScreen() {
  const { deckId } = useParams({ strict: false }) as { deckId: string }
  const { data: decks } = useDecks()
  const { t, lang } = useI18n()
  const [cardOpen, setCardOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [subDeckOpen, setSubDeckOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [includeSubs, setIncludeSubs] = useState(() => {
    try {
      return localStorage.getItem(INCLUDE_SUBDECKS_KEY) === '1'
    } catch {
      return false
    }
  })

  // Nesting context for this deck — breadcrumb up, sub-decks down.
  const crumbs = useMemo(() => ancestors(decks ?? [], deckId), [decks, deckId])
  const childDecks = useMemo(
    () => (decks ?? []).filter((d) => d.parent_deck_id === deckId).sort(compareDecks),
    [decks, deckId],
  )
  const descIds = useMemo(() => descendantIds(decks ?? [], deckId), [decks, deckId])

  // "Include sub-decks": fetch the unfiltered lists and scope client-side to
  // this deck + its descendants (listNotes/listCards only filter by one deck_id).
  const subScope = includeSubs && descIds.size > 0
  const { data: scopedNotes } = useNotes(subScope ? undefined : deckId)
  const { data: scopedCards } = useCards(subScope ? undefined : deckId)
  const inScope = (id: string | null) => id === deckId || (!!id && descIds.has(id))
  const notes = subScope ? scopedNotes?.filter((n) => inScope(n.deck_id)) : scopedNotes
  const cards = subScope ? scopedCards?.filter((c) => inScope(c.deck_id)) : scopedCards

  const { data: due } = useDueCards(deckId)
  const createNote = useCreateNote()
  const deleteDeck = useDeleteDeck()
  const navigate = useNavigate()

  function toggleIncludeSubs() {
    setIncludeSubs((v) => {
      const next = !v
      try {
        localStorage.setItem(INCLUDE_SUBDECKS_KEY, next ? '1' : '0')
      } catch {
        /* storage unavailable — preference just won't persist */
      }
      return next
    })
  }

  async function removeDeck() {
    if (!confirmDel) {
      setConfirmDel(true)
      return
    }
    try {
      await deleteDeck.mutateAsync(deckId)
      toast.success(
        t('Deck deleted — its notes & cards were kept, just unfiled', '已刪除牌組——筆記與字卡都會保留，只是不再歸檔'),
      )
      navigate({ to: '/cards' })
    } catch (err) {
      toast.error(humanizeError(err, ['Failed to delete deck', '刪除牌組失敗']))
    }
  }

  const deck = decks?.find((d) => d.id === deckId)
  const dueCount = due?.length ?? 0
  const noteTitleById = new Map((notes ?? []).map((n) => [n.id, n.title]))

  async function newNote() {
    try {
      const note = await createNote.mutateAsync({ title: untitledLabel(), body: '', deck_id: deckId })
      navigate({ to: '/notes/$noteId', params: { noteId: note.id } })
    } catch (err) {
      toast.error(humanizeError(err, ['Failed to create note', '建立筆記失敗']))
    }
  }

  return (
    <>
      <PageHeader
        title={
          deck && crumbs.length ? (
            // Breadcrumb — ancestor chain stays clickable; current deck is plain text.
            <span className="flex min-w-0 items-center gap-1.5">
              {crumbs.map((c) => (
                <span key={c.id} className="flex min-w-0 shrink items-center gap-1.5">
                  <Link
                    to="/decks/$deckId"
                    params={{ deckId: c.id }}
                    className="max-w-36 truncate font-normal text-muted-foreground transition hover:text-brand"
                  >
                    {c.name}
                  </Link>
                  <span aria-hidden className="shrink-0 text-muted-foreground/50">
                    /
                  </span>
                </span>
              ))}
              <span className="min-w-0 truncate">{deck.name}</span>
            </span>
          ) : (
            deck?.name ?? t('Deck', '牌組')
          )
        }
        subtitle={deck?.description ?? undefined}
        icon={<Layers className="size-4" />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setCardOpen(true)}>
              <Plus className="size-4" /> <span className="hidden sm:inline">{t('Card', '字卡')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={newNote}>
              <FilePlus2 className="size-4" /> <span className="hidden sm:inline">{t('Note', '筆記')}</span>
            </Button>
            {dueCount > 0 ? (
              <Button asChild variant="brand" size="sm">
                <Link to="/study/$deckId" params={{ deckId }}>
                  <GraduationCap className="size-4" /> <span className="hidden sm:inline">{t('Study', '複習')} </span>({dueCount})
                </Link>
              </Button>
            ) : null}
            {deck ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setMoveOpen(true)} title={t('Move to', '移動到')}>
                  <FolderInput className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRenameOpen(true)} title={t('Rename deck', '重新命名牌組')}>
                  <Pencil className="size-4" />
                </Button>
              </>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={removeDeck}
              onBlur={() => setConfirmDel(false)}
              className={confirmDel ? 'text-destructive' : 'text-muted-foreground'}
              title={t('Delete deck', '刪除牌組')}
            >
              <Trash2 className="size-4" />
              {confirmDel ? t('Delete deck?', '確定刪除牌組？') : null}
            </Button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-8 px-4 py-4 sm:px-6 sm:py-6">
          {/* Sub-decks — only when this deck has children */}
          {childDecks.length ? (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {t('Sub-decks', '子牌組')} <span className="text-muted-foreground">· {childDecks.length}</span>
                </h3>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleIncludeSubs}
                    aria-pressed={includeSubs}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[12px] font-medium transition',
                      includeSubs
                        ? 'border-brand/40 bg-brand-muted text-brand'
                        : 'border-border text-muted-foreground hover:border-brand/40 hover:text-foreground',
                    )}
                  >
                    {t('Include sub-decks', '包含子牌組')}
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => setSubDeckOpen(true)}>
                    <Plus className="size-4" /> {t('Sub-deck', '子牌組')}
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {childDecks.map((d) => (
                  <Link
                    key={d.id}
                    to="/decks/$deckId"
                    params={{ deckId: d.id }}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-soft transition hover:border-brand/40"
                  >
                    <Layers className="size-4 shrink-0 text-muted-foreground group-hover:text-brand" />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{d.name}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* Flashcards (primary) */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t('Flashcards', '字卡')}{' '}
              {cards?.length ? <span className="text-muted-foreground">· {cards.length}</span> : null}
            </h3>
            {cards?.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {cards.map((c) => (
                  <FlashcardTile key={c.id} card={c} noteTitle={c.note_id ? noteTitleById.get(c.note_id) : undefined} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Layers className="size-6" />}
                title={t('No flashcards in this deck', '此牌組還沒有字卡')}
                description={t('Add a card, or let a connected AI create them.', '新增一張字卡，或讓連接的 AI 為你建立。')}
                action={
                  <Button variant="brand" size="sm" onClick={() => setCardOpen(true)}>
                    <Plus className="size-4" /> {t('New card', '新增字卡')}
                  </Button>
                }
              />
            )}
          </section>

          {/* Notes (secondary) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {t('Notes', '筆記')}{' '}
                {notes?.length ? <span className="text-muted-foreground">· {notes.length}</span> : null}
              </h3>
              <Button variant="ghost" size="sm" onClick={newNote}>
                <FilePlus2 className="size-4" /> {t('Note', '筆記')}
              </Button>
            </div>
            {notes?.length ? (
              <div className="grid gap-2">
                {notes.map((n) => (
                  <Link
                    key={n.id}
                    to="/notes/$noteId"
                    params={{ noteId: n.id }}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-soft transition hover:border-brand/40"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground group-hover:text-brand" />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{n.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{relativeDue(n.updated_at, undefined, lang)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border px-4 py-4 text-[13px] text-muted-foreground">
                {t('No notes in this deck yet.', '此牌組還沒有筆記。')}
              </p>
            )}
          </section>
        </div>
      </div>
      <NewCardDialog open={cardOpen} onOpenChange={setCardOpen} deckId={deckId} />
      <NewDeckDialog open={subDeckOpen} onOpenChange={setSubDeckOpen} defaultParentId={deckId} />
      {deck ? <NewDeckDialog open={renameOpen} onOpenChange={setRenameOpen} deck={deck} /> : null}
      {deck ? <MoveDeckDialog open={moveOpen} onOpenChange={setMoveOpen} deck={deck} decks={decks ?? []} /> : null}
    </>
  )
}

/**
 * "Move to" — re-parent this deck anywhere in the tree (or back to the top
 * level). The deck itself and its descendants are disabled so a cycle can't
 * even be attempted (the RPC also guards server-side).
 */
function MoveDeckDialog({
  open,
  onOpenChange,
  deck,
  decks,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  deck: DeckRow
  decks: DeckRow[]
}) {
  const t = useT()
  const setParent = useSetDeckParent()
  const blocked = useMemo(() => {
    const s = descendantIds(decks, deck.id)
    s.add(deck.id)
    return s
  }, [decks, deck.id])
  const options = useMemo(() => flattenTree(buildDeckTree(decks)), [decks])

  async function move(parentId: string | null) {
    try {
      await setParent.mutateAsync({ deckId: deck.id, parentDeckId: parentId })
      toast.success(t('Deck moved', '已移動牌組'))
      onOpenChange(false)
    } catch (err) {
      toast.error(humanizeError(err, ['Failed to move deck', '移動牌組失敗']))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Move to', '移動到')}</DialogTitle>
          <DialogDescription>
            {t(
              `Choose where “${deck.name}” lives. It can’t move under one of its own sub-decks.`,
              `選擇「${deck.name}」要放在哪裡。不能移到自己的子牌組底下。`,
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border p-1.5">
          <MoveTarget
            label={t('Top level', '最上層')}
            current={deck.parent_deck_id === null}
            disabled={setParent.isPending}
            onPick={() => move(null)}
          />
          {options.map(({ deck: d, depth }) => (
            <MoveTarget
              key={d.id}
              label={d.name}
              depth={depth + 1}
              current={deck.parent_deck_id === d.id}
              disabled={blocked.has(d.id) || setParent.isPending}
              onPick={() => move(d.id)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MoveTarget({
  label,
  depth = 0,
  current,
  disabled,
  onPick,
}: {
  label: string
  depth?: number
  current: boolean
  disabled: boolean
  onPick: () => void
}) {
  const t = useT()
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled || current}
      className={cn(
        'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40',
        current && 'text-brand',
      )}
      style={depth ? { paddingLeft: 10 + depth * 16 } : undefined}
    >
      <Layers className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {current ? <span className="shrink-0 text-[11px] font-medium">{t('Current', '目前位置')}</span> : null}
    </button>
  )
}
