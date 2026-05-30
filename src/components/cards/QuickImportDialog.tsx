import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Copy, FileText, Layers, Sparkles, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { parseMnema } from '@/lib/import/parseMnema'
import * as api from '@/lib/api'
import { useDecks } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** The prompt the user pastes INTO their AI so it emits an importable block. */
const PREAMBLE = `When I ask you to save notes or flashcards to Mnema, reply with ONLY a fenced code block tagged \`mnema\` containing JSON in this shape:

\`\`\`mnema
{
  "deck": "Optional deck name",
  "notes": [{ "title": "Note title", "body": "Markdown body" }],
  "cards": [{ "front": "Question", "back": "Answer", "note": "Note title (optional)" }]
}
\`\`\`

Keep fronts and backs concise. The "note" field links a card to a note by its title. Output nothing but the block.`

export function QuickImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: decks } = useDecks()
  const t = useT()

  const parsed = useMemo(() => (text.trim() ? parseMnema(text) : null), [text])
  const data = parsed?.ok ? parsed.data : undefined
  const noteTitles = new Set((data?.notes ?? []).map((n) => n.title))
  const unknownRefs = (data?.cards ?? []).filter((c) => c.note && !noteTitles.has(c.note)).length

  async function runImport() {
    if (!data) return
    setBusy(true)
    try {
      let deckId: string | undefined
      if (data.deck) {
        const existing = decks?.find((d) => d.name.toLowerCase() === data.deck!.toLowerCase())
        deckId = existing ? existing.id : (await api.createDeck({ name: data.deck })).id
      }

      const titleToId = new Map<string, string>()
      for (const n of data.notes) {
        const created = await api.createNote({ title: n.title, body: n.body, deck_id: deckId })
        titleToId.set(n.title, created.id)
      }

      if (data.cards.length) {
        await api.createFlashcardsBulk(
          data.cards.map((c) => ({
            front: c.front,
            back: c.back,
            note_id: c.note ? (titleToId.get(c.note) ?? null) : null,
            deck_id: deckId ?? null,
          })),
          deckId,
        )
      }

      await qc.invalidateQueries()
      toast.success(
        t(
          `Imported ${data.notes.length} note(s) and ${data.cards.length} card(s)`,
          `已匯入 ${data.notes.length} 則筆記與 ${data.cards.length} 張字卡`,
        ),
      )
      setText('')
      onOpenChange(false)
      if (deckId) navigate({ to: '/decks/$deckId', params: { deckId } })
      else if (data.notes.length) navigate({ to: '/notes' })
      else navigate({ to: '/cards' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Import failed', '匯入失敗'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Import from AI', '從 AI 匯入')}</DialogTitle>
          <DialogDescription>
            {t('Paste a ', '貼上來自 ChatGPT、Gemini 或任何 AI 的 ')}<code className="rounded bg-muted px-1">mnema</code>{t(' block from ChatGPT, Gemini, or any AI.', ' 區塊。')}
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(PREAMBLE)
            toast.success(t('Prompt copied — paste it into your AI chat first', '已複製提示詞 — 請先貼到你的 AI 對話中'))
          }}
          className="flex items-center gap-1.5 self-start text-[13px] font-medium text-brand hover:underline"
        >
          <Copy className="size-3.5" /> {t('Copy the prompt to give your AI', '複製要給 AI 的提示詞')}
        </button>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('Paste the AI\'s reply here…', '在這裡貼上 AI 的回覆…')}
          className="min-h-32 font-mono text-xs"
        />

        {parsed && !parsed.ok ? (
          <p className="flex items-start gap-1.5 text-[13px] text-amber-600">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {parsed.error}
          </p>
        ) : null}

        {data ? (
          <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3 text-[13px]">
            {data.deck ? (
              <p className="flex items-center gap-2">
                <Layers className="size-3.5 text-brand" /> {t('Deck:', '牌組：')} <strong className="font-medium">{data.deck}</strong>
              </p>
            ) : null}
            <p className="flex items-center gap-2 text-muted-foreground">
              <FileText className="size-3.5" /> {t(`${data.notes.length} note(s) · ${data.cards.length} card(s)`, `${data.notes.length} 則筆記 · ${data.cards.length} 張字卡`)}
            </p>
            {unknownRefs > 0 ? (
              <p className="flex items-start gap-1.5 text-amber-600">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {t(
                  `${unknownRefs} card(s) reference a note not in this import — they'll be created unlinked.`,
                  `${unknownRefs} 張字卡參照了此次匯入中沒有的筆記 — 它們將不會連結。`,
                )}
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('Cancel', '取消')}
          </Button>
          <Button variant="brand" disabled={!data || busy} onClick={runImport}>
            {busy ? t('Importing…', '匯入中…') : (
              <>
                <Sparkles className="size-4" /> {t('Import', '匯入')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
