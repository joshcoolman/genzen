import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

export function VideoPlayerDialog({
  videoUrl,
  open,
  onOpenChange,
}: {
  videoUrl: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-2 data-[state=open]:!animate-in data-[state=open]:!fade-in-0 data-[state=open]:!zoom-in-95 data-[state=open]:!slide-in-from-left-0 data-[state=open]:!slide-in-from-top-0 data-[state=closed]:!animate-out data-[state=closed]:!fade-out-0 data-[state=closed]:!zoom-out-95 data-[state=closed]:!slide-out-to-left-0 data-[state=closed]:!slide-out-to-top-0">
        <DialogTitle className="sr-only">Video Player</DialogTitle>
        {videoUrl && (
          <video
            src={videoUrl}
            controls
            autoPlay
            loop
            className="aspect-video w-full rounded bg-black"
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
