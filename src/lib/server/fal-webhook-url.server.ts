/**
 * Where FAL calls back, or `undefined` to run on polling instead.
 *
 * **Both conditions, and the flag is the deliberate one.** `ENABLE_FAL_WEBHOOKS`
 * used to be read by nothing at all: `APP_URL` alone decided, so setting a
 * public URL for any ordinary reason silently switched webhooks on while a
 * variable named `ENABLE_FAL_WEBHOOKS=false` sat in the deploy config looking
 * authoritative (#228). On a hosted deployment that is the normal case, not an
 * edge one.
 *
 * It also has to agree with `NEXT_PUBLIC_ENABLE_FAL_WEBHOOKS`, which is what
 * stops the client polling. Disagreeing does not break anything -- both paths
 * reconcile the same generation and the row settles once -- but it means every
 * result is fetched twice.
 *
 * Server-only, so `APP_URL` needs no browser prefix; the `VITE_APP_URL` fallback
 * went with #225, having never been read by a client.
 */
export function getFalWebhookUrl(): string | undefined {
  if (process.env.ENABLE_FAL_WEBHOOKS !== 'true') return undefined

  const appUrl = process.env.APP_URL?.replace(/\/+$/, '')
  if (!appUrl) {
    console.warn(
      '[fal-webhook] ENABLE_FAL_WEBHOOKS is true but APP_URL is unset -- falling back to polling',
    )
    return undefined
  }

  const url = `${appUrl}/api/fal-webhook`
  console.log(`[fal-webhook] url=${url}`)
  return url
}
