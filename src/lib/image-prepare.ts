import { appLang } from './utils'

/**
 * Make phone photos uploadable. Camera images are routinely > 5 MB (the bucket
 * limit), iPhones hand over HEIC, and some Android pickers / WebViews give an
 * empty `file.type` — all of which used to fail the upload. Big or exotic
 * images are decoded on-device, downscaled, and re-encoded; small web-friendly
 * ones pass through untouched (GIFs always, to keep animation).
 */

export const UPLOAD_MAX_EDGE = 2048
const PASSTHROUGH_BYTES = 1.5 * 1024 * 1024
const WEB_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']
const EXT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
}

const tt = (en: string, zh: string) => (appLang() === 'zh' ? zh : en)

/** Scale (w, h) down to fit a `max` × `max` box, keeping aspect; never upscales. */
export function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) }
}

/** The file's MIME type, falling back to its extension when the picker left it empty. */
export function guessImageType(file: { type: string; name: string }): string {
  if (file.type) return file.type.toLowerCase()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_TYPES[ext] ?? ''
}

/** Whether the file can be sent as-is (small, web-friendly, or an animated GIF). */
export function canPassThrough(type: string, size: number): boolean {
  if (type === 'image/gif') return true
  return WEB_TYPES.includes(type) && size <= PASSTHROUGH_BYTES
}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void }

async function decode(file: File): Promise<Decoded> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() }
  } catch {
    // Safari decodes HEIC through <img> but not always through createImageBitmap.
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.src = url
    try {
      await img.decode()
    } catch {
      URL.revokeObjectURL(url)
      throw new Error(tt('This image format can’t be read on this device — try a JPEG or PNG.', '這台裝置無法讀取這種圖片格式，請改用 JPEG 或 PNG。'))
    }
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) }
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

export async function prepareImageForUpload(file: File): Promise<File> {
  const type = guessImageType(file)
  if (type && !type.startsWith('image/')) throw new Error(tt('That file isn’t an image.', '這個檔案不是圖片。'))
  if (canPassThrough(type, file.size)) {
    return file.type ? file : new File([file], file.name, { type })
  }

  const img = await decode(file)
  try {
    const { width, height } = fitWithin(img.width, img.height, UPLOAD_MAX_EDGE)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error(tt('Couldn’t process the image — try again.', '無法處理這張圖片，請再試一次。'))
    ctx.drawImage(img.source, 0, 0, width, height)
    // PNGs (screenshots, transparency) → WebP where the browser can encode it;
    // photos → JPEG, which every browser encodes. A browser that can't do WebP
    // silently hands back PNG, so check the result type.
    let blob = type === 'image/png' ? await toBlob(canvas, 'image/webp', 0.9) : null
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', 0.85)
    if (!blob) throw new Error(tt('Couldn’t process the image — try again.', '無法處理這張圖片，請再試一次。'))
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
    const base = file.name.replace(/\.[^.]+$/, '') || 'image'
    return new File([blob], `${base}.${ext}`, { type: blob.type })
  } finally {
    img.close()
  }
}
