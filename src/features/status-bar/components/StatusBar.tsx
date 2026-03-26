import { SpotlightHint } from './items/SpotlightHint'
import { ScenesProgress } from './items/ScenesProgress'
import { useAuth } from '@/lib/auth'

export function StatusBar() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-white/10 bg-black/90 px-3 py-1.5 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
      <ScenesProgress />
      <SpotlightHint />
    </div>
  )
}
