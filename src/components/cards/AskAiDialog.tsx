import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { modKey } from '@/lib/utils'
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
  async function copy() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    toast.success('Prompt copied — paste it to your AI')
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ask an AI to make the cards</DialogTitle>
          <DialogDescription>
            Copy this, paste it into ChatGPT / Claude / any AI, then paste its answer back here.
          </DialogDescription>
        </DialogHeader>
        <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/50 px-4 py-3 font-serif text-[12.5px] leading-relaxed">
          <code>{prompt}</code>
        </pre>
        <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-muted-foreground">
          <li><strong className="text-foreground">Copy</strong> the prompt above and paste it to your AI.</li>
          <li>It replies with a <code className="rounded bg-muted px-1">mnema</code> block.</li>
          <li>
            Copy that reply, press{' '}
            <kbd className="rounded border border-border bg-card px-1.5 text-[11px]">{modKey}+I</kbd> here, and paste it
            to create the cards.
          </li>
        </ol>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="brand" onClick={copy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copy prompt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
