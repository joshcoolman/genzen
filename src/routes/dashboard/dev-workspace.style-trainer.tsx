import { createFileRoute } from '@tanstack/react-router'
import {
  StyleTrainerPageContent,
  useStyleCollections,
} from '@/features/style-trainer'

export const Route = createFileRoute('/dashboard/dev-workspace/style-trainer')({
  component: StyleTrainerPage,
})

function StyleTrainerPage() {
  const page = useStyleCollections()
  return <StyleTrainerPageContent page={page} />
}
