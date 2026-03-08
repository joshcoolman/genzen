import { createFileRoute } from '@tanstack/react-router'
import {
  StyleTrainerPageContent,
  useStyleTrainerPage,
} from '@/features/style-trainer'

export const Route = createFileRoute('/dashboard/style-trainer')({
  component: StyleTrainerPage,
})

function StyleTrainerPage() {
  const page = useStyleTrainerPage()
  return <StyleTrainerPageContent page={page} />
}
