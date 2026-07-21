import { humanizeError } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Brush, Mic, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateCapture, useSketchSave } from '@/lib/hooks'
import { useI18n, useT } from '@/lib/i18n'
import { ASSISTANT_URL } from '@/lib/endpoints'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { WhiteboardDialog } from '@/components/whiteboard/WhiteboardDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

/** The global front door for a loose thought from any Space. */
export function CaptureDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useT()
  const { lang } = useI18n()
  const navigate = useNavigate()
  const create = useCreateCapture()
  const sketchSave = useSketchSave()
  const [text, setText] = useState('')
  const [boardOpen, setBoardOpen] = useState(false)
  const [mode, setMode] = useState<'capture' | 'assistant'>('capture')
  const [speechSupported, setSpeechSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [assistantPending, setAssistantPending] = useState(false)
  const recognition = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => {
    setSpeechSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition))
    return () => recognition.current?.stop()
  }, [])

  async function save() {
    const raw = text.trim()
    if (!raw) return
    setText('')
    try {
      await create.mutateAsync({ raw_text: raw, source: 'ui' })
      toast.success(t('Saved to your inbox', '已儲存至收件匣'))
      onOpenChange(false)
    } catch (error) {
      toast.error(humanizeError(error, ['Failed to capture', '收集失敗']))
    }
  }

  async function runAssistant(rawText = text.trim()) {
    if (!rawText || !ASSISTANT_URL) {
      if (!ASSISTANT_URL) toast.error(t('Your AI assistant is not configured yet.', '你的 AI 助理尚未設定。'))
      return
    }
    setAssistantPending(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Your session expired')
      const response = await fetch(ASSISTANT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: rawText }),
      })
      const result = (await response.json().catch(() => ({}))) as {
        error?: string
        summary?: string
        actions?: Array<{ summary: string }>
      }
      if (!response.ok) throw new Error(result.error || 'Assistant request failed')
      const summary = result.actions?.map((action) => action.summary).join(' · ') || result.summary || t('Done', '完成')
      toast.success(`${t('Your AI: ', '你的 AI：')}${summary}`)
      setText('')
      await queryClient.invalidateQueries()
      onOpenChange(false)
    } catch (error) {
      toast.error(humanizeError(error, ['Your AI could not complete that.', '你的 AI 無法完成此操作。']))
    } finally {
      setAssistantPending(false)
    }
  }

  function startListening() {
    const Constructor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Constructor) return
    recognition.current?.stop()
    const next = new Constructor()
    recognition.current = next
    next.lang = lang === 'zh' ? 'zh-TW' : 'en-US'
    next.interimResults = false
    next.continuous = false
    next.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? '').join(' ').trim()
      if (!transcript) return
      setText(transcript)
      if (mode === 'assistant') void runAssistant(transcript)
    }
    next.onerror = () => toast.error(t('Could not hear that. Try again.', '無法聽清楚，請再試一次。'))
    next.onend = () => setListening(false)
    setListening(true)
    next.start()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-brand" /> {t('Capture anything', '收集任何想法')}
            </DialogTitle>
            <DialogDescription>
              {t('Jot a loose thought — a task, note, trip idea, or expense. Your AI can file it into the right space hands-free.', '記下待辦、筆記、旅行想法或支出；你的 AI 可以免手動幫你放進正確的空間。')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <button type="button" onClick={() => setBoardOpen(true)} className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-[13px] text-muted-foreground transition hover:border-brand/40 hover:text-foreground">
              <Brush className="size-4 text-brand" /> {t('Sketch on a quick whiteboard', '快速白板塗鴉')}
            </button>
            {speechSupported && (
              <Button type="button" variant="outline" size="icon" onClick={startListening} disabled={listening || assistantPending} aria-label={t('Speak your request', '說出你的需求')}>
                <Mic className={listening ? 'size-4 animate-pulse text-brand' : 'size-4 text-brand'} />
              </Button>
            )}
          </div>
          <div className="flex gap-4 border-b border-border text-[13px] font-medium" role="tablist" aria-label={t('Capture mode', '收集模式')}>
            <button type="button" role="tab" aria-selected={mode === 'capture'} onClick={() => setMode('capture')} className={`-mb-px border-b-2 pb-2 ${mode === 'capture' ? 'border-brand text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {t('Just capture', '只收集')}
            </button>
            <button type="button" role="tab" aria-selected={mode === 'assistant'} onClick={() => setMode('assistant')} className={`-mb-px border-b-2 pb-2 ${mode === 'assistant' ? 'border-brand text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {t('Do it now', '立即完成')}
            </button>
          </div>
          <Textarea
            autoFocus
            rows={3}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void (mode === 'assistant' ? runAssistant() : save())
              }
            }}
            placeholder={t('buy milk · book a dentist appointment · gym at 19:00', '買牛奶 · 預約牙醫 · 晚上 19:00 健身')}
          />
          <DialogFooter>
            <Link to="/tempo" search={{ view: 'capture' }} onClick={() => onOpenChange(false)} className="mr-auto self-center text-[13px] font-medium text-brand-strong hover:underline">
              {t('Open inbox →', '開啟收件匣 →')}
            </Link>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('Close', '關閉')}</Button>
            <Button variant="brand" disabled={!text.trim() || create.isPending || assistantPending} onClick={() => void (mode === 'assistant' ? runAssistant() : save())}>
              {mode === 'assistant' ? t('Do it now', '立即完成') : t('Capture', '收集')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <WhiteboardDialog
        open={boardOpen}
        onOpenChange={setBoardOpen}
        onSave={async (blob, scene) => {
          await sketchSave.create(blob, scene)
          setBoardOpen(false)
          onOpenChange(false)
          toast.success(t('Sketch saved', '塗鴉已儲存'), {
            action: {
              label: t('View', '查看'),
              onClick: () => {
                try { localStorage.setItem('mnema:notes-view', 'sketches') } catch { /* ignore */ }
                navigate({ to: '/notes' })
              },
            },
          })
        }}
      />
    </>
  )
}
