import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { SCENE_STORAGE_KEY } from '@/features/scenes/constants'

const CELLS_KEY = `${SCENE_STORAGE_KEY}:cells`

function readPendingCount(): number {
  try {
    const raw = localStorage.getItem(CELLS_KEY)
    if (!raw) return 0
    const cells = JSON.parse(raw) as Array<{ pendingId: string | null }>
    return cells.filter((c) => c.pendingId !== null).length
  } catch {
    return 0
  }
}

export function ScenesProgress() {
  const [count, setCount] = useState(readPendingCount)

  useEffect(() => {
    const id = setInterval(() => setCount(readPendingCount()), 2000)
    return () => clearInterval(id)
  }, [])

  if (count === 0) return null

  return (
    <Link
      to="/dashboard/scenes"
      className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors"
    >
      <span className="size-1.5 rounded-full bg-accent-brand animate-pulse" />
      {count} scene{count !== 1 ? 's' : ''} generating
    </Link>
  )
}
