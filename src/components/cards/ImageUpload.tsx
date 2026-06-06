import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { uploadImage } from '@/lib/upload'
import { useT } from '@/lib/i18n'

/** Pick → upload → preview → remove. `value` is the public URL (or null). */
export function ImageUpload({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const t = useT()
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function pick(file?: File) {
    if (!file) return
    setBusy(true)
    try {
      onChange(await uploadImage(file))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Upload failed', '上傳失敗'))
    } finally {
      setBusy(false)
      if (ref.current) ref.current.value = ''
    }
  }

  return (
    <div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt="" className="max-h-40 rounded-lg border border-border object-contain" />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={t('Remove image', '移除圖片')}
            className="absolute -right-2 -top-2 rounded-full border border-border bg-card p-1 text-muted-foreground shadow-soft transition hover:text-destructive"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-[13px] text-muted-foreground transition hover:border-brand/50 hover:text-brand disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {busy ? t('Uploading…', '上傳中…') : t('Add image', '加入圖片')}
        </button>
      )}
    </div>
  )
}
