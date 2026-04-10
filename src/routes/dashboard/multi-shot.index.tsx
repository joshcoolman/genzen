import { Navigate, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/multi-shot/')({
  component: MultiShotRedirect,
})

function MultiShotRedirect() {
  return (
    <Navigate
      to="/dashboard/video"
      search={{
        mode: 'multishot',
        workspaceId: undefined,
        generationId: undefined,
      }}
      replace
    />
  )
}
