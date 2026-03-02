import { Download } from 'lucide-react'
import { useDownloadImages } from '../hooks/useDownloadImages'
import type { UserImage } from '../types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ImageDownloadButtonProps {
  images: Array<UserImage>
  imageUrls: Record<string, string>
}

export function ImageDownloadButton({
  images,
  imageUrls,
}: ImageDownloadButtonProps) {
  const { isDownloading, progress, counts, download } = useDownloadImages(
    images,
    imageUrls,
  )

  if (counts.all === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isDownloading}>
          <Download className="h-4 w-4 mr-2" />
          {isDownloading ? `Downloading ${progress}%` : 'Download'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => download('all')}>
          All Images ({counts.all})
        </DropdownMenuItem>
        {counts.upload > 0 && (
          <DropdownMenuItem onClick={() => download('upload')}>
            Uploads Only ({counts.upload})
          </DropdownMenuItem>
        )}
        {counts.ai_generated > 0 && (
          <DropdownMenuItem onClick={() => download('ai_generated')}>
            AI Generated Only ({counts.ai_generated})
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
