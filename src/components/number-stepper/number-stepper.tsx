import { Minus, Plus } from 'lucide-react'
import styles from './number-stepper.module.css'
import { cx } from '#/lib/utils'

interface NumberStepperProps {
  value: number
  min?: number
  max?: number
  onAdjust: (delta: number) => void
  disabled?: boolean
  className?: string
}

export function NumberStepper({
  value,
  min = 1,
  max = 99,
  onAdjust,
  disabled,
  className,
}: NumberStepperProps) {
  return (
    <div
      className={cx(styles.root, disabled && styles.rootDisabled, className)}
    >
      <button
        onClick={() => onAdjust(-1)}
        disabled={disabled || value <= min}
        className={styles.step}
      >
        <Minus className={styles.stepIcon} />
      </button>
      <span className={styles.value}>{value}</span>
      <button
        onClick={() => onAdjust(1)}
        disabled={disabled || value >= max}
        className={styles.step}
      >
        <Plus className={styles.stepIcon} />
      </button>
    </div>
  )
}
