'use client'

import { Loader2, Plus, Sparkles, X } from 'lucide-react'
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
  // Optional: enhance prompt via LLM (loosely coupled — only renders if provided)
  onEnhancePrompt?: (index: number) => void | Promise<void>
  // Index of the prompt currently being enhanced (shows spinner on that row)
  enhancingPromptIndex?: number | null
  /**
   * Rendered at the right of the strip above the list, opposite Clear all.
   * A slot rather than a prop per occupant: what goes there today is system
   * instructions (#272), which are emphatically not a prompt and must not
   * appear in this component's vocabulary.
   */
  headerSlot?: ReactNode
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
  onEnhancePrompt,
  enhancingPromptIndex,
  headerSlot,
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
        {headerSlot}
      </div>
      {prompts.map((promptText, index) => {
        const isEnhancing = enhancingPromptIndex === index
        const anyEnhancing =
          enhancingPromptIndex !== null && enhancingPromptIndex !== undefined
        const canEnhance =
          Boolean(onEnhancePrompt) &&
          promptText.trim().length > 0 &&
          !disabled &&
          !anyEnhancing
        return (
          <div key={index} className={styles.field}>
            <Textarea
              id={index === 0 ? 'prompt-textarea' : `prompt-textarea-${index}`}
              placeholder={
                index === 0 ? placeholders.first : placeholders.additional
              }
              value={promptText}
              onChange={(e) => onUpdatePrompt(index, e.target.value)}
              disabled={disabled || isEnhancing}
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
            {onEnhancePrompt && (
              <MiniButton
                variant="overlay"
                icon={isEnhancing ? <Loader2 /> : <Sparkles />}
                spinning={isEnhancing}
                onClick={() => void onEnhancePrompt(index)}
                disabled={!canEnhance && !isEnhancing}
                title={
                  promptText.trim().length === 0
                    ? 'Enter a prompt to enhance'
                    : 'Enhance prompt with AI'
                }
                className={styles.enhance}
              >
                {isEnhancing ? 'Enhancing…' : 'Enhance'}
              </MiniButton>
            )}
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
      </div>
    </div>
  )
}
