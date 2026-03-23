import { useEffect, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSidebarCollapsed } from '@/lib/use-sidebar-collapsed'
import { InfiniteCanvas } from '@/features/canvas'

export const Route = createFileRoute('/dashboard/canvas')({
  component: CanvasPage,
})

function CanvasPage() {
  const { isCollapsed, setIsCollapsed } = useSidebarCollapsed()
  const savedCollapsed = useRef(isCollapsed)

  useEffect(() => {
    setIsCollapsed(true)
    return () => setIsCollapsed(savedCollapsed.current)
  }, [setIsCollapsed])

  return <InfiniteCanvas />
}
