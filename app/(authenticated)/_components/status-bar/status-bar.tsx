import { MessageSquare } from 'lucide-react'
import styles from './status-bar.module.css'
import { useADOpen } from '#/lib/use-ad-open'
import { cx } from '#/lib/utils'

export function StatusBar() {
  const { isOpen: isADOpen, toggleOpen: toggleAD } = useADOpen()

  return (
    <div className={styles.root}>
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
      className={cx(styles.button, active && styles.buttonActive)}
      aria-label={label}
      title={label}
    >
      <Icon className={styles.buttonIcon} />
    </button>
  )
}
