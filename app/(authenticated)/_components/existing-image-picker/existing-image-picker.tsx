'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Upload } from 'lucide-react'
import styles from './existing-image-picker.module.css'
import type { CollectedImage, UserImage } from '#/features/user-images/types'
import type { ImageGroupName } from '#/features/user-images/server/image-groups.action'
import { saveFileToLibrary } from '#/features/user-images/lib/save-to-library'
import { listImageGroupNames } from '#/features/user-images/server/image-groups.action'
import { useAuth } from '#/lib/auth'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ImageGrid,
  Thumbnail,
  toast,
} from '#/components'

type SourceFilter = 'all' | 'upload' | 'ai_generated'

/** A group's id, or null for every image whatever its group. */
type GroupFilter = string | null

interface ExistingImagePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  images: Array<UserImage>
  imageUrls: Record<string, string>
  isLoading: boolean
  alreadyCollectedIds: Set<string>
  onConfirm: (images: Array<CollectedImage>) => void
  max?: number
  excludeIds?: Set<string>
  /** Pre-select these IDs when the picker opens. They appear as toggleable in the main grid (not in "already collected"). */
  initialSelectedIds?: Set<string>
  /** When true, immediately confirm after the first selection (useful for single-select pickers). */
  autoConfirm?: boolean
  /**
   * Re-read the library. Passing it turns on Upload (#489): the picker writes
   * the files itself, then asks for the list again, because the rows it renders
   * are the caller's and it has no way to add to them.
   *
   * The whole reason it is here: wanting a reference image that is still on
   * disk meant closing this dialog, finding the Upload button in the /images
   * toolbar, uploading, reopening this, and finding the new tile -- five steps
   * to answer the question the dialog had just asked. That button is gone
   * (#491); this is now the only place a file is chosen from disk.
   */
  onRefresh?: () => Promise<void>
}

