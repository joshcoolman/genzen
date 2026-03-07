import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/video/$workspaceId')({
  validateSearch: (search: Record<string, unknown>) => ({
    generationId:
      typeof search.generationId === 'string' ? search.generationId : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: '/dashboard/video',
      search: {
        workspaceId: params.workspaceId,
        generationId: (search as { generationId?: string }).generationId,
      },
    })
  },
  component: () => null,
})
