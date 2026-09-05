/** Next's internal request URL can name the listening socket behind a proxy.
 * Railway preserves the public host and supplies the original HTTPS scheme. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin || origin === 'null') return false
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const protocol = request.headers.get('x-forwarded-proto')
  if (!host) return origin === new URL(request.url).origin
  if (host.includes(',') || (protocol && !['http', 'https'].includes(protocol)))
    return false
  try {
    const expected = new URL(
      `${protocol ?? new URL(request.url).protocol.slice(0, -1)}://${host}`,
    )
    return (
      !expected.username &&
      !expected.password &&
      expected.host === host &&
      origin === expected.origin
    )
  } catch {
    return false
  }
}
