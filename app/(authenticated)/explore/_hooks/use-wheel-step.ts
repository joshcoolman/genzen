'use client'

import { useEffect, useRef } from 'react'

/** A notch on a mouse is one ~100px event; a trackpad emits a stream of 1-4px
 *  ones. This is the budget one image costs -- low enough that a notch always
 *  pays it in one go, high enough that a trackpad takes a deliberate push. */
const STEP_PX = 55

/** Floor on the time between steps. An inertia tail runs for about a second
 *  after the fingers lift and would otherwise fly through forty images. */
const MIN_INTERVAL_MS = 80

/** `deltaMode` 1 is lines and 2 is pages. Firefox on some mice reports lines,
 *  where a raw delta of 3 means three lines, not three pixels. */
const DELTA_SCALE = [1, 16, 100]

export interface WheelStepper {
  /** Returns -1, 0 or 1: how far to move for this event. */
  push: (deltaY: number, deltaMode: number, now: number) => number
}

/**
 * Turns a stream of wheel events into single steps.
 *
 * Pure and stateful-in-a-closure so it can be tested without a DOM. The rules,
 * in the order they matter:
 *
 * - deltas accumulate against a pixel budget rather than counting events, or a
 *   trackpad flick would move forty images and a mouse notch one
 * - reversing direction drops the accumulator, so a flick back the other way
 *   answers immediately instead of first paying off what it had banked
 * - a step resets the budget to zero rather than subtracting it, since a
 *   remainder plus an inertia tail refills instantly and reads as a slip
 * - and nothing steps twice inside `MIN_INTERVAL_MS`, which is what keeps
 *   momentum scrolling from outrunning the eye
 */
export function createWheelStepper(
  stepPx = STEP_PX,
  minIntervalMs = MIN_INTERVAL_MS,
): WheelStepper {
  let acc = 0
  let lastStepAt = -Infinity

  return {
    push(deltaY, deltaMode, now) {
      const px = deltaY * (DELTA_SCALE[deltaMode] ?? 1)
      if (px === 0) return 0

      if (Math.sign(px) !== Math.sign(acc)) acc = 0
      acc += px

      if (Math.abs(acc) < stepPx) return 0
      if (now - lastStepAt < minIntervalMs) return 0

      const direction = acc > 0 ? 1 : -1
      acc = 0
      lastStepAt = now
      return direction
    },
  }
}

/**
 * Wheel over the whole overlay steps the selection, Midjourney-style.
 *
 * Bound on the root rather than on the filmstrip so the gesture works with the
 * pointer anywhere -- which is most of what makes the overlay feel like a
 * viewer instead of a scroll region. `passive: false` because the point is to
 * take the event: without `preventDefault` the rail scrolls itself away from
 * the image you are looking at, which is worse than doing nothing.
 *
 * `active` tells the caller a gesture is in flight, so the filmstrip can
 * position instantly instead of restarting a smooth scroll on every step.
 */
export function useWheelStep(
  ref: React.RefObject<HTMLElement | null>,
  onStep: (direction: 1 | -1) => void,
  onActiveChange?: (active: boolean) => void,
) {
  const onStepRef = useRef(onStep)
  onStepRef.current = onStep
  const onActiveRef = useRef(onActiveChange)
  onActiveRef.current = onActiveChange

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const stepper = createWheelStepper()
    let idleTimer: ReturnType<typeof setTimeout> | undefined

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      onActiveRef.current?.(true)
      clearTimeout(idleTimer)
      // The gesture is over when the events stop, and only then: a trackpad
      // pauses between pushes without the hand ever leaving the glass.
      idleTimer = setTimeout(() => onActiveRef.current?.(false), 180)

      const direction = stepper.push(e.deltaY, e.deltaMode, performance.now())
      if (direction !== 0) onStepRef.current(direction as 1 | -1)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      clearTimeout(idleTimer)
    }
  }, [ref])
}
