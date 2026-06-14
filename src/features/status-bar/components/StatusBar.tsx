import { MessageSquare } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useADOpen } from '@/lib/use-ad-open'
import { cn } from '@/lib/utils'

export function StatusBar() {
  const { user } = useAuth()
  const { isOpen: isADOpen, toggleOpen: toggleAD } = useADOpen()

  if (!user) return null

  return (
    <div
      className="fixed bottom-6 left-6 z-40 hidden items-center gap-3 rounded-[10px] px-3.5 py-2 animate-in fade-in slide-in-from-bottom-2 duration-300 xs:flex"
      style={{
        background: '#141414',
        border: '1px solid #2a2a2a',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
      }}
    >
      <ToolbarButton
        icon={MessageSquare}
        label="Chat"
        onClick={toggleAD}
        active={isADOpen}
      />
    </div>
  )
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center justify-center rounded-[6px] transition-colors',
        active
          ? 'text-white [background:#222] [border-color:#555]'
          : 'text-[#888] hover:text-white hover:[background:#222] hover:[border-color:#555]',
      )}
      style={{
        width: 36,
        height: 36,
        background: active ? '#222' : '#1a1a1a',
        border: `1px solid ${active ? '#555' : '#333'}`,
      }}
      aria-label={label}
      title={label}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  )
}
