'use client'

import { useActionState, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { login } from '../../_actions/login'
import styles from './login-form.module.css'
import type { LoginState } from '../../_actions/login'

const INITIAL: LoginState = { error: null }

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, INITIAL)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <form action={formAction} className={styles.form}>
      <div>
        <label htmlFor="email" className={styles.label}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className={styles.input}
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="password" className={styles.label}>
          Password
        </label>
        <div className={styles.passwordField}>
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            className={styles.input}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className={styles.reveal}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {state.error && <div className={styles.error}>{state.error}</div>}

      <button type="submit" disabled={pending} className={styles.submit}>
        {pending ? '...' : 'Sign In'}
      </button>
    </form>
  )
}
