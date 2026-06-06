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
