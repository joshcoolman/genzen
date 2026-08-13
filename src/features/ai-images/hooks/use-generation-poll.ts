'use client'

import { useEffect, useRef } from 'react'
import { checkPendingGenerations } from '#/lib/server/check-pending-generations.action'

/**
 * The one poll that carries a generation to its outcome (#327).
 *
 * Nothing pushes: `user_images` is in no publication and the browser has had no
 * Supabase session since #171, so a timer is how the app finds out FAL
 * finished. Three routes wanted that timer -- Images, Video and Activity --
 * and each had written its own `setInterval(..., 5000)`. They agreed on the
 * interval and on nothing else, which is why the fixes below had to be made
 * three times or not at all.
 *
 * Three things it does that a bare interval did not:
 *
 * - **Backs off.** Five seconds is right for the first minute of a generation
 *   and pointless after it. A clip that takes four minutes was checked fifty
 *   times, and forty-five of those answers were "still working".
 * - **Stops when the tab is hidden.** A backgrounded tab used to poll FAL all
 *   afternoon. Coming back checks immediately, so nothing is lost by pausing.
 * - **Stops when the server says nothing is pending.** The action now reports
 *   what is still in flight after its own pass, so a row it gave up on ends the
 *   loop in the same tick it failed -- rather than the loop running until a
 *   re-read happens to notice.
 *
 * A server action, so every tick also re-renders the route (#328). That is the
 * other half of why this backs off, and why it stops rather than idling.
 *
 * @param pendingSince `created_at` of the oldest pending row, or null when
 *   nothing is pending. A timestamp rather than a boolean because it is what
 *   the backoff reads -- and being a stable string, it does not restart the
 *   loop on every render the way a fresh object would.
 * @param onSettled Something settled: re-read whatever this route renders.
 *
 * Two positional arguments rather than one options object: Next's
 * serializable-props lint reads an exported function in a `'use client'` module
 * as a component, and warns that `onSettled` is not a Server Action.
 */
export function useGenerationPoll(
  pendingSince: string | null,
  onSettled: () => void | Promise<void>,
) {
  // Held in a ref so a caller passing an inline closure does not tear the timer
  // down and start a fresh one on every render.
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  useEffect(() => {
    if (!pendingSince) return

    const startedAt = new Date(pendingSince).getTime()
    let timer: ReturnType<typeof setTimeout> | null = null
    // An AbortController rather than a `let stopped = false`: the flag is read
    // after an `await`, where TypeScript's flow analysis still believes the
    // initialiser and calls the check dead code. `signal.aborted` says the same
    // thing and is honest about being able to change underfoot.
    const done = new AbortController()

    /** Young work is worth watching closely; old work is not. */
    function nextDelay(): number {
      const age = Date.now() - startedAt
      if (age < 60_000) return 5_000
      if (age < 5 * 60_000) return 15_000
      return 30_000
    }

    function schedule() {
      if (done.signal.aborted || document.hidden) return
      timer = setTimeout(() => void tick(), nextDelay())
    }

    async function tick() {
      if (done.signal.aborted || document.hidden) return
      try {
        const result = await checkPendingGenerations()
        // No abort check here on purpose: a tick that lands after the effect
        // tore down still has a real answer, and its `onSettled` is a refresh
        // whose setState on an unmounted caller is a no-op. What must not
        // happen is scheduling another one, which `schedule()` refuses.
        if (result.completed > 0 || result.failed > 0) {
          await onSettledRef.current()
        }
        // Nothing left in flight: the caller's own state will drop
        // `pendingSince` on the refresh above, but stopping here means the
        // last tick is the last tick even if it does not.
        if (result.pending === 0) {
          done.abort()
          return
        }
      } catch {
        // A failed tick is not worth a toast -- the next one re-checks.
      }
      schedule()
    }

    // The first check is immediate: a generation submitted a moment ago is the
    // most likely thing to have finished.
    void tick()

    function onVisibility() {
      if (document.hidden) {
        if (timer) clearTimeout(timer)
        timer = null
      } else if (!done.signal.aborted && !timer) {
        void tick()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      done.abort()
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [pendingSince])
}
