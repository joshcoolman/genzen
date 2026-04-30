import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin.server'

const KindEnum = z.enum(['ai_generated', 'uploaded', 'all']).default('all')

const inputSchema = {
  limit: z.number().int().min(1).max(50).default(10),
  kind: KindEnum.optional(),
}

export function registerListRecentGenerations(
  server: McpServer,
  userId: string,
): void {
  server.registerTool(
    'list_recent_generations',
    {
      title: 'List recent generations',
      description:
        "Returns the user's most recent images and uploads (newest first). Filter by `kind`: ai_generated, uploaded, or all (default). Each item includes id, title, status, model, prompt, source, created_at, and a public URL when one exists.",
      inputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ limit, kind }) => {
      const supabase = getSupabaseAdmin()
      let query = supabase
        .from('user_images')
        .select(
          'id, title, status, source, generation_metadata, storage_path, created_at, deleted_at',
        )
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (kind && kind !== 'all') {
        query = query.eq('source', kind)
      }

      const { data, error } = await query
      if (error)
        throw new Error(`list_recent_generations failed: ${error.message}`)

      const r2PublicUrl = process.env.VITE_R2_PUBLIC_URL ?? ''
      const items = data.map((row) => {
        const meta = (row.generation_metadata ?? {}) as Record<string, unknown>
        const publicUrl =
          row.storage_path && r2PublicUrl
            ? `${r2PublicUrl.replace(/\/$/, '')}/${row.storage_path}`
            : null
        return {
          id: row.id,
          title: row.title,
          status: row.status,
          source: row.source,
          model: typeof meta.model === 'string' ? meta.model : null,
          prompt: typeof meta.prompt === 'string' ? meta.prompt : null,
          generation_type:
            typeof meta.generation_type === 'string'
              ? meta.generation_type
              : null,
          created_at: row.created_at,
          url: publicUrl,
        }
      })

      return {
        content: [{ type: 'text', text: JSON.stringify(items, null, 2) }],
      }
    },
  )
}
