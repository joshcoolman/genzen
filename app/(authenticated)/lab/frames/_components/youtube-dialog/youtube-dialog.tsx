'use client'

import { useEffect, useState } from 'react'
import { parseYouTubeId } from '../../youtube'
import styles from './youtube-dialog.module.css'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '#/components'

/**
 * Paste a YouTube link.
 *
 * **Validated here, before anything is committed to.** `parseYouTubeId` is the
 * same function the server checks with, so a link this dialog accepts is a link
 * the grab will accept -- the alternative is a stage that loads, a button that
 * fails, and no way to tell a bad link from a broken feature.
 *
 * Deliberately thin: one field, no preview, no metadata lookup. The player
 * itself reports the title the moment it is ready, so fetching one here would
 * be a second network round trip to learn something that arrives free a second
 * later.
 */
export function YouTubeDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (videoId: string) => void
}) {
  const [value, setValue] = useState('')
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    if (!open) {
      setValue('')
      setInvalid(false)
    }
  }, [open])

  const submit = () => {
    const id = parseYouTubeId(value)
    if (!id) {
      setInvalid(true)
      return
    }
    onPick(id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>YouTube</DialogTitle>
        </DialogHeader>

        <div className={styles.body}>
          <Input
            autoFocus
            value={value}
            placeholder="Paste a YouTube link"
            aria-label="YouTube link"
            aria-invalid={invalid || undefined}
            onChange={(event) => {
              setValue(event.target.value)
              setInvalid(false)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submit()
              }
            }}
          />
          <p className={invalid ? styles.invalid : styles.hint}>
            {invalid
              ? 'That is not a YouTube video link.'
              : 'Nothing is saved but the frames you grab.'}
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!value.trim()}>
            Load
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
