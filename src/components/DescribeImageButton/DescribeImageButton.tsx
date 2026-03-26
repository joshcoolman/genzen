import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { captionImage } from '@/features/ai-images/server/caption-image.server'

interface DescribeImageButtonProps {
  imageBase64: string | null
  accessToken: string | null
  onCaption: (caption: string) => void
  className?: string
}

export function DescribeImageButton({
  imageBase64,
  accessToken,
  onCaption,
  className,
}: DescribeImageButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    if (!imageBase64 || !accessToken || isLoading) return
    setIsLoading(true)
    try {
      const { caption } = await captionImage({
        data: { imageBase64, accessToken },
      })
      onCaption(caption)
    } catch {
      // silent
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="icon"
      disabled={!imageBase64 || !accessToken}
      onClick={() => void handleClick()}
      title="Describe source image → add to prompt"
      className={className}
    >
      <MessageSquare className={isLoading ? 'animate-pulse' : ''} />
    </Button>
  )
}
