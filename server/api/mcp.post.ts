import { defineEventHandler } from 'h3'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createMcpServer } from '@/features/mcp/server/server'
import { verifyApiKey } from '@/lib/server/api-keys.server'

function jsonRpcError(status: number, code: number, message: string): Response {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }),
    {
      status,
      headers: {
        'content-type': 'application/json',
        ...(status === 401
          ? { 'www-authenticate': 'Bearer realm="genzen"' }
          : {}),
      },
    },
  )
}

export default defineEventHandler(async (event) => {
  const request = event.req
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return jsonRpcError(401, -32001, 'Missing or invalid Authorization header')
  }

  const rawKey = auth.slice('Bearer '.length).trim()
  let userId: string
  try {
    const verified = await verifyApiKey({ rawKey })
    userId = verified.userId
  } catch {
    return jsonRpcError(401, -32001, 'Invalid or revoked API key')
  }

  const server = createMcpServer(userId)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  try {
    await server.connect(transport)
    return await transport.handleRequest(request)
  } finally {
    await server.close().catch(() => {})
  }
})
