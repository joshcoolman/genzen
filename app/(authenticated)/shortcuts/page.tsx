import styles from './shortcuts.module.css'
import { shortcutGroups } from './shortcuts'
import { PageHeader, Stack } from '#/components'

/**
 * What the app answers to, in one place (#289).
 *
 * The three modifier gestures used to be taught in hover labels on the cards
 * themselves, and #284 removed them: a two-word hover is the wrong surface for
 * a shortcut and it charged every ordinary hover for a feature most of them
 * were not about to use. They have been undiscoverable by design since, waiting
 * on somewhere that could carry the explanation. This is it.
 *
 * A page rather than an overlay on `?`, because an overlay is only findable if
 * you already know it is there -- which is the problem, not the fix. In the
 * sidebar it is visible from everywhere, including the surfaces the gestures
 * apply to.
 *
 * Static, so no `view.tsx` and no `use-view.ts` -- both would be empty
 * indirection. `readme/` is the same exception for the same reason; see
 * `docs/reference/route-shape.md`.
 */
export default function Shortcuts() {
  return (
    <Stack gap={32}>
      <PageHeader title="Shortcuts" />

      {shortcutGroups.map((group) => (
        <section key={group.where} className={styles.group}>
          <h2 className={styles.where}>{group.where}</h2>
          {group.blurb && <p className={styles.blurb}>{group.blurb}</p>}

          <dl className={styles.list}>
            {group.items.map((item) => (
              <div key={item.keys + item.what} className={styles.row}>
                <dt className={styles.keys}>{item.keys}</dt>
                <dd className={styles.what}>
                  {item.what}
                  {item.note && (
                    <span className={styles.note}>{item.note}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </Stack>
  )
}
