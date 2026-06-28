import { humanizeError } from '@/lib/utils'
import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Check, Copy, FileText, Layers, Sparkles, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { parseMnema } from '@/lib/import/parseMnema'
import * as api from '@/lib/api'
import { useDecks } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import { activeSpace, brandTitleFor, type SpaceKey } from '@/components/app-shell/spaces'
import { SPACE_IMPORT, buildRestPrompt } from '@/lib/ai-import'
import { REST_URL } from '@/lib/endpoints'
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

/**
 * The "Import from AI" dialog, opened globally (⌘I, the command palette, the
 * sidebar, the mobile profile sheet). It is **Space-aware**: it reads the
 * current route and shows that Space's flow. Study uses a paste-back `mnema`
 * block (parsed + written client-side); every other Space guides the user to
 * let their own AI write through the REST API (no paste-back).
 */
export function QuickImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const space = activeSpace(pathname)
  if (SPACE_IMPORT[space].mode === 'paste') {
    return <StudyPasteImport open={open} onOpenChange={onOpenChange} />
  }
  return <RestImportGuide open={open} onOpenChange={onOpenChange} space={space} />
}

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

/** Study: the AI replies with a `mnema` block; we parse + write notes/cards here. */
function StudyPasteImport({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
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
          `已匯入 ${data.notes.length} 則筆記與 ${data.cards.length} 張閃卡`,
        ),
      )
      setText('')
      onOpenChange(false)
      if (deckId) navigate({ to: '/decks/$deckId', params: { deckId } })
      else if (data.notes.length) navigate({ to: '/notes' })
      else navigate({ to: '/cards' })
    } catch (e) {
      toast.error(humanizeError(e, ['Import failed', '匯入失敗']))
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
              <FileText className="size-3.5" /> {t(`${data.notes.length} note(s) · ${data.cards.length} card(s)`, `${data.notes.length} 則筆記 · ${data.cards.length} 張閃卡`)}
            </p>
            {unknownRefs > 0 ? (
              <p className="flex items-start gap-1.5 text-amber-600">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {t(
                  `${unknownRefs} card(s) reference a note not in this import — they'll be created unlinked.`,
                  `${unknownRefs} 張閃卡參照了此次匯入中沒有的筆記 — 它們將不會連結。`,
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

/** Every non-Study Space: the AI writes through the REST API directly. We hand
 *  the user a Space-specific prompt + a link to mint a key — there's nothing to
 *  paste back. */
function RestImportGuide({
  open,
  onOpenChange,
  space,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  space: SpaceKey
}) {
  const t = useT()
  const cfg = SPACE_IMPORT[space]
  const prompt = useMemo(() => buildRestPrompt(cfg), [cfg])
  const [copied, setCopied] = useState(false)
  const configured = !!REST_URL

  // Reset the "Copied" affordance via an effect so a pending timer is cleaned up
  // if the dialog closes first (avoids a setState on an unmounted component).
  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(id)
  }, [copied])

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    toast.success(t('Prompt copied — paste it to your AI', '已複製提示詞 — 貼給你的 AI'))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" />
            {t('Import with AI', '用 AI 匯入')}
            <span className="text-muted-foreground">· {brandTitleFor(space)}</span>
          </DialogTitle>
          <DialogDescription>
            {t(
              `Let your own AI add ${cfg.thingEn} for you through the REST API — no copy-paste back needed.`,
              `讓你自己的 AI 透過 REST API 幫你新增${cfg.thingZh} —— 不必再把結果貼回來。`,
            )}
          </DialogDescription>
        </DialogHeader>

        <ol className="list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-muted-foreground">
          <li>
            {t('Get an API key in ', '到 ')}
            <Link
              to="/settings/integrations"
              onClick={() => onOpenChange(false)}
              className="font-medium text-brand hover:underline"
            >
              {t('Settings → Connect an AI', '設定 → 連接 AI')}
            </Link>
            {t(' (an add-only key is enough).', '（用「僅新增」金鑰就夠了）。')}
          </li>
          <li>
            {t(
              'Copy the prompt below and paste it to ChatGPT / Claude / Cursor — paste your key when it asks.',
              '複製下方提示詞，貼到 ChatGPT／Claude／Cursor —— 它要金鑰時貼上即可。',
            )}
          </li>
          <li>
            {t(`Then just tell it what to add, e.g. “${cfg.exampleEn}”.`, `接著直接告訴它要新增什麼，例如「${cfg.exampleZh}」。`)}
          </li>
        </ol>

        <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 px-4 py-3 text-[12px] leading-relaxed">
          <code>{prompt}</code>
        </pre>

        {!configured ? (
          <p className="flex items-start gap-1.5 text-[13px] text-amber-600">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            {t(
              'Your Worker URL isn’t configured, so the prompt uses a placeholder. Set VITE_REST_URL (see self-host docs).',
              '尚未設定你的 Worker 網址，提示詞先用佔位字串。請設定 VITE_REST_URL（見自架文件）。',
            )}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('Done', '完成')}
          </Button>
          <Button variant="brand" onClick={copyPrompt}>
            {copied ? (
              <>
                <Check className="size-4" /> {t('Copied', '已複製')}
              </>
            ) : (
              <>
                <Copy className="size-4" /> {t('Copy prompt', '複製提示詞')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
