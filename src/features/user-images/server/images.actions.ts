'use server'

import type { UserImage } from '../types'
import { resolveAuth } from '@/lib/server/auth.server'

// Server actions for the image queries the browser used to run directly against
// Supabase.
//
// The important change is not the transport, it is where `user_id` comes from.
// Every one of these previously took the id from the browser and trusted RLS to
// check it; here it comes from `resolveAuth()`, which reads the signed session
// cookie. A caller cannot ask for someone else's rows, because it never gets to
// name whose rows it wants.

export interface ListImagesFilters {
  search_term?: string
  limit?: number
  offset?: number
}

export async function listImages(
  filters?: ListImagesFilters,
): Promise<Array<UserImage>> {
  const { userId, supabase } = await resolveAuth()

  let query = supabase
    .from('user_images')
    .select('*')
    .eq('user_id', userId)
    .in('source', ['upload', 'ai_generated'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (filters?.search_term) {
    const pattern = `%${filters.search_term}%`
    query = query.or(`title.ilike.${pattern},description.ilike.${pattern}`)
  }
  if (filters?.limit !== undefined) {
    const offset = filters.offset ?? 0
    query = query.range(offset, offset + filters.limit - 1)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as Array<UserImage>
}

export interface CreateImageRecordInput {
  title: string
  description?: string | null
  storagePath: string
  fileName: string
  fileSize: number
  mimeType: string
  fileHash?: string
}

export async function createImageRecord(
  input: CreateImageRecordInput,
): Promise<UserImage> {
  const { userId, supabase } = await resolveAuth()

  // The path is built client-side but must still be inside this user's prefix,
  // or one user could write a row pointing at another's object.
  if (!input.storagePath.startsWith(`${userId}/`)) {
    throw new Error('Storage path must be scoped to the authenticated user')
  }

  const { data, error } = await supabase
    .from('user_images')
    .insert({
      user_id: userId,
      title: input.title,
      description: input.description ?? null,
      storage_path: input.storagePath,
      file_name: input.fileName,
      file_size: input.fileSize,
      mime_type: input.mimeType,
      file_hash: input.fileHash,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as UserImage
}

export async function updateImageMeta(
  id: string,
  title: string,
  description: string | null,
): Promise<UserImage> {
  const { userId, supabase } = await resolveAuth()
  const { data, error } = await supabase
    .from('user_images')
    .update({ title, description })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as UserImage
}

export async function softDeleteImage(id: string): Promise<void> {
  const { userId, supabase } = await resolveAuth()
  const { error } = await supabase
    .from('user_images')
    .update({ deleted_at: new Date().toISOString(), on_canvas: false })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}

export async function updateImageDescription(
  id: string,
  description: string,
): Promise<void> {
  const { userId, supabase } = await resolveAuth()
  const { error } = await supabase
    .from('user_images')
    .update({ description })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}
