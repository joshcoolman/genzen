# Quick Supabase Auth Setup

Simple guide to get login + dashboard working fast.

## 1. Environment Setup

Create `.env.local`:

```bash
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## 2. Auth Provider

`/src/components/auth-provider.tsx`:

```tsx
import { useState, useEffect, type ReactNode } from 'react'
import { AuthContext } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
```

## 3. Wrap App

`/src/routes/__root.tsx`:

```tsx
import { AuthProvider } from '@/components/auth-provider'

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
```

## 4. Login Page

`/src/routes/index.tsx`:

```tsx
import { useAuth } from '@/lib/auth'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

function LoginPage() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  if (loading) return <div>Loading...</div>
  if (user) {
    navigate({ to: '/dashboard' })
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { error } = await signIn(email, password)
    if (!error) navigate({ to: '/dashboard' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="space-y-4 w-96">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full px-4 py-2 border rounded"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full px-4 py-2 border rounded"
        />
        <button
          type="submit"
          className="w-full py-2 bg-blue-500 text-white rounded"
        >
          Sign In
        </button>
      </form>
    </div>
  )
}
```

## 5. Protected Dashboard

`/src/routes/dashboard.tsx`:

```tsx
import { useAuth } from '@/lib/auth'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

function DashboardPage() {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: '/' })
    }
  }, [user, loading, navigate])

  if (loading || !user) return <div>Loading...</div>

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button onClick={signOut} className="text-sm text-gray-600">
          Sign out
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="font-semibold mb-4">User Info</h2>
        <p>Email: {user.email}</p>
        <p>ID: {user.id}</p>
      </div>
    </div>
  )
}
```

## 6. Create Test User in Supabase

1. Go to your Supabase dashboard
2. Authentication > Users > Add user
3. Enter email/password
4. Done!

That's it. Login works, dashboard shows user info, sign out redirects back.
