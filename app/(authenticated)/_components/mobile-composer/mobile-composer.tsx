'use client'

import { ArrowLeft, Plus, X } from 'lucide-react'
import styles from './mobile-composer.module.css'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import {
  ActionButton,
  Sheet,
  SheetContent,
  SheetTitle,
  Textarea,
} from '#/components'
import { cx } from '#/lib/utils'

/**
 * The way in: a round plus in the bottom-right corner, level with the menu
 * button in the bottom-left (`--mobile-dock-bottom`). The accent, because it is the one thing on the
 * page that makes something.
 */
export function ComposerFab({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={styles.fab}
      aria-label={label}
      onClick={onClick}
    >
      <Plus />
    </button>
  )
}

/** The sheet a composer lives in: from the bottom, as tall as the step it is
 *  showing, a long step scrolling inside itself. */
export function ComposerSheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={styles.sheet}
        showCloseButton={false}
      >
        {children}
      </SheetContent>
    </Sheet>
  )
}

/**
 * The parts every phone composer is built from (#753, #755): Images'
 * `MobileGenerator` and Video's `MobileVideoComposer`.
 *
 * One pattern, so it is one set of parts: a prompt, a row of chips, a full
 * width primary action -- and each chip opens a step of its own in the same
 * sheet. **A single choice returns on tap; a multiple choice has Done.** The
 * composers own what the steps are; these own how a step looks, so a chip or
 * a tile cannot be a different size on one route than the other.
 *
 * Needs a `Sheet` (for `SheetTitle`); nothing else.
 */
export function ComposerHeader({
  title,
  onBack,
  onClose,
  action,
}: {
  title: string
  /** Present on a step, absent on the compose view. */
  onBack?: () => void
  onClose: () => void
  /** Between the title and the close, e.g. the system-instructions gear. */
  action?: ReactNode
}) {
  return (
    <div className={styles.header}>
      {onBack && (
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Back"
          onClick={onBack}
        >
          <ArrowLeft />
        </button>
      )}
      <SheetTitle className={styles.title}>{title}</SheetTitle>
      {action}
      <button
        type="button"
        className={styles.iconButton}
        aria-label="Close"
        onClick={onClose}
      >
        <X />
      </button>
    </div>
  )
}

/** The one prompt box. Phone-sized type, so iOS does not zoom on focus. */
export function ComposerPrompt(
  props: Omit<Parameters<typeof Textarea>[0], 'className' | 'rows'>,
) {
  return <Textarea rows={4} className={styles.prompt} {...props} />
}

/** A step's content. `scroll` for a long one, so the header and footer hold
 *  still while it moves. */
export function ComposerBody({
  scroll,
  children,
}: {
  scroll?: boolean
  children: ReactNode
}) {
  return (
    <div className={cx(styles.body, scroll && styles.scroll)}>{children}</div>
  )
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <div className={styles.chips}>{children}</div>
}

/** `wide` takes the row's slack and truncates -- for the one label of unknown
 *  length, a model name. */
export function Chip({
  wide,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { wide?: boolean }) {
  return (
    <button
      type="button"
      className={cx(styles.chip, wide && styles.chipWide, className)}
      {...props}
    />
  )
}

export function ChipLabel({ children }: { children: ReactNode }) {
  return <span className={styles.chipLabel}>{children}</span>
}

/** Staged pictures on a chip: up to three, fanned, then the count. */
export function ChipStack({
  urls,
  count,
}: {
  urls: Array<string>
  count: number
}) {
  return (
    <span className={styles.stack}>
      {urls.slice(0, 3).map((url) => (
        <img key={url} src={url} alt="" />
      ))}
      <span>{count}</span>
    </span>
  )
}

/** A one-tap step's grid. `note` sits under the tiles. */
export function TileGrid({
  children,
  note,
}: {
  children: ReactNode
  note?: string
}) {
  return (
    <div className={cx(styles.body, styles.tiles)}>
      {children}
      {note && <p className={styles.tilesNote}>{note}</p>}
    </div>
  )
}

/** `big` for a tile whose whole content is a short value -- a number, a
 *  duration -- drawn large. */
export function Tile({
  on,
  big,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean; big?: boolean }) {
  return (
    <button
      type="button"
      className={cx(
        styles.tile,
        big && styles.tileBig,
        on && styles.tileOn,
        className,
      )}
      {...props}
    />
  )
}

/** The compose view's full-width action; `cost` rides inside it. */
export function PrimaryAction({
  cost,
  children,
  ...props
}: Omit<Parameters<typeof ActionButton>[0], 'className'> & {
  cost?: string | null
}) {
  return (
    <ActionButton {...props} className={styles.primary}>
      {children}
      {cost && <span className={styles.cost}>{cost}</span>}
    </ActionButton>
  )
}

/** A multiple-choice step's way back. */
export function DoneFooter({ onClick }: { onClick: () => void }) {
  return (
    <div className={styles.footer}>
      <ActionButton onClick={onClick} className={styles.primary}>
        Done
      </ActionButton>
    </div>
  )
}

/** Under the prompt: a line of state with an optional action. */
export function ComposerNote({
  children,
  action,
}: {
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <p className={styles.note}>
      {children}
      {action}
    </p>
  )
}

export function NoteAction(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={styles.noteAction} {...props} />
}

/** The composer's frame inside the sheet: header fixed, a step's body
 *  scrolling, footer fixed. */
export function ComposerRoot({ children }: { children: ReactNode }) {
  return <div className={styles.root}>{children}</div>
}
