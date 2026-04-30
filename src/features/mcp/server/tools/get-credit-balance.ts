import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { DOLLARS_PER_CREDIT, getCreditRepository } from '@/features/credits'

export function registerGetCreditBalance(
  server: McpServer,
  userId: string,
): void {
  server.registerTool(
    'get_credit_balance',
    {
      title: 'Get credit balance',
      description:
        "Returns the user's current Genzen credit balance and its dollar value. One credit is currently $0.10. Use this before generation tools to check whether the user has enough credits.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const balance = await getCreditRepository().getBalance(userId)
      const result = {
        balance,
        dollarsValue: Number((balance * DOLLARS_PER_CREDIT).toFixed(2)),
        dollarsPerCredit: DOLLARS_PER_CREDIT,
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    },
  )
}
