import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/video')({
  component: VideoLayout,
})

function VideoLayout() {
  return <Outlet />
}
