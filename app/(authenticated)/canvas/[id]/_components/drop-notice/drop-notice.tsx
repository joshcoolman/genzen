'use client'

import styles from './drop-notice.module.css'

/** Why a dropped image did not land -- a cross-origin URL the browser refused
 *  to fetch. Self-dismissing; the caller clears the message. */
export function DropNotice({ message }: { message: string }) {
  return (
    <div key={message} className={styles.dropNotice}>
      {message}
    </div>
  )
}
