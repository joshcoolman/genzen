interface StatusBarItemProps {
  onClick?: () => void
  children: React.ReactNode
}

export function StatusBarItem({ onClick, children }: StatusBarItemProps) {
  const Component = onClick ? 'button' : 'div'
  return (
    <Component
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white/80 transition-colors"
    >
      {children}
    </Component>
  )
}
