import styles from './loading-note.module.css'

/** Shown while the source image is still being fetched. This exists only
 *  because the route reads on the client; moving the read to `page.tsx`, the
 *  way Trash does, deletes it. */
export function LoadingNote({ children }: { children: string }) {
  return (
    <div className={styles.root}>
      <p className={styles.text}>{children}</p>
    </div>
  )
}
