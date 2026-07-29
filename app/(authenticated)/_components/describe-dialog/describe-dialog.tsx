'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import styles from './describe-dialog.module.css'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '#/components'
import { Button } from '#/components/button/button'
import { updateImageDescription } from '#/features/user-images/server/images.actions'
import { captionImage } from '#/features/ai-images/server/caption-image.server'

interface DescribeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl: string | undefined
  imageId: string
  currentDescription?: string | null
  onSave?: (imageId: string, description: string) => void
}

export function DescribeDialog({
  open,
  onOpenChange,
  imageUrl,
  imageId,
  currentDescription,
  onSave,
}: DescribeDialogProps) {
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDescription = useCallback(async () => {
    if (!imageUrl) {
      setError('No image URL available')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await captionImage({ imageId, mode: 'reconstruct' })
      setDescription(result.caption)
    } catch (err) {
      console.error('Describe failed:', err)
      setError('Failed to describe image')
    } finally {
      setLoading(false)
    }
  }, [imageUrl])

  // Always describe fresh when dialog opens
  useEffect(() => {
    if (open) {
      setDescription('')
      setError(null)
      void fetchDescription()
    }
  }, [open, fetchDescription])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateImageDescription(imageId, description)
      onSave?.(imageId, description)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.popup}>
        <DialogHeader>
          <DialogTitle>Describe Image</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className={styles.loading}>
            <Loader2 className={styles.spinner} />
            <span>Describing...</span>
          </div>
        ) : error ? (
          <div className={styles.errorBlock}>
            <p className={styles.error}>{error}</p>
            <Button variant="secondary" size="sm" onClick={fetchDescription}>
              Retry
            </Button>
          </div>
        ) : (
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className={styles.textarea}
            placeholder="Image description..."
          />
        )}
        {currentDescription && (
          <p className={styles.current}>Current: {currentDescription}</p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={loading || saving || !!error}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
