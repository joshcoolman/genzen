import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface SaveStyleImageFromLibraryInput {
  accessToken: string
  styleId: string
  sourceStoragePath: string
  source: 'library'
}

interface SaveStyleImageFromUploadInput {
  accessToken: string
  styleId: string
  fileBase64: string
  fileName: string
  mimeType: string
  source: 'upload'
}

interface SaveStyleImageFromUrlInput {
  accessToken: string
  styleId: string
  imageUrl: string
  source: 'url'
}

type SaveStyleImageInput =
  | SaveStyleImageFromLibraryInput
  | SaveStyleImageFromUploadInput
  | SaveStyleImageFromUrlInput

export const saveStyleImage = createServerFn({ method: 'POST' })
  .inputValidator((data: SaveStyleImageInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    // Verify the style belongs to this user
    const { error: styleError } = await supabase
      .from('style_collections')
      .select('id')
      .eq('id', data.styleId)
      .single()

    if (styleError) throw new Error('Style not found or access denied')

    let fileBuffer: Buffer
    let fileName: string
    let mimeType: string

    if (data.source === 'library') {
      // Copy from user-images bucket
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('user-images')
        .download(data.sourceStoragePath)

      if (downloadError)
        throw new Error(
          `Failed to download source image: ${downloadError.message}`,
        )

      fileBuffer = Buffer.from(await fileData.arrayBuffer())
      const ext = data.sourceStoragePath.split('.').pop() ?? 'jpg'
      fileName = `${crypto.randomUUID()}.${ext}`
      mimeType = fileData.type || 'image/jpeg'
    } else if (data.source === 'upload') {
      // Decode base64 upload
      fileBuffer = Buffer.from(data.fileBase64, 'base64')
      const ext = data.fileName.split('.').pop() ?? 'jpg'
      fileName = `${crypto.randomUUID()}.${ext}`
      mimeType = data.mimeType
    } else {
      // Fetch from URL
      const response = await fetch(data.imageUrl)
      if (!response.ok) throw new Error('Failed to fetch image from URL')
      fileBuffer = Buffer.from(await response.arrayBuffer())
      const contentType = response.headers.get('content-type') || 'image/jpeg'
      const ext = contentType.split('/')[1]?.split(';')[0] || 'jpg'
      fileName = `${crypto.randomUUID()}.${ext}`
      mimeType = contentType
    }

    // Upload to styles bucket: {userId}/{styleId}/{fileName}
    const storagePath = `${user.id}/${data.styleId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('styles')
      .upload(storagePath, fileBuffer, { contentType: mimeType })

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

    // Get current image count for sort_order
    const { count } = await supabase
      .from('style_images')
      .select('id', { count: 'exact', head: true })
      .eq('style_id', data.styleId)

    // Insert style_images record
    const { data: styleImage, error: insertError } = await supabase
      .from('style_images')
      .insert({
        style_id: data.styleId,
        storage_path: storagePath,
        source: data.source,
        sort_order: count ?? 0,
      })
      .select()
      .single()

    if (insertError) throw new Error(`Insert failed: ${insertError.message}`)

    // Update image_count on collection
    await supabase
      .from('style_collections')
      .update({
        image_count: (count ?? 0) + 1,
        updated_at: new Date().toISOString(),
        // Set thumbnail if first image
        ...(count === 0 ? { thumbnail_path: storagePath } : {}),
      })
      .eq('id', data.styleId)

    // Return signed URL
    const { data: urlData } = await supabase.storage
      .from('styles')
      .createSignedUrl(storagePath, 3600)

    return {
      image: { ...styleImage, url: urlData?.signedUrl ?? null },
    }
  })
