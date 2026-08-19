'use client'

import { Plus, X } from 'lucide-react'
import styles from './prompt-list.module.css'
import type { ReactNode } from 'react'
import { MiniButton, Textarea } from '#/components'

interface PromptListProps {
  prompts: Array<string>
  onUpdatePrompt: (index: number, value: string) => void
  onAddPrompt: () => void
  onRemovePrompt: (index: number) => void
  disabled?: boolean
  placeholders?: { first: string; additional: string }
  // Optional: clear all prompts back to single empty textarea
  onClearPrompts?: () => void
  /**
   * Rendered at the right of the Add prompt row, opposite the button.
   * A slot rather than a prop per occupant: what goes there today is Generate
   * prompt, which is a way of *filling* a prompt rather than a prompt, and must
   * not appear in this component's vocabulary.
   *
   * It sat above the list until the strip up there was down to Clear all -- two
   * chips over an empty field read as the panel's controls rather than as the
   * list's, and one of them acts on a row that does not exist yet.
   */
  actionSlot?: ReactNode
}

export function PromptList({
  prompts,
  onUpdatePrompt,
  onAddPrompt,
  onRemovePrompt,
  disabled,
  placeholders = {
    first: 'Describe your image...',
    additional: 'Additional prompt...',
  },
  onClearPrompts,
  actionSlot,
}: PromptListProps) {
  // Only a multi-row list gets Clear. Tying it to "is there any text" made it
  // appear on the first keystroke in an empty field, shifting every control
  // below it while the user was typing. A row being added is already a shift;
  // typing should never be one.
  const canClearPrompts = prompts.length > 1
  return (
    <div className={styles.root}>
      {/* Always rendered, even empty: the strip reserves its own height so the
          button can appear and disappear without moving the prompt below it. */}
      <div className={styles.clearRow}>
        {onClearPrompts && canClearPrompts && (
          <button
            type="button"
            onClick={onClearPrompts}
            disabled={disabled}
            className={styles.clearAll}
          >
            Clear all
          </button>
        )}
      </div>
      {prompts.map((promptText, index) => {
        return (
          <div key={index} className={styles.field}>
            <Textarea
              id={index === 0 ? 'prompt-textarea' : `prompt-textarea-${index}`}
              placeholder={
                index === 0 ? placeholders.first : placeholders.additional
              }
              value={promptText}
              onChange={(e) => onUpdatePrompt(index, e.target.value)}
              disabled={disabled}
              rows={index === 0 ? 4 : 3}
              className={styles.textarea}
            />
            <button
              type="button"
              onClick={() => onRemovePrompt(index)}
              className={styles.remove}
              title="Remove this prompt"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
      {/* Left-aligned rather than spanning the rail: adding a prompt is a small
          act next to the list, not the panel's call to action -- Generate is.
          It shared a full-width dashed row with Paste Prompts and Generate
          prompts until those were removed. */}
      <div className={styles.actions}>
        <MiniButton icon={<Plus />} onClick={onAddPrompt} disabled={disabled}>
          Add prompt
        </MiniButton>
        {actionSlot}
      </div>
    </div>
  )
}
