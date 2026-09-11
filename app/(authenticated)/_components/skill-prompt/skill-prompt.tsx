'use client'

import { useId, useState } from 'react'
import styles from './skill-prompt.module.css'
import type { ComponentProps } from 'react'
import {
  PROMPT_IMAGE_SKILLS,
  storyboardShotCount,
} from '#/features/ai-images/skills/registry'
import { Textarea } from '#/components'

/** Invocation stays inside the existing prompt field on both generator surfaces. */
export function SkillPrompt({
  onCommandSelect,
  ...props
}: ComponentProps<typeof Textarea> & {
  onCommandSelect?: (value: string) => void
}) {
  const menuId = useId()
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const text = typeof props.value === 'string' ? props.value.trimStart() : ''
  const command = PROMPT_IMAGE_SKILLS.find(
    (skill) => text.match(/^\S+/)?.[0].toLowerCase() === skill.command,
  )
  const choice = /^\/[a-z]*$/i.test(text)
    ? PROMPT_IMAGE_SKILLS.find((skill) =>
        skill.command.startsWith(text.toLowerCase()),
      )
    : undefined
  let shotLabel = '6 shots'
  try {
    shotLabel = `${storyboardShotCount(text)} shots`
  } catch {
    shotLabel = 'Choose 2–9 shots'
  }
  const open = focused && !dismissed && !props.disabled && Boolean(choice)

  function select(element: HTMLTextAreaElement) {
    if (!choice) return
    const value = `${choice.command} `
    onCommandSelect?.(value)
    setDismissed(true)
    element.focus()
  }

  return (
    <div className={styles.root}>
      <Textarea
        {...props}
        aria-label={props['aria-label'] ?? 'Image prompt'}
        aria-autocomplete="list"
        aria-controls={open ? menuId : undefined}
        aria-activedescendant={open ? `${menuId}-storyboard` : undefined}
        onFocus={(e) => {
          setFocused(true)
          props.onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          props.onBlur?.(e)
        }}
        onChange={(e) => {
          setDismissed(false)
          props.onChange?.(e)
        }}
        onKeyDown={(e) => {
          if (
            open &&
            ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(
              e.key,
            ) &&
            !e.nativeEvent.isComposing
          ) {
            e.preventDefault()
            e.stopPropagation()
            if (e.key === 'Escape') setDismissed(true)
            else if (e.key === 'Enter' || e.key === 'Tab')
              select(e.currentTarget)
            return
          }
          props.onKeyDown?.(e)
        }}
      />
      {open && choice && (
        <div
          id={menuId}
          role="listbox"
          aria-label="Image commands"
          className={styles.menu}
        >
          <button
            type="button"
            id={`${menuId}-storyboard`}
            role="option"
            aria-selected="true"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              const textarea = e.currentTarget
                .closest(`.${styles.root}`)
                ?.querySelector('textarea')
              if (textarea) select(textarea)
            }}
          >
            <strong>{choice.command}</strong>
            <span>{choice.description}</span>
          </button>
        </div>
      )}
      {command && (
        <div className={styles.active}>
          <strong>{command.label}</strong>
          <span>
            {shotLabel} · separate full-size images · 16:9 each · 2–9 supported
          </span>
        </div>
      )}
    </div>
  )
}
