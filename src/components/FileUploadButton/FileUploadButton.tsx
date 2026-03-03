import { useRef } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FileUploadButtonProps {
  onFilesSelected: (files: Array<File>) => void
  accept?: string
  multiple?: boolean
  className?: string
}

export function FileUploadButton({
  onFilesSelected,
  accept = 'image/jpeg,image/png,image/webp,image/gif',
  multiple = true,
  className,
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFilesSelected(Array.from(e.target.files))
            e.target.value = ''
          }
        }}
      />
      <Button
        variant="outline"
        size="icon"
        className={className}
        onClick={() => inputRef.current?.click()}
      >
        <Upload />
      </Button>
    </>
  )
}
