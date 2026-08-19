import styles from './group-heading.module.css'

/**
 * The open group's name, over the thumbnails (#432).
 *
 * **Entering a group used to change almost nothing.** Same grid, same toolbar;
 * the only difference was a small control carrying a chevron and the name, set
 * at the size of the pills beside it, which read as one more toolbar control
 * rather than as "you are somewhere else now".
 *
 * So the name left the toolbar and became what it always was: a title, in the
 * content column, the size a page title is -- a blog post's name above its own
 * post. The toolbar keeps the way out and says where out is.
 *
 * The shape of the page changes and nothing moves: a heading arrives where
 * there was none. That is the whole bar -- clear, not disruptive.
 *
 * Only inside a group. Top level has no heading and needs none; the sidebar
 * already says which route this is, and "Images" over a grid of images says
 * nothing.
 */
export function GroupHeading({ name }: { name: string }) {
  return <h1 className={styles.heading}>{name}</h1>
}
