import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { modKey } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * Bridges the editor → conversational AI → back. Hands the user a ready-made
 * prompt (so they know exactly what to paste TO the AI) and tells them how to
 * paste the answer BACK (Quick Import, ⌘/Ctrl-I).
 */
export function AskAiDialog({
  open,
  onOpenChange,
  prompt,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  prompt: string
}) {
  const [copied, setCopied] = useState(false)
  const t = useT()
  async function copy() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    toast.success(t('Prompt copied — paste it to your AI', '已複製提示詞 — 貼給你的 AI'))
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Ask an AI to make the cards', '請 AI 幫你製作閃卡')}</DialogTitle>
          <DialogDescription>
            {t(
              'Copy this, paste it into ChatGPT / Claude / any AI, then paste its answer back here.',
              '複製以下內容，貼到 ChatGPT／Claude／任何 AI，再把它的回覆貼回這裡。',
            )}
          </DialogDescription>
        </DialogHeader>
        <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/50 px-4 py-3 font-serif text-[12.5px] leading-relaxed">
          <code>{prompt}</code>
        </pre>
        <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-muted-foreground">
          <li><strong className="text-foreground">{t('Copy', '複製')}</strong>{t(' the prompt above and paste it to your AI.', '上方的提示詞並貼給你的 AI。')}</li>
          <li>{t('It replies with a ', '它會回覆一段 ')}<code className="rounded bg-muted px-1">mnema</code>{t(' block.', ' 區塊。')}</li>
          <li>
            {t('Copy that reply, press', '複製該回覆，在這裡按')}{' '}
            <kbd className="rounded border border-border bg-card px-1.5 text-[11px]">{modKey}+I</kbd>{t(' here, and paste it to create the cards.', '，再貼上即可建立閃卡。')}
          </li>
        </ol>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('Close', '關閉')}
          </Button>
          <Button variant="brand" onClick={copy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {t('Copy prompt', '複製提示詞')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
