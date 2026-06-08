import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateCapture } from '@/lib/hooks'
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

/**
 * The global front door: capture a loose thought from ANY space without first
 * choosing where it belongs — your AI files it into the right space later. This
 * is the universal version of the Tempo capture box; both write to `captures`.
 */
export function CaptureDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useT()
  const create = useCreateCapture()
  const [text, setText] = useState('')

  async function save() {
    const raw = text.trim()
    if (!raw) return
    setText('')
    try {
      await create.mutateAsync({ raw_text: raw, source: 'ui' })
      toast.success(t('Saved to your inbox', '已存到暫存區'))
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Failed to capture', '暫存失敗'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" /> {t('Capture anything', '隨手暫存')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Jot a loose thought — a task, a note, a trip idea, an expense. Your AI sorts it into the right space later; you don’t pick.',
              '隨手記個念頭 —— 待辦、筆記、旅遊點子、一筆花費。之後你的 AI 會把它分到正確的空間,你不用先選。',
            )}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void save()
            }
          }}
          placeholder={t('buy milk · book a dentist appointment · gym at 19:00…', '買牛奶 · 預約看牙 · 19:00 健身…')}
        />
        <DialogFooter>
          <Link
            to="/tempo"
            search={{ view: 'capture' }}
            onClick={() => onOpenChange(false)}
            className="mr-auto self-center text-[13px] font-medium text-brand-strong hover:underline"
          >
            {t('Open inbox →', '開啟暫存區 →')}
          </Link>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('Close', '關閉')}
          </Button>
          <Button variant="brand" disabled={!text.trim() || create.isPending} onClick={() => void save()}>
            {t('Capture', '暫存')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
