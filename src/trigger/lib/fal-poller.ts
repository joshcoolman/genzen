import { fal } from '@fal-ai/client'
import { wait } from '@trigger.dev/sdk/v3'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

const MAX_ITERATIONS = 200 // ~10 min at 3s intervals

export async function pollFalResult(
  falModelId: string,
  requestId: string,
): Promise<{ data: Record<string, unknown> }> {
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const status = await fal.queue.status(falModelId, {
      requestId,
      logs: false,
    })

    if (status.status === 'COMPLETED') {
      const result = await fal.queue.result(falModelId, { requestId })
      return result as { data: Record<string, unknown> }
    }

    const statusStr = status.status as string
    if (statusStr !== 'IN_QUEUE' && statusStr !== 'IN_PROGRESS') {
      throw new Error(`FAL job ${statusStr}`)
    }

    await wait.for({ seconds: 3 })
  }

  throw new Error('FAL job timed out after 10 minutes')
}
