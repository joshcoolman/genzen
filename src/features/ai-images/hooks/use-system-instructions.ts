'use client'

import {
  readSystemInstructions,
  writeSystemInstructions,
} from '../system-instructions'
import { usePersistedState } from '#/lib/use-persisted-state'

export interface SystemInstructionsState {
  value: string
  setValue: (next: string) => void
  /** Non-empty. The gear marks itself with this -- invisible *and* persistent
   *  is how a paragraph typed on Tuesday silently edits Friday's generations. */
  isSet: boolean
}

/**
 * The UI half of `system-instructions.ts`. The submit path does not use this:
 * `useGenerator` reads storage directly at submit, so the value does not have
 * to be threaded from the panel that edits it to the hook that sends it.
 */
export function useSystemInstructions(): SystemInstructionsState {
  const [value, setValueRaw] = usePersistedState(readSystemInstructions, '')

  return {
    value,
    isSet: value.trim().length > 0,
    setValue: (next: string) => {
      setValueRaw(next)
      writeSystemInstructions(next)
    },
  }
}
