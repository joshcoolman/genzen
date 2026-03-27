export function getFalWebhookUrl(): string | undefined {
  const appUrl = (process.env.APP_URL || process.env.VITE_APP_URL)?.replace(
    /\/+$/,
    '',
  )
  if (!appUrl) return undefined
  const url = `${appUrl}/api/fal-webhook`
  console.log(`[fal-webhook] url=${url}`)
  return url
}
