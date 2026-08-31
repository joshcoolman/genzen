import 'server-only'
import { Agent, fetch as undiciFetch } from 'undici'

/**
 * FAL gets its own HTTP transport, with **HTTP/2 off** (#556).
 *
 * Node 26's built-in `fetch` negotiates HTTP/2 and pools the session. When one
 * of those sessions is destroyed -- a GOAWAY, an idle timeout, anything the far
 * end decides -- the dead session can stay in the pool and every request
 * dispatched onto it fails with `ERR_HTTP2_INVALID_SESSION` behind Node's
 * uniform "fetch failed". A server that has been up a while then cannot reach
 * FAL at all, while a process started seconds ago talks to it fine.
 *
 * **Retrying does not clear it**, which is the part that took a second round to
 * learn: three attempts with backoff came back with the same destroyed session
 * every time, so `withNetworkRetry` alone left a dev server needing a restart
 * and would have left the deployed one needing a redeploy. The corrupted TLS
 * record that followed (`bad record mac`) is the same family of problem --
 * several large uploads multiplexed onto one connection.
 *
 * So this is not a workaround for a retry that fails; it removes the multiplex.
 * One connection carries one request at a time, which is how the uploads
 * behaved before Node started negotiating h2, and the retry above it now covers
 * the ordinary resets it was written for rather than a permanently poisoned
 * pool.
 *
 * `undici` is a direct dependency for exactly this: Node ships its own copy but
 * exposes no way to configure the dispatcher behind the global `fetch`, and
 * reaching into that copy would be a trick rather than a seam. This one is
 * server-only and touches nothing but FAL -- every other `fetch` in the app is
 * unchanged.
 */
const falAgent = new Agent({
  allowH2: false,
  // Uploads are multi-megabyte and FAL is not always quick to answer; the
  // defaults are tuned for small requests.
  headersTimeout: 120_000,
  bodyTimeout: 300_000,
  connect: { timeout: 30_000 },
})

/** Hand this to `fal.config({ fetch })`. Typed through the global `fetch`
 *  signature because that is what the client's option declares; undici's own
 *  Request/Response are structurally the same objects at runtime. */
export const falFetch = ((input: unknown, init?: Record<string, unknown>) =>
  undiciFetch(
    input as Parameters<typeof undiciFetch>[0],
    {
      ...init,
      dispatcher: falAgent,
    } as Parameters<typeof undiciFetch>[1],
  )) as unknown as typeof fetch
