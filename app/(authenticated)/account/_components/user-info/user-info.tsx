import styles from './user-info.module.css'
import type { AuthUser } from '#/lib/auth'

/**
 * Who you are, in the fewest rows that answer it.
 *
 * The User ID row went in #406: a uuid you cannot act on is noise on the one
 * page that is supposed to be worth visiting. `displayName` takes its place
 * when set -- `AuthUser` has carried it all along and nothing rendered it.
 */
export function UserInfo({ user }: { user: AuthUser }) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>Account</h3>
      <div className={styles.fields}>
        {user.displayName && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Name</span>
            <span className={styles.fieldValue}>{user.displayName}</span>
          </div>
        )}
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Email</span>
          <span className={styles.fieldValue}>{user.email}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Member since</span>
          <span className={styles.fieldValue}>
            {new Date(user.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Last login</span>
          <span className={styles.fieldValue}>
            {/* "Unknown" for an account that has not signed in since migration
                0008, which is every account on the day it ships. */}
            {user.lastLoginAt
              ? new Date(user.lastLoginAt).toLocaleString()
              : 'Unknown'}
          </span>
        </div>
      </div>
    </div>
  )
}
