'use client'

import { useState } from 'react'
import { Loader2, Sparkles, X } from 'lucide-react'
import { GeneratePromptsDialog } from '../generate-prompts-dialog/generate-prompts-dialog'
import { PastePromptsDialog } from '../paste-prompts-dialog/paste-prompts-dialog'
import styles from './prompt-list.module.css'
import type { ReactNode } from 'react'
import { Textarea } from '#/components'
import { cx } from '#/lib/utils'

interface PromptListProps {
  prompts: Array<string>
  onUpdatePrompt: (index: number, value: string) => void
  onAddPrompt: () => void
  onRemovePrompt: (index: number) => void
  disabled?: boolean
  placeholders?: { first: string; additional: string }
  // Optional: generate prompts capability (loosely coupled)
  generatePromptsConfig?: {
    imageBase64: string
    onApply: (prompts: Array<string>) => void
  }
  // Optional: clear all prompts back to single empty textarea
  onClearPrompts?: () => void
  // Optional: paste multiple prompts at once
  onPastePrompts?: (prompts: Array<string>) => void
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
  generatePromptsConfig,
  onClearPrompts,
  onPastePrompts,
  onEnhancePrompt,
  enhancingPromptIndex,
  headerSlot,
}: PromptListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false)
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
              <button
                type="button"
                onClick={() => void onEnhancePrompt(index)}
                disabled={!canEnhance && !isEnhancing}
                title={
                  promptText.trim().length === 0
                    ? 'Enter a prompt to enhance'
                    : 'Enhance prompt with AI'
                }
                className={styles.enhance}
              >
                {isEnhancing ? (
                  <>
                    <Loader2 className={styles.enhanceSpinner} />
                    Enhancing…
                  </>
                ) : (
                  <>
                    <Sparkles className={styles.enhanceIcon} />
                    Enhance
                  </>
                )}
              </button>
            )}
          </div>
        )
      })}
      <div
        className={
          generatePromptsConfig || onPastePrompts ? styles.actions : undefined
        }
      >
        <button
          type="button"
          onClick={onAddPrompt}
          disabled={disabled}
          className={cx(
            styles.action,
            !generatePromptsConfig && !onPastePrompts && styles.actionOnly,
          )}
        >
          + Add prompt
        </button>
        {onPastePrompts && (
          <button
            type="button"
            onClick={() => setPasteDialogOpen(true)}
            disabled={disabled}
            className={styles.action}
          >
            Paste Prompts
          </button>
        )}
        {generatePromptsConfig && (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            disabled={disabled}
            className={styles.action}
          >
            Generate prompts
          </button>
        )}
      </div>
      {generatePromptsConfig && (
        <GeneratePromptsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onApply={generatePromptsConfig.onApply}
          imageBase64={generatePromptsConfig.imageBase64}
        />
      )}
      {onPastePrompts && (
        <PastePromptsDialog
          open={pasteDialogOpen}
          onOpenChange={setPasteDialogOpen}
          onAdd={onPastePrompts}
        />
      )}
    </div>
  )
}
