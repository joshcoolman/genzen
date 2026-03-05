import { createFileRoute } from '@tanstack/react-router'
import { EditPageContent, useEditPage } from '@/features/edit-image'

export const Route = createFileRoute('/dashboard/edit-image')({
  component: EditImagePage,
})

function EditImagePage() {
  const page = useEditPage()
  return <EditPageContent page={page} />
}
