import { createFileRoute } from '@tanstack/react-router'
import { useFocusedEdit } from '@/features/ai-images/hooks/use-focused-edit'
import { FocusedEditView } from '@/features/ai-images/components/FocusedEditView'

export const Route = createFileRoute('/dashboard/edit/$imageId')({
  component: FocusedEditPage,
})

function FocusedEditPage() {
  const { imageId } = Route.useParams()
  const edit = useFocusedEdit(imageId)
  return <FocusedEditView edit={edit} />
}
