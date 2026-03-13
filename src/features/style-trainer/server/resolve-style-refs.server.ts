/**
 * Resolves a style collection into FAL-uploadable reference image URLs.
 * Fetches all images from the styles bucket, optionally composes contact
 * sheets for large collections, and uploads to FAL storage.
 */
import { createClient } from '@supabase/supabase-js'
import { composeStyleSheets } from './compose-style-sheet.server'
import { uploadBufferToFal } from '@/lib/server/fal-image-upload.server'

interface ResolveStyleRefsOptions {
  accessToken: string
  styleId: string
}

/**
 * Returns an array of FAL storage URLs that can be passed as reference images.
 */
export async function resolveStyleRefs(
  opts: ResolveStyleRefsOptions,
): Promise<Array<string>> {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${opts.accessToken}` },
      },
    },
  )

  // Fetch all style images
  const { data: images, error } = await supabase
    .from('style_images')
    .select('storage_path')
    .eq('style_id', opts.styleId)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(`Failed to fetch style images: ${error.message}`)
  if (!images.length) return []

  // Download all images from styles bucket
  const buffers: Array<Buffer> = []
  for (const img of images) {
    const { data: fileData, error: dlError } = await supabase.storage
      .from('styles')
      .download(img.storage_path)

    if (dlError) {
      console.error(`Skipping image ${img.storage_path}: ${dlError.message}`)
      continue
    }
    buffers.push(Buffer.from(await fileData.arrayBuffer()))
  }

  if (buffers.length === 0) return []

  // Compose into sheets if needed (or pass through if <=14)
  const sheets = await composeStyleSheets(buffers)

  // Upload each sheet/image to FAL storage
  const falUrls = await Promise.all(
    sheets.map((buf) => uploadBufferToFal(buf.buffer as ArrayBuffer)),
  )

  return falUrls
}
