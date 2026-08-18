import styles from './account-stats.module.css'
import type { AccountStats as Stats } from '#/lib/server/account-stats.server'

/**
 * Cents to a readable figure.
 *
 * Sub-cent totals are real here: a compute-seconds generation is worth $0.0004
 * (#400), and a handful of them must not collapse to "$0.00" as though they
 * were free. Same ladder the Activity rows use.
 */
function formatCents(cents: number): string {
  const dollars = cents / 100
  if (dollars === 0) return '$0.00'
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`
  if (dollars < 1) return `$${dollars.toFixed(3)}`
  return `$${dollars.toFixed(2)}`
}

/**
 * `sub` is a list of lines, not one string. The spend split reads
 * "$1.54 images / $4.50 video", and as a single string it wrapped wherever the
 * column happened to end -- most often orphaning the word "video".
 */
function Figure({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: Array<string>
}) {
  return (
    <div className={styles.figure}>
      <span className={styles.figureLabel}>{label}</span>
      <span className={styles.figureValue}>{value}</span>
      {sub?.map((line) => (
        <span key={line} className={styles.figureSub}>
          {line}
        </span>
      ))}
    </div>
  )
}

export function AccountStats({ stats }: { stats: Stats }) {
  const totalSpend = stats.images.spendCents + stats.videos.spendCents
  // A ranked list, not a grid of per-model cards. This is not meant to be FAL's
  // dashboard -- it answers "what do I actually use and what does it cost",
  // which is one ordering.
  const busiest = stats.models.at(0)

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>Usage</h3>
        {/* Not a disclaimer to be tucked away. FAL returns no cost field on any
            image result, so every figure on this card is genzen's own
            arithmetic (#400) and the card has to say so where it is read. */}
        <span className={styles.estimateNote}>Estimated</span>
      </div>

      <div className={styles.figures}>
        <Figure
          label="Spend"
          value={formatCents(totalSpend)}
          sub={[
            `${formatCents(stats.images.spendCents)} images`,
            `${formatCents(stats.videos.spendCents)} video`,
          ]}
        />
        <Figure label="Images" value={String(stats.images.count)} />
        <Figure label="Videos" value={String(stats.videos.count)} />
        <Figure
          label="Failures"
          value={String(stats.failures.count)}
          sub={
            stats.failures.count > 0
              ? [`${Math.round(stats.failures.rate * 100)}% of runs`]
              : undefined
          }
        />
      </div>

      {stats.failures.latestError && (
        <p className={styles.latestError}>
          Last failure: {stats.failures.latestError}
        </p>
      )}

      {stats.models.length > 0 && (
        <div className={styles.models}>
          <span className={styles.modelsTitle}>
            Models by use
            {busiest && (
              <span className={styles.modelsLead}> · {busiest.name}</span>
            )}
          </span>
          <ul className={styles.modelList}>
            {stats.models.map((m) => (
              <li key={m.name} className={styles.modelRow}>
                <span className={styles.modelName}>{m.name}</span>
                <span className={styles.modelCount}>{m.count}</span>
                <span className={styles.modelSpend}>
                  {formatCents(m.spendCents)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
