'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { EmptyDialog } from './_components/empty-dialog/empty-dialog'
import { ImageList } from './_components/image-list/image-list'
import { SelectionBar } from './_components/selection-bar/selection-bar'
import styles from './view.module.css'
import { useView } from './use-view'
import type { UserImage } from '#/features/user-images/types'
import {
  Button,
  PageHeader,
  Stack,
  TooltipProvider,
  ZipDownloadDialog,
} from '#/components'

export function View({ initial }: { initial: Array<UserImage> }) {
  const {
    images,
    imageUrls,
    busyId,
    isEmptying,
    isBatchRunning,
    selection,
    restore,
    permanentDelete,
    restoreSelected,
    deleteSelected,
    emptyTrash,
  } = useView(initial)

  const [downloadOpen, setDownloadOpen] = useState(false)
  const hasImages = images.length > 0

  return (
    // Base UI names this `delay`, not shadcn's `delayDuration`.
    <TooltipProvider delay={300}>
      <Stack gap={24}>
        <PageHeader
          title="Trash"
          description={
            hasImages
              ? `${images.length} ${images.length === 1 ? 'item' : 'items'}`
              : undefined
          }
          aside={
            hasImages ? (
              <Stack gap={8} direction="row">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDownloadOpen(true)}
                >
                  <Download className={styles.downloadIcon} />
                  Download
                </Button>
                <EmptyDialog
                  total={images.length}
                  busy={isEmptying}
                  onConfirm={emptyTrash}
                />
              </Stack>
            ) : undefined
          }
        />

        <ImageList
          images={images}
          urls={imageUrls}
          selectedIds={selection.selectedIds}
          hasSelection={selection.count > 0}
          busyId={busyId}
          onToggle={selection.toggle}
          onRestore={restore}
          onDelete={permanentDelete}
        />

        <ZipDownloadDialog
          open={downloadOpen}
          onOpenChange={setDownloadOpen}
          images={images}
          defaultName={`trash-${new Date().toISOString().slice(0, 10)}`}
          title="Download Trash Images"
        />

        <SelectionBar
          count={selection.count}
          busy={isBatchRunning}
          onClear={selection.clearSelection}
          onRestore={restoreSelected}
          onDelete={deleteSelected}
        />
      </Stack>
    </TooltipProvider>
  )
}
