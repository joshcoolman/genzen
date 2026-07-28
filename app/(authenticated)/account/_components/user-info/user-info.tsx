import styles from './user-info.module.css'
import type { AuthUser } from '#/lib/auth'

export function UserInfo({ user }: { user: AuthUser }) {
  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>User Information</h2>
      <div className={styles.fields}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Email</span>
          <span className={styles.fieldValue}>{user.email}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>User ID</span>
          <span className={styles.fieldValueMono}>{user.id}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Created</span>
          <span className={styles.fieldValue}>
            {new Date(user.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  )
}
