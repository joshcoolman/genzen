'use client'

import { useCallback, useEffect, useState } from 'react'

export interface ModifierState {
  /** Cmd on a Mac, Ctrl elsewhere. */
  meta: boolean
  shift: boolean
}

const NONE: ModifierState = { meta: false, shift: false }

/**
 * Which modifiers are held, tracked only while `active`.
 *
 * For surfaces that rename themselves under a modifier -- a hint that reads
 * "Copy" until Cmd is down and "Load Prompt" after. Pass `active` as "this one
 * is hovered or focused": a grid renders dozens of these, and a permanent key
 * listener per card to answer a question nobody is asking is the kind of cost
 * that stays invisible until the grid is long.
 *
 * Call `seed` from the entering pointer event -- a key already down fired its
 * keydown long before the pointer arrived, so the listeners alone would say no
 * until it is released and pressed again. It writes the same state, so the next
 * keyup corrects it like any other.
 */
export function useModifierHeld(
  active: boolean,
): ModifierState & { seed: (e: MouseEvent | React.MouseEvent) => void } {
  const [held, setHeld] = useState<ModifierState>(NONE)

  useEffect(() => {
    if (!active) {
      setHeld(NONE)
      return
    }
    const sync = (e: KeyboardEvent) =>
      setHeld({ meta: e.metaKey || e.ctrlKey, shift: e.shiftKey })
    // A key released outside the window never sends keyup, and a label left
    // holding the wrong name lies about what the next click does.
    const clear = () => setHeld(NONE)
    window.addEventListener('keydown', sync)
    window.addEventListener('keyup', sync)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', sync)
      window.removeEventListener('keyup', sync)
      window.removeEventListener('blur', clear)
    }
  }, [active])

  const seed = useCallback((e: MouseEvent | React.MouseEvent) => {
    setHeld({ meta: e.metaKey || e.ctrlKey, shift: e.shiftKey })
  }, [])

  return { ...(active ? held : NONE), seed }
}
