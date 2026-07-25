import crypto from 'node:crypto'
import { z } from 'zod'
import { buildPublicUrl } from '../wait-for-generation'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { uploadImageInternal } from '@/features/user-images/server/upload-image-internal.server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin.server'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

const inputSchema = {
  base64Data: z
    .string()
    .min(1)
    .describe(
      'Base64-encoded image bytes. Standard base64 (no `data:` prefix). JPEG, PNG, WebP, or GIF.',
    ),
  fileName: z
    .string()
    .min(1)
    .max(200)
    .describe('Original filename, used as the title and for display.'),
  contentType: z
    .string()
    .optional()
    .describe(
      'Optional MIME type hint (e.g. image/png). The server validates magic bytes and may override.',
    ),
}

function extFromContentType(contentType: string): string {
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/webp') return 'webp'
  if (contentType === 'image/gif') return 'gif'
  return 'jpg'
}

export function registerUploadImage(server: McpServer, userId: string): void {
  server.registerTool(
    'upload_image',
    {
      title: 'Upload an image',
      description:
        "Uploads a base64-encoded image into the user's Genzen library. Use this when you have a local image (e.g. from the user's filesystem) that you want to reference as a source or reference image in `generate_image` or `edit_image`. Returns the imageId you can pass to those tools and a public URL.",
      inputSchema,
    },
    async ({ base64Data, fileName, contentType }) => {
      const cleaned = base64Data.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(cleaned, 'base64')
      if (buffer.length === 0) {
        throw new Error('Decoded image is empty — base64 data is invalid')
      }
      if (buffer.length > MAX_BYTES) {
        throw new Error(
          `Image is ${(buffer.length / 1024 / 1024).toFixed(1)} MB, exceeds the 10 MB upload limit`,
        )
      }

      const detectedType = contentType ?? 'image/jpeg'
      const ext = extFromContentType(detectedType)
      const timestamp = Date.now()
      const uuid = crypto.randomUUID()
      const sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 100)
      const storagePath = `${userId}/mcp_${timestamp}_${uuid}_${sanitized}.${ext}`

      // uploadImageInternal validates magic bytes + size and writes to R2
      await uploadImageInternal({
        userId,
        storagePath,
        base64Data: cleaned,
        contentType: detectedType,
      })

      const fileHash = crypto.createHash('sha256').update(buffer).digest('hex')

      const supabase = getSupabaseAdmin()
      const { data: row, error } = await supabase
        .from('user_images')
        .insert({
          user_id: userId,
          title: fileName,
          source: 'uploaded',
          storage_path: storagePath,
          file_name: fileName,
          file_size: buffer.length,
          mime_type: detectedType,
          file_hash: fileHash,
          generation_metadata: { source_client: 'mcp' },
        })
        .select('id')
        .single()

      if (error) {
        throw new Error(`Failed to record uploaded image: ${error.message}`)
      }

      const result = {
        imageId: row.id,
        url: buildPublicUrl(storagePath),
        fileName,
        sizeBytes: buffer.length,
      }
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(result, null, 2) },
        ],
      }
    },
  )
}
