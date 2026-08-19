'use client'

import { ChevronLeft } from 'lucide-react'
import styles from './group-heading.module.css'

/**
 * The open group's name, over the thumbnails, and the way out of it (#432).
 *
 * **Entering a group used to change almost nothing.** Same grid, same toolbar;
 * the only difference was a small control carrying a chevron and the name, set
 * at the size of the pills beside it, which read as one more toolbar control
 * rather than as "you are somewhere else now".
 *
 * So the name left the toolbar and became what it always was: a title, in the
 * content column, the size a page title is -- a blog post's name above its own
 * post. The shape of the page changes and nothing moves: a heading arrives
 * where there was none.
 *
 * **The way back came with it, and that is why the toolbar has no crumb.** A
 * back control in the row pushed Upload to the right on the way into a group,
 * so the one button that never changes what it does moved every time you
 * opened one. Upload is leftmost in both states now and the navigation lives
 * here, where the thing it navigates away from is named.
 *
 * The circle is the control; the whole heading is the target. An icon-only
 * button is a small thing to hit for the commonest gesture in a group, and the
 * name is what you are leaving -- clicking it to go back is the same gesture a
 * breadcrumb offers. The `<button>` is what carries the accessible name and
 * the focus ring; the row's own click is the larger convenience over it, and
 * it is sized to its content so there is no invisible target running the width
 * of the page.
 *
 * Only inside a group. Top level has no heading and needs none; the sidebar
 * already says which route this is, and "Images" over a grid of images says
 * nothing.
 */
export function GroupHeading({
  name,
  onBack,
}: {
  name: string
  onBack: () => void
}) {
  return (
    <div className={styles.row} onClick={onBack}>
      <button
        type="button"
        className={styles.back}
        aria-label="Back to Images"
        onClick={onBack}
      >
        <ChevronLeft className={styles.backIcon} />
      </button>
      <h1 className={styles.heading}>{name}</h1>
    </div>
  )
}
