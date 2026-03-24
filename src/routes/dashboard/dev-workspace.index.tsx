import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/dev-workspace/')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard/dev-workspace/outpaint' })
  },
})
