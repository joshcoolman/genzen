'use client'

import { useRef } from 'react'
import styles from './download-dialog.module.css'
import type { DownloadState } from '../../_hooks/use-download'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '#/components'

/** Name the file, then save it. */
export function DownloadDialog({ download }: { download: DownloadState }) {
  // Base UI focuses the popup itself on open, so the name field has to be named
  // explicitly -- `autoFocus` on the Input is a no-op inside a focus trap, and
  // silently so: the Enter-to-download path would just be unreachable.
  const nameRef = useRef<HTMLInputElement>(null)

  return (
    <Dialog
      open={!!download.target}
      onOpenChange={(open) => {
        if (!open) download.cancel()
      }}
    >
      <DialogContent className={styles.popup} initialFocus={nameRef}>
        <DialogHeader>
          <DialogTitle>Download</DialogTitle>
        </DialogHeader>
        <Input
          ref={nameRef}
          value={download.name}
          onChange={(e) => download.setName(e.target.value)}
          placeholder="Name..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && download.name.trim()) void download.save()
          }}
        />
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={download.cancel}
            disabled={download.busy}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void download.save()}
            disabled={!download.name.trim() || download.busy}
          >
            {download.busy ? 'Downloading...' : 'Download'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
