import { supabase } from './supabase'

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']
const MAX_BYTES = 5 * 1024 * 1024 // mirrors the bucket's file_size_limit

/**
 * Upload an image to the public `uploads` bucket under the user's own folder
 * ({uid}/…, enforced by RLS) and return its public URL. Used by image cards;
 * reusable for any future attachment surface.
 */
export async function uploadImage(file: File): Promise<string> {
  if (!ALLOWED.includes(file.type)) throw new Error('Unsupported image type (PNG, JPEG, WebP, GIF, or AVIF)')
  if (file.size > MAX_BYTES) throw new Error('Image too large (max 5 MB)')

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const uid = session?.user?.id
  if (!uid) throw new Error('Not signed in')

  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const key = `${uid}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from('uploads').upload(key, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return supabase.storage.from('uploads').getPublicUrl(key).data.publicUrl
}

/**
 * Best-effort storage cleanup: delete the object behind a public `uploads` URL.
 * Silently no-ops on URLs that don't belong to our bucket and swallows every
 * error — an orphaned object is never worth blocking or surfacing a failure.
 * Fire-and-forget AFTER the referencing row is actually gone (mind undo windows).
 */
export async function removeUploadedImage(url: string): Promise<void> {
  try {
    // Derive the exact public-URL prefix uploadImage() produces (probe trick:
    // immune to trailing-slash differences across storage-js versions).
    const probe = supabase.storage.from('uploads').getPublicUrl('probe').data.publicUrl
    if (!probe.endsWith('probe')) return
    const prefix = probe.slice(0, -'probe'.length)
    if (!url.startsWith(prefix)) return // not ours (external image, other bucket…)
    const key = decodeURIComponent(url.slice(prefix.length).split(/[?#]/)[0])
    if (!key) return
    await supabase.storage.from('uploads').remove([key])
  } catch {
    // best-effort only
  }
}
