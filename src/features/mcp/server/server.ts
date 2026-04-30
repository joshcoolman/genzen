import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerListImageModels } from './tools/list-image-models'
import { registerListEditModels } from './tools/list-edit-models'
import { registerGetCreditBalance } from './tools/get-credit-balance'
import { registerListRecentGenerations } from './tools/list-recent-generations'

const SERVER_INFO = { name: 'genzen', version: '0.1.0' } as const

export function createMcpServer(userId: string): McpServer {
  const server = new McpServer(SERVER_INFO)
  registerListImageModels(server)
  registerListEditModels(server)
  registerGetCreditBalance(server, userId)
  registerListRecentGenerations(server, userId)
  return server
}
