export function getFalWebhookUrl(): string | undefined {
  if (process.env.ENABLE_FAL_WEBHOOKS !== 'true') return undefined
  const appUrl = process.env.VITE_APP_URL?.replace(/\/+$/, '')
  if (!appUrl) return undefined
  const url = `${appUrl}/api/fal-webhook`
  console.log(`[fal] webhookUrl=${url}`)
  return url
}
