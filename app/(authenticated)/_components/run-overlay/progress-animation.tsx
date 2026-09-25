'use client'

import { useEffect, useRef, useState } from 'react'
import { useRive } from '@rive-app/react-canvas'
import styles from './progress-animation.module.css'

/**
 * Built from `rive/news-progress/` (`pnpm rive:build`). The names here are
 * that file's contract: artboard and state machine `Progress`, and a view
 * model bound to the artboard with `pulse` (trigger), `count` (0-9), `phase`
 * `total` (slots drawn, 0 = not known yet) and `accent` (color). There are no state machine inputs -- the CLI
 * deprecates them, so `useStateMachineInput` finds nothing in this file.
 */
const SRC = '/rive/news-progress.riv'
const MACHINE = 'Progress'

/** How long a reduced-motion viewer sees a change play before it holds. */
const REDUCED_PLAY_MS = 1200

interface ProgressAnimationProps {
  /** Changes on every real event; each change is one pulse. */
  beat: number
  count: number
  /** How many slots to draw. 0 while it is not known yet. */
  total: number
  /** 0 working, 1 success, 2 failed. */
  phase: number
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

export function ProgressAnimation({
  beat,
  count,
  total,
  phase,
}: ProgressAnimationProps) {
  const [failed, setFailed] = useState(false)
  const reduced = usePrefersReducedMotion()
  const { rive, RiveComponent } = useRive({
    src: SRC,
    artboard: 'Progress',
    stateMachines: MACHINE,
    autoplay: true,
    autoBind: true,
    onLoadError: () => setFailed(true),
  })

  const vm = rive?.viewModelInstance ?? null

  // The user's theme accent, not the file's default green: the six colours
  // are theirs to change (#406). A custom property reads back as authored, so
  // resolve it through a real `color` to get rgb.
  useEffect(() => {
    if (!vm) return
    const probe = document.createElement('span')
    probe.style.color = 'var(--accent)'
    document.body.appendChild(probe)
    const m = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g)
    probe.remove()
    if (m) vm.color('accent')?.rgb(Number(m[0]), Number(m[1]), Number(m[2]))
  }, [vm])

  // Reduced motion: hold still, and let a real change play briefly so the
  // new state is visible, then hold again. No ambient loop, no pulses.
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    if (!rive) return
    if (!reduced) {
      rive.play()
      return
    }
    rive.play()
    clearTimeout(holdTimer.current)
    holdTimer.current = setTimeout(() => rive.pause(), REDUCED_PLAY_MS)
    return () => clearTimeout(holdTimer.current)
  }, [rive, reduced, count, phase])

  useEffect(() => {
    const prop = vm?.number('total')
    if (prop) prop.value = total
  }, [vm, total])

  useEffect(() => {
    const prop = vm?.number('count')
    if (prop) prop.value = count
  }, [vm, count])

  useEffect(() => {
    const prop = vm?.number('phase')
    if (prop) prop.value = phase
  }, [vm, phase])

  useEffect(() => {
    if (beat > 0 && !reduced) vm?.trigger('pulse')?.trigger()
  }, [vm, beat, reduced])

  // The text beside this carries everything; a file that will not load costs
  // only the motion.
  if (failed) return <span className={styles.fallback} aria-hidden="true" />

  return <RiveComponent className={styles.canvas} aria-hidden="true" />
}
