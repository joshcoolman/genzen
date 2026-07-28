'use client'

import { CheckCircle2, Circle, Lock } from 'lucide-react'
import styles from './settings-page.module.css'
import { IMAGE_MODELS, pickerId } from '#/features/ai-images/models'
import { useEnabledModels } from '#/lib/use-enabled-models'

export function SettingsPage() {
  const { isModelEnabled, toggleModel, resetToDefaults, enabledImageCount } =
    useEnabledModels()

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Settings</h1>

      <div className={styles.section}>
        <div>
          <h2 className={styles.sectionTitle}>Models</h2>
          <p className={styles.sectionNote}>
            Manage which models appear in selectors across the app.
          </p>
        </div>

        <div className={styles.group}>
          <h3 className={styles.groupTitle}>
            Text to Image{' '}
            <span className={styles.groupCount}>
              ({enabledImageCount} of {IMAGE_MODELS.length} enabled)
            </span>
          </h3>
          <div className={styles.grid}>
            {[...IMAGE_MODELS]
              .sort((a, b) => (b.locked ? 1 : 0) - (a.locked ? 1 : 0))
              .map((model) => {
                const id = pickerId(model)
                const enabled = isModelEnabled(id)
                const locked = model.locked === true
                return (
                  <button
                    key={id}
                    onClick={() => toggleModel(id)}
                    disabled={locked}
                    className={`${styles.modelCard} ${
                      enabled
                        ? styles.modelCardEnabled
                        : styles.modelCardDisabled
                    } ${locked ? styles.modelCardLocked : ''}`}
                  >
                    {locked && (
                      <span className={styles.lockedBadge}>DEFAULT</span>
                    )}
                    {locked ? (
                      <Lock className={`${styles.icon} ${styles.iconOn}`} />
                    ) : enabled ? (
                      <CheckCircle2
                        className={`${styles.icon} ${styles.iconOn}`}
                      />
                    ) : (
                      <Circle className={`${styles.icon} ${styles.iconOff}`} />
                    )}
                    <div className={styles.modelText}>
                      <div className={styles.modelHeading}>
                        <span className={styles.modelName}>{model.name}</span>
                        {model.withImages && (
                          <span className={styles.tag}>img</span>
                        )}
                      </div>
                      <div className={styles.modelDesc}>
                        {model.description}
                      </div>
                    </div>
                  </button>
                )
              })}
          </div>
        </div>

        <button onClick={resetToDefaults} className={styles.reset}>
          Reset to defaults
        </button>
      </div>
    </div>
  )
}
