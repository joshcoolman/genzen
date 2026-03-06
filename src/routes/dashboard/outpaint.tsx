import { createFileRoute } from '@tanstack/react-router'
import { OutpaintPageContent, useOutpaintPage } from '@/features/outpaint'

export const Route = createFileRoute('/dashboard/outpaint')({
  component: OutpaintPage,
})

function OutpaintPage() {
  const page = useOutpaintPage()
  return <OutpaintPageContent page={page} />
}
