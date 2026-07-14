import { useState } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { Library, Plus } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useDecks, useReorderDecks } from '@/lib/hooks'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { AiImportButton } from '@/components/app-shell/AiImportButton'
import { DeckTreeNav } from '@/components/app-shell/AppSidebar'
import { NewDeckDialog } from '@/components/app-shell/NewDeckDialog'
import { Button } from '@/components/ui/button'

/**
 * Full-screen deck tree — the mobile home for the nested, drag-reorderable decks
 * that live in the desktop sidebar. Reached from the Study SubNav's "Decks" tab;
 * drilling into a deck pushes /decks/$deckId. Reuses DeckTreeNav verbatim.
 */
export function DecksScreen() {
  const t = useT()
  const { data: decks } = useDecks()
  const reorder = useReorderDecks()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [newOpen, setNewOpen] = useState(false)

  return (
    <>
      <PageHeader
        title={t('Decks', '牌組')}
        icon={<Library className="size-4" />}
        actions={
          <div className="flex items-center gap-1.5">
            <AiImportButton />
            <Button variant="brand" size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="size-4" /> <span className="hidden sm:inline">{t('New deck', '新增牌組')}</span>
            </Button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-3 py-4 sm:px-6">
          {decks?.length ? (
            <DeckTreeNav decks={decks} pathname={pathname} onReorder={(ids) => reorder.mutate(ids)} />
          ) : (
            <EmptyState
              icon={<Library className="size-6" />}
              title={t('No decks yet', '還沒有牌組')}
              description={t('Create one, or let a connected AI add content.', '建立一個,或讓連接的 AI 幫你新增。')}
              action={
                <Button variant="brand" size="sm" onClick={() => setNewOpen(true)}>
                  <Plus className="size-4" /> {t('New deck', '新增牌組')}
                </Button>
              }
            />
          )}
        </div>
      </div>
      <NewDeckDialog open={newOpen} onOpenChange={setNewOpen} />
    </>
  )
}
