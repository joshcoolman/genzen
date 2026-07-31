/** Where FAL calls back. Server-only, so `APP_URL` needs no browser prefix --
 *  the `VITE_APP_URL` fallback went with #225, having never been read by a
 *  client. Required for any deployment that turns webhooks on. */
export function getFalWebhookUrl(): string | undefined {
  const appUrl = process.env.APP_URL?.replace(/\/+$/, '')
  if (!appUrl) return undefined
  const url = `${appUrl}/api/fal-webhook`
  console.log(`[fal-webhook] url=${url}`)
  return url
}