export function ExistingImagePicker({
  open,
  onOpenChange,
  images,
  imageUrls,
  isLoading,
  alreadyCollectedIds,
  onConfirm,
  max,
  excludeIds,
  initialSelectedIds,
  autoConfirm,
  onRefresh,
}: ExistingImagePickerProps) {
  const { user } = useAuth()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [groupFilter, setGroupFilter] = useState<GroupFilter>(null)
  const [groups, setGroups] = useState<Array<ImageGroupName>>([])
  const [uploadingCount, setUploadingCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* Upload only where the caller can show the result, and never in a
     single-pick picker, where the first file would confirm and close the
     dialog before the second finished. */
  const canUpload = Boolean(onRefresh) && !autoConfirm

  /* Names are fetched here rather than passed in: four routes render this
     dialog and none of them has a reason to know about groups. Re-read on
     every open because a group can be created or renamed in Images while this
     component stays mounted. Failure is silent -- the dropdown simply does not
     appear, and the picker works exactly as it did before it existed. */
  useEffect(() => {
    if (!open) return
    let cancelled = false
    listImageGroupNames()
      .then((rows) => {
        if (!cancelled) setGroups(rows)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open])

  // When picker opens with initialSelectedIds, pre-check them
  useEffect(() => {
    if (open && initialSelectedIds?.size) {
      setSelectedIds(new Set(initialSelectedIds))
    } else if (!open) {
      setSelectedIds(new Set())
    }
  }, [open, initialSelectedIds])

  // When using initialSelectedIds, don't split into "already collected" section
  const effectiveCollectedIds = initialSelectedIds?.size
    ? new Set<string>()
    : alreadyCollectedIds

  const filteredImages = useMemo(() => {
    let result =
      sourceFilter === 'all'
        ? images
        : images.filter((img) => img.source === sourceFilter)
    if (groupFilter !== null) {
      result = result.filter((img) => img.group_id === groupFilter)
    }
    if (excludeIds?.size)
      result = result.filter((img) => !excludeIds.has(img.id))
    return result
  }, [images, sourceFilter, groupFilter, excludeIds])

  /* Only groups with something in this picker's list, because an option that
     filters to an empty grid is a dead end you have to back out of. `images`
     is already the caller's scoped list, so a picker that excludes videos
     never offers a group of nothing but videos. */
  const groupOptions = useMemo(() => {
    const present = new Set(
      images.map((img) => img.group_id).filter((id): id is string => !!id),
    )
    return { named: groups.filter((g) => present.has(g.id)) }
  }, [images, groups])

  const groupLabel =
    groupFilter === null
      ? 'All'
      : (groups.find((g) => g.id === groupFilter)?.name ?? 'All')

  const alreadyCollectedImages = useMemo(
    () => filteredImages.filter((img) => effectiveCollectedIds.has(img.id)),
    [filteredImages, effectiveCollectedIds],
  )

  const availableImages = useMemo(
    () => filteredImages.filter((img) => !effectiveCollectedIds.has(img.id)),
    [filteredImages, effectiveCollectedIds],
  )

  const toggleSelect = (id: string) => {
    if (autoConfirm) {
      const img = images.find((i) => i.id === id)
      if (img) {
        onConfirm([
          {
            id: img.id,
            title: img.title,
            url: imageUrls[img.id] ?? '',
            source: img.source,
            addedInSession: false,
          },
        ])
        setSelectedIds(new Set())
        onOpenChange(false)
      }
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (max !== undefined && next.size >= max) return prev
        next.add(id)
      }
      return next
    })
  }

  /**
   * Files straight into the library from inside the picker, then selected.
   *
   * Auto-selecting is the point: you only reach for Upload here because you
   * came looking for an image to attach, so landing the files and leaving them
   * untouched would be answering a different question. The dialog stays open
   * -- upload two, glance at them, Add Selected.
   *
   * Uploads are sequential, not `Promise.all`: each file is base64'd into a
   * Server Action call, and a handful of large ones in flight together is the
   * shape that hits the body limits in #482.
   */
  const uploadFiles = async (files: Array<File>) => {
    setUploadingCount(files.length)
    const uploadedIds: Array<string> = []
    for (const file of files) {
      try {
        const created = await saveFileToLibrary({
          userId: user.id,
          file,
          title: file.name,
        })
        uploadedIds.push(created.id)
      } catch (err) {
        // Say why -- the size limit is the common failure and it is a sentence
        // worth reading (#482).
        toast.error(
          err instanceof Error && err.message
            ? err.message
            : `Could not upload ${file.name}`,
        )
      }
    }
    setUploadingCount(0)
    await onRefresh?.()
    if (uploadedIds.length > 0) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const id of uploadedIds) {
          if (max !== undefined && next.size >= max) break
          next.add(id)
        }
        return next
      })
    }
  }

  const handleConfirm = () => {
    const selected = images
      .filter((img) => selectedIds.has(img.id))
      .map(
        (img): CollectedImage => ({
          id: img.id,
          title: img.title,
          url: imageUrls[img.id] ?? '',
          source: img.source,
          addedInSession: false,
        }),
      )
    onConfirm(selected)
    setSelectedIds(new Set())
    onOpenChange(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedIds(new Set())
    }
    onOpenChange(nextOpen)
  }

  const filterButtons: Array<{ value: SourceFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'upload', label: 'Uploads' },
    { value: 'ai_generated', label: 'AI Generated' },
  ]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="wide" className={styles.popup}>
        <DialogHeader>
          <DialogTitle>Library</DialogTitle>
        </DialogHeader>

        <div className={styles.filters}>
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              type="button"
              onClick={() => setSourceFilter(btn.value)}
              className={`${styles.filter} ${sourceFilter === btn.value ? styles.filterSelected : ''}`}
            >
              {btn.label}
            </button>
          ))}

          {/* Only when there is a group to pick: a dropdown over a library
              with no groups in it is a control that cannot do anything. A
              dropdown rather than more pills because the count is unbounded --
              three sources fit on a row, thirty groups do not.

              It reads "All" and then the group names, the same word the source
              pills use for the same idea. Two "All"s sit next to each other and
              that is fine: they narrow different things, and the one that is
              open tells you which. */}
          {groupOptions.named.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={`${styles.filter} ${styles.groupTrigger} ${
                  groupFilter !== null ? styles.filterSelected : ''
                }`}
              >
                {groupLabel}
                <ChevronDown className={styles.groupChevron} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setGroupFilter(null)}>
                  All
                </DropdownMenuItem>
                {groupOptions.named.map((g) => (
                  <DropdownMenuItem
                    key={g.id}
                    onClick={() => setGroupFilter(g.id)}
                  >
                    {g.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Above the grid rather than in the footer, and opposite the
              filters: those three narrow what is already here, this brings
              something that is not. */}
          {canUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className={styles.fileInput}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length > 0) void uploadFiles(files)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                className={styles.upload}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingCount > 0}
              >
                <Upload className={styles.uploadIcon} />
                {uploadingCount > 0
                  ? `Uploading ${uploadingCount}...`
                  : 'Upload'}
              </button>
            </>
          )}
        </div>

        <div className={styles.grid}>
          {isLoading ? (
            <div className={styles.state}>Loading images...</div>
          ) : filteredImages.length === 0 ? (
            <div className={styles.state}>No images found</div>
          ) : (
            <>
              {alreadyCollectedImages.length > 0 && (
                <>
                  <div className={styles.collected}>
                    <p className={styles.collectedLabel}>Already collected</p>
                    <ImageGrid size="md">
                      {alreadyCollectedImages.map((image) => (
                        <Thumbnail
                          key={image.id}
                          url={imageUrls[image.id] ?? null}
                          alt={image.title}
                          compact
                        />
                      ))}
                    </ImageGrid>
                  </div>
                  <hr className={styles.divider} />
                </>
              )}
              <ImageGrid size="md">
                {availableImages.map((image) => {
                  const isSelected = selectedIds.has(image.id)

                  return (
                    <Thumbnail
                      key={image.id}
                      url={imageUrls[image.id] ?? null}
                      alt={image.title}
                      onClick={() => toggleSelect(image.id)}
                      compact
                      pickable
                      selected={isSelected}
                      selectedClassName={styles.thumbSelected}
                      imageOverlay={
                        isSelected ? (
                          <div className={styles.check}>
                            <Check />
                          </div>
                        ) : undefined
                      }
                    />
                  )
                })}
              </ImageGrid>
            </>
          )}
        </div>

        <DialogFooter className={styles.footer}>
          <div className={styles.footerInner}>
            {max !== undefined && (
              <span className={styles.count}>
                {selectedIds.size}/{max} selected
              </span>
            )}
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
            >
              Add {selectedIds.size > 0 ? `${selectedIds.size} ` : ''}Selected
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
