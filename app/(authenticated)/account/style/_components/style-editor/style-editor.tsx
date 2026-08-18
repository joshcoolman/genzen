'use client'

import { RotateCcw } from 'lucide-react'
import { SwatchList } from '../swatch-list/swatch-list'
import { ThemePreview } from '../theme-preview/theme-preview'
import styles from './style-editor.module.css'
import type { useView } from '../../use-view'
import { ActionButton } from '#/components'

/* The editor's whole layout, so `view.tsx` stays a composition and carries no
 * styles of its own -- the rule `docs/reference/route-shape.md` records. */
type StyleEditorProps = ReturnType<typeof useView>

export function StyleEditor({
  values,
  setValue,
  restoreDefaults,
  previewCss,
  save,
  saving,
  reset,
  resetting,
  error,
  busy,
}: StyleEditorProps) {
  return (
    <div className={styles.columns}>
      {/* The swatches are the form: each input carries its own token name, so
          the action reads the six straight off FormData. */}
      <form action={save} className={styles.form}>
        <SwatchList values={values} onChange={setValue} />

        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <ActionButton type="submit" loading={saving} loadingText="Saving">
            Save
          </ActionButton>
          <ActionButton
            type="button"
            variant="outline"
            icon={<RotateCcw size={14} />}
            disabled={busy}
            onClick={restoreDefaults}
          >
            Restore defaults
          </ActionButton>
        </div>
      </form>

      <div className={styles.aside}>
        <ThemePreview css={previewCss} />

        {/* A second form rather than a second button in the first: it posts to
            a different action, and a nested form is invalid HTML. */}
        <form action={reset}>
          <button type="submit" disabled={busy} className={styles.clear}>
            {resetting ? 'Clearing...' : 'Clear saved theme'}
          </button>
        </form>
        <p className={styles.clearHint}>
          Removes your saved colors entirely, so the app falls back to its own
          palette.
        </p>
      </div>
    </div>
  )
}
