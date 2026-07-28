import { LoginForm } from './_components/login-form/login-form'
import styles from './login.module.css'

// No signed-in check here. `proxy.ts` bounces an authenticated request to
// /images before this component runs, which is what retires the
// loading/redirect dance the TanStack version needed.
export default function LoginPage() {
  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <LoginForm />
      </div>
    </div>
  )
}
