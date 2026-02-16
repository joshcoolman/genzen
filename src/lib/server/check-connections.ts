import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'

export const checkConnections = createServerFn({ method: 'GET' }).handler(
  async () => {
    const results: {
      fal: { status: 'connected' | 'error'; error?: string }
      trigger: { status: 'connected' | 'error'; error?: string }
    } = {
      fal: { status: 'error', error: 'Not checked' },
      trigger: { status: 'error', error: 'Not checked' },
    }

    // Check FAL connection
    try {
      const falKey = process.env.FAL_KEY
      if (!falKey) {
        results.fal = { status: 'error', error: 'FAL_KEY not configured' }
      } else {
        fal.config({ credentials: falKey })
        // Just check if we can access the API - use a lightweight call
        await fal.queue.status('fal-ai/flux/schnell', {
          requestId: 'test-connection-check',
          logs: false,
        })
        // If we get here without auth error, connection works
        // (will get 404 for fake requestId, but that's fine - means auth worked)
        results.fal = { status: 'connected' }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      const lowerMessage = message.toLowerCase()
      // 404 or "not found" means auth worked but request doesn't exist - that's fine
      if (
        lowerMessage.includes('not found') ||
        lowerMessage.includes('not_found') ||
        lowerMessage.includes('404') ||
        lowerMessage.includes('request_id')
      ) {
        results.fal = { status: 'connected' }
      } else {
        results.fal = { status: 'error', error: message }
      }
    }

    // Check Trigger.dev connection
    try {
      const triggerKey = process.env.TRIGGER_SECRET_KEY
      if (!triggerKey) {
        results.trigger = {
          status: 'error',
          error: 'TRIGGER_SECRET_KEY not configured',
        }
      } else {
        // Check if the key format is valid (starts with tr_dev_ or tr_prod_)
        if (
          triggerKey.startsWith('tr_dev_') ||
          triggerKey.startsWith('tr_prod_')
        ) {
          results.trigger = { status: 'connected' }
        } else {
          results.trigger = { status: 'error', error: 'Invalid key format' }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      results.trigger = { status: 'error', error: message }
    }

    return results
  },
)
