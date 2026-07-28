'use client'

import { CheckCircle2, Circle, Lock } from 'lucide-react'
import styles from './settings-page.module.css'
import { ALL_IMAGE_MODELS } from '#/features/ai-images/models'
import { ALL_TEXT_MODELS } from '#/lib/text-models'
import { useEnabledModels } from '#/lib/use-enabled-models'
import { navItems } from '#/lib/nav-items'
import { useNavVisibility } from '#/lib/use-nav-visibility'

export function SettingsPage() {
  const {
    isModelEnabled,
    toggleModel,
    resetToDefaults,
    enabledImageCount,
    enabledTextCount,
  } = useEnabledModels()
  const { toggleItem, isItemHidden, showMoreNav, toggleShowMore } =
    useNavVisibility()

  const sidebarItems = navItems.filter((item) => item.id !== 'account')

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
              ({enabledImageCount} of {ALL_IMAGE_MODELS.length} enabled)
            </span>
          </h3>
          <div className={styles.grid}>
            {[...ALL_IMAGE_MODELS]
              .sort((a, b) => (b.locked ? 1 : 0) - (a.locked ? 1 : 0))
              .map((model) => {
                const enabled = isModelEnabled(model.id)
                const locked = model.locked === true
                return (
                  <button
                    key={model.id}
                    onClick={() => toggleModel(model.id)}
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
                        {model.supportsImageInput && (
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

        <div className={styles.group}>
          <h3 className={styles.groupTitle}>
            Text{' '}
            <span className={styles.groupCount}>
              ({enabledTextCount} of {ALL_TEXT_MODELS.length} enabled)
            </span>
          </h3>
          <div className={styles.grid}>
            {[...ALL_TEXT_MODELS]
              .sort((a, b) => (b.locked ? 1 : 0) - (a.locked ? 1 : 0))
              .map((model) => {
                const enabled = isModelEnabled(model.id)
                const locked = model.locked === true
                return (
                  <button
                    key={model.id}
                    onClick={() => toggleModel(model.id)}
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
                        {model.supportsVision && (
                          <span className={styles.tag}>vision</span>
                        )}
                        {model.isNew && (
                          <span className={`${styles.tag} ${styles.tagNew}`}>
                            new
                          </span>
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

      <div className={styles.section}>
        <div>
          <h2 className={styles.sectionTitle}>Sidebar</h2>
          <p className={styles.sectionNote}>
            Choose which items appear in the sidebar navigation.
          </p>
        </div>

        <div className={styles.grid}>
          {sidebarItems.map((item) => {
            const isAlwaysVisible = item.alwaysVisible === true
            const isHidden = isItemHidden(item.id)
            const isVisible = isAlwaysVisible || !isHidden
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!isAlwaysVisible) toggleItem(item.id)
                }}
                disabled={isAlwaysVisible}
                className={`${styles.navCard} ${
                  isVisible ? styles.navCardVisible : styles.navCardHidden
                } ${isAlwaysVisible ? styles.navCardPinned : ''}`}
              >
                {isVisible ? (
                  <CheckCircle2
                    className={`${styles.navIcon} ${styles.iconOn}`}
                  />
                ) : (
                  <Circle className={`${styles.navIcon} ${styles.iconOff}`} />
                )}
                <item.icon className={styles.navIcon} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>

        <div className={styles.footer}>
          <button
            onClick={() => toggleShowMore()}
            className={`${styles.navCard} ${
              showMoreNav ? styles.navCardVisible : styles.navCardHidden
            }`}
          >
            {showMoreNav ? (
              <CheckCircle2 className={`${styles.navIcon} ${styles.iconOn}`} />
            ) : (
              <Circle className={`${styles.navIcon} ${styles.iconOff}`} />
            )}
            <span>Show More menu</span>
          </button>
        </div>
      </div>
    </div>
  )
}
