import { useState, useEffect } from 'react'

const STORAGE_KEY = 'sidebar-collapsed'

export function useSidebarCollapsed() {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'true'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isCollapsed))
  }, [isCollapsed])

  const toggleCollapsed = () => setIsCollapsed((prev) => !prev)

  return { isCollapsed, toggleCollapsed, setIsCollapsed }
}
