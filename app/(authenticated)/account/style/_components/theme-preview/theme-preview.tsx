'use client'

import styles from './theme-preview.module.css'
import type { CSSProperties } from 'react'

/* A real preview rather than a mockup of one.
 *
 * The derived palette is applied as custom properties on this element, and
 * every class below reads them back through the same `var(--token)` a real
 * component uses -- so what is on screen is drawn by the cascade that will draw
 * the app, not by an approximation maintained in parallel.
 *
 * Scoped to this subtree deliberately, and this is the one place the global
 * mechanism is *not* used: theming the whole page live would make it lurch on
 * every keystroke, and you could no longer see the saved palette next to the
 * one you are trying out. */
interface ThemePreviewProps {
  /** Declarations from `paletteToCss` -- `--bg: hsl(...); --surface: ...`. */
  css: string
}

export function ThemePreview({ css }: ThemePreviewProps) {
  return (
    <div className={styles.preview} style={toCssVars(css)}>
      <p className={styles.title}>Preview</p>
      <p className={styles.body}>
        Body text on a surface, with{' '}
        <span className={styles.muted}>a muted caption</span> beside it.
      </p>
      <div className={styles.row}>
        <span className={styles.accent}>Accent</span>
        <span className={styles.soft}>Selected</span>
        <span className={styles.raised}>Raised</span>
      </div>
      <p className={styles.footnote}>
        Status colors, shadows and spacing are not themed.
      </p>
    </div>
  )
}

/* `paletteToCss` returns a declaration string because that is what a `<style>`
 * block needs, and React's `style` prop needs an object. Parsing our own output
 * is cheaper than a second emitter that could drift from the first. */
function toCssVars(declarations: string): CSSProperties {
  const style: Record<string, string> = {}
  for (const declaration of declarations.split(';')) {
    const [name, ...rest] = declaration.split(':')
    if (!name.trim() || rest.length === 0) continue
    style[name.trim()] = rest.join(':').trim()
  }
  return style as CSSProperties
}
