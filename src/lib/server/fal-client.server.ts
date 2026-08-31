import 'server-only'
import { fal } from '@fal-ai/client'
import { falFetch } from './fal-fetch.server'

/**
 * The configured FAL client, and the only one (#556).
 *
 * `fal.config` was called in six modules with the same credentials line copied
 * into each. That was harmless while credentials were the only setting; it
 * stopped being harmless the moment a second one mattered, because a seventh
 * call site added the credentials it could see and silently missed the
 * transport -- and the failure it produces is a generation that cannot reach
 * FAL at all, hours after the server started.
 *
 * Import `fal` from here rather than from `@fal-ai/client`. The credentials are
 * read per request, so this is safe at module scope even though `FAL_KEY` is
 * not there at build time.
 */
fal.config({
  credentials: () => process.env.FAL_KEY ?? '',
  fetch: falFetch,
})

export { fal }
