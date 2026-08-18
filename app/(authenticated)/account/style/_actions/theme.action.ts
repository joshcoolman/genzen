'use server'

import { revalidatePath } from 'next/cache'
import type { ThemeCore } from '#/features/theme'
import { THEME_CORE_KEYS, isHexColor } from '#/features/theme'
import {
  clearUserTheme,
  saveUserTheme,
} from '#/features/theme/theme-store.server'
import { resolveAuth } from '#/lib/server/auth.server'

export interface ThemeFormState {
  error: string | null
  /** Bumped on every success. A counter rather than a boolean, so two saves in
   *  a row are two distinct states and the form can react to the second one. */
  savedAt: number
}

/* `revalidatePath('/', 'layout')` is the line that makes this feature work at
 * all. The palette is emitted by `(authenticated)/layout.tsx`, so revalidating
 * this page alone would save the row and leave every other route rendering the
 * old colors until something else happened to bust their cache. */
function revalidateEverything(): void {
  revalidatePath('/account/style')
  revalidatePath('/', 'layout')
}

export async function saveTheme(
  prevState: ThemeFormState,
  formData: FormData,
): Promise<ThemeFormState> {
  const { userId } = await resolveAuth()

  const entries = THEME_CORE_KEYS.map(
    (key) => [key, String(formData.get(key) ?? '').trim()] as const,
  )
  // Validated here rather than trusted from the input: `<input type="color">`
  // cannot produce a bad value, but a server action is a public endpoint and
  // the form is not the only thing that can reach it.
  const invalid = entries.find(([, value]) => !isHexColor(value))
  if (invalid) {
    return {
      error: `${invalid[0]} must be a hex color like #0d0d0d.`,
      savedAt: prevState.savedAt,
    }
  }

  await saveUserTheme(
    userId,
    Object.fromEntries(entries) as unknown as ThemeCore,
  )
  revalidateEverything()

  return { error: null, savedAt: prevState.savedAt + 1 }
}

/** Deletes the row rather than writing one full of defaults. Those are not the
 *  same state: no row is what an untouched account has, and it is the state in
 *  which `tokens.css` is the only thing styling the app. */
export async function resetTheme(
  prevState: ThemeFormState,
): Promise<ThemeFormState> {
  const { userId } = await resolveAuth()
  await clearUserTheme(userId)
  revalidateEverything()

  return { error: null, savedAt: prevState.savedAt + 1 }
}
