'use client'

import { useActionState, useMemo, useState } from 'react'
import { resetTheme, saveTheme } from './_actions/theme.action'
import type { ThemeFormState } from './_actions/theme.action'
import type { ThemeCore } from '#/features/theme'
import { DEFAULT_CORE, deriveTheme, paletteToCss } from '#/features/theme'

/* Lives here rather than beside the actions because a `'use server'` module may
 * only export async functions -- a constant in that file is a build error. */
const INITIAL_THEME_STATE: ThemeFormState = { error: null, savedAt: 0 }

export function useView(core: ThemeCore | null) {
  // Opens on the saved core, or on the values `tokens.css` already renders, so
  // the form never starts from a palette the user is not looking at.
  const [values, setValues] = useState<ThemeCore>(core ?? DEFAULT_CORE)
  const [saveState, save, saving] = useActionState(
    saveTheme,
    INITIAL_THEME_STATE,
  )
  const [resetState, reset, resetting] = useActionState(
    resetTheme,
    INITIAL_THEME_STATE,
  )

  /* Derived on every keystroke, and cheap enough to be: ten values off six
   * inputs, no allocation worth memoising beyond this. */
  const previewCss = useMemo(() => paletteToCss(deriveTheme(values)), [values])

  return {
    values,
    setValue: (key: keyof ThemeCore, value: string) =>
      setValues((current) => ({ ...current, [key]: value })),
    restoreDefaults: () => setValues(DEFAULT_CORE),
    previewCss,
    save,
    saving,
    reset,
    resetting,
    error: saveState.error ?? resetState.error,
    busy: saving || resetting,
  }
}
