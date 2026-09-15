'use client'

import { useEffect, useState } from 'react'
import { GenForm } from '../gen-form/gen-form'
import styles from './clip-dialog.module.css'
import type { GenFrame } from '../gen-form/gen-form'
import type { VideoRecord } from '../../../../video/_actions/generate-video.action'
import { cx } from '#/lib/utils'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
} from '#/components'

/** Everything the form needs, owned by the view and handed to either dialog. */
export interface GenFormState {
  frame: GenFrame | null
  frameLoading: boolean
  frameError: string | null
  onDropFrame: () => void
  endFrame: GenFrame | null
  endFrameLoading: boolean
  onDropEndFrame: () => void
  refs: Array<GenFrame>
  runClips: Array<VideoRecord>
  onAddRefs: (frames: Array<GenFrame>) => void
  onDropRef: (id: string) => void
  prompt: string
  onPromptChange: (value: string) => void
  duration: number
  onDurationChange: (value: number) => void
  ratio: string
  onRatioChange: (value: string) => void
  busy: boolean
}

/**
 * Make the next clip in the run (#660).
 *
 * Its own dialog rather than a tab, because adding has no second thing to do.
 */
export function AddGenDialog({
  open,
  onOpenChange,
  form,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: GenFormState
  onSubmit: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle>Add a clip</DialogTitle>
        </DialogHeader>
        <GenForm {...form} submitLabel="Generate" onSubmit={onSubmit} />
      </DialogContent>
    </Dialog>
  )
}

/**
 * The pencil: name this clip, or make another one in its place (#660).
 *
 * **Two tabs that are not peers, and the tabs say so.** Naming is a text field
 * that saves instantly; regenerating spends money and takes a minute. They
 * share a dialog because the pencil is the obvious place for both and a second
 * icon on a 108px tile is worse than a tab -- but Name opens first every time,
 * so the cheap act is the default and the expensive one is a deliberate move.
 *
 * **Regenerate replaces, it never deletes.** A run is a list of ids pointing at
 * library rows, so swapping one changes the arrangement and nothing else: the
 * clip that dropped out is still in Video, untouched. Re-rolls you did not keep
 * accumulate there and are cleaned up by hand, which is the right trade for a
 * page whose point is clicking without thinking.
 *
 * Absent on an uploaded clip, which has no `generation_metadata` to rebuild a
 * request from -- absent rather than disabled, because a tab that can never be
 * pressed is a question the dialog should not be asking.
 */
export function EditClipDialog({
  open,
  onOpenChange,
  name,
  onRename,
  canRegenerate,
  form,
  onRegenerate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  onRename: (name: string) => void
  canRegenerate: boolean
  form: GenFormState
  onRegenerate: () => void
}) {
  const [tab, setTab] = useState<'name' | 'regenerate'>('name')
  const [draft, setDraft] = useState(name)

  // Reseeded on open, not on mount: the dialog stays mounted between uses, so
  // without this the next clip opens showing the last one's name -- and on the
  // cheap tab, which is where every visit should start.
  useEffect(() => {
    if (open) {
      setDraft(name)
      setTab('name')
    }
  }, [open, name])

  const trimmed = draft.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle>Edit clip</DialogTitle>
        </DialogHeader>

        {canRegenerate && (
          <div className={styles.tabs} role="tablist" aria-label="Edit clip">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'name'}
              className={cx(styles.tab, tab === 'name' && styles.tabOn)}
              onClick={() => setTab('name')}
            >
              Name
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'regenerate'}
              className={cx(styles.tab, tab === 'regenerate' && styles.tabOn)}
              onClick={() => setTab('regenerate')}
            >
              Regenerate
            </button>
          </div>
        )}

        {tab === 'name' || !canRegenerate ? (
          <div className={styles.name}>
            <Input
              autoFocus
              value={draft}
              placeholder="Name"
              maxLength={200}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && trimmed) {
                  e.preventDefault()
                  onRename(trimmed)
                }
              }}
            />
            <Button disabled={!trimmed} onClick={() => onRename(trimmed)}>
              Save
            </Button>
          </div>
        ) : (
          <GenForm {...form} submitLabel="Regenerate" onSubmit={onRegenerate} />
        )}
      </DialogContent>
    </Dialog>
  )
}
