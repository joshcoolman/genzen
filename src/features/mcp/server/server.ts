import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerListImageModels } from './tools/list-image-models'
import { registerListEditModels } from './tools/list-edit-models'
import { registerListRecentGenerations } from './tools/list-recent-generations'
import { registerUploadImage } from './tools/upload-image'
import { registerGenerateImage } from './tools/generate-image'
import { registerEditImage } from './tools/edit-image'

const SERVER_INFO = { name: 'genzen', version: '0.1.0' } as const

export function createMcpServer(userId: string): McpServer {
  const server = new McpServer(SERVER_INFO)
  registerListImageModels(server)
  registerListEditModels(server)
  registerListRecentGenerations(server, userId)
  registerUploadImage(server, userId)
  registerGenerateImage(server, userId)
  registerEditImage(server, userId)
  return server
}
