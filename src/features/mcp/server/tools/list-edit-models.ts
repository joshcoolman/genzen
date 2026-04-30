import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { EDIT_MODELS } from '@/features/ai-images/models'

export function registerListEditModels(server: McpServer): void {
  server.registerTool(
    'list_edit_models',
    {
      title: 'List image edit models',
      description:
        'Returns the catalog of image edit models the user has access to, each with the maximum number of reference images it accepts.',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () => {
      return Promise.resolve({
        content: [
          { type: 'text' as const, text: JSON.stringify(EDIT_MODELS, null, 2) },
        ],
      })
    },
  )
}
