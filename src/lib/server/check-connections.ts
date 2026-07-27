'use server'

import { fal } from '@fal-ai/client'
import { resolveAuth } from '#/lib/server/auth.server'

export async function checkConnections() {
  await resolveAuth()

  const results: {
    fal: { status: 'connected' | 'error'; error?: string }
  } = {
    fal: { status: 'error', error: 'Not checked' },
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

  return results
}
