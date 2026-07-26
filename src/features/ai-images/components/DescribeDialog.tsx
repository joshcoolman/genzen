'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { captionImage } from '@/features/ai-images/server/caption-image.server'

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
      await supabase
        .from('user_images')
        .update({ description })
        .eq('id', imageId)
      onSave?.(imageId, description)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Describe Image</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Describing...
            </span>
          </div>
        ) : error ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchDescription}>
              Retry
            </Button>
          </div>
        ) : (
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className="resize-none"
            placeholder="Image description..."
          />
        )}
        {currentDescription && (
          <p className="text-xs text-muted-foreground">
            Current: {currentDescription}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving || !!error}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
