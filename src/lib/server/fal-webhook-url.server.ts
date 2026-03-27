export function getFalWebhookUrl(): string | undefined {
  const appUrl = process.env.VITE_APP_URL?.replace(/\/+$/, '')
  if (!appUrl) return undefined
  return `${appUrl}/api/fal-webhook`
}
