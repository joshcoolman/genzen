# Authentication

Supabase email/password authentication with protected routes.

## Status

- [x] Complete

## Overview

Users sign in with email and password. The dashboard is protected and redirects unauthenticated users to the login page.

## Implementation

### Key Files

- `src/lib/supabase.ts` - Supabase client initialization
- `src/lib/auth.ts` - Auth context type definitions and hook
- `src/lib/server/auth.server.ts` - Server-side auth helper (`requireAuth`) for verifying access tokens
- `src/components/auth-provider.tsx` - React context provider for auth state
- `src/routes/index.tsx` - Login page
- `src/routes/dashboard.tsx` - Layout route with `beforeLoad` auth guard (wraps all dashboard child routes)
- `src/routes/dashboard/index.tsx` - Dashboard home page
- `src/routes/dashboard/profile.tsx` - User profile page
- `src/routes/dashboard/settings.tsx` - Settings page
- `src/routes/__root.tsx` - Wraps app with AuthProvider

### How It Works

1. `AuthProvider` wraps the app and manages auth state via `supabase.auth.onAuthStateChange()`
2. Login page calls `supabase.auth.signInWithPassword()`
3. On success, user is redirected to `/dashboard`
4. Dashboard layout route (`/dashboard.tsx`) uses TanStack Router's `beforeLoad` hook to check the Supabase session before rendering -- redirects to `/login` if no session exists (prevents unauthenticated content flash)
5. Component-level `if (!user) return null` guard remains as a safety net
6. All child routes under `/dashboard/*` inherit auth protection from the layout route
7. Sign out calls `supabase.auth.signOut()` and redirects to login

### Server Function Auth

Server functions that access external APIs (FAL) require an `accessToken` parameter. The `requireAuth()` helper in `src/lib/server/auth.server.ts` verifies the token server-side via `supabase.auth.getUser(token)`. Client components pass `session.access_token` from `useAuth()` when calling server functions.

### Dependencies

- `@supabase/supabase-js` - Supabase client
- Supabase project (local via Docker or hosted)

## Usage

```typescript
import { useAuth } from "@/lib/auth";

function MyComponent() {
  const { user, loading, signIn, signOut } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Not authenticated</div>;

  return <div>Hello {user.email}</div>;
}
```

## Configuration

```bash
# Client-side (Vite)
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=...

# Server-side
SUPABASE_SERVICE_ROLE_KEY=...
```

## Testing

### Local

1. Run `supabase start`
2. Create user via Supabase Studio (http://localhost:54323) or sign up
3. Sign in at http://localhost:3000

### Production

- Test user: `demo@genzen.app` / `demo1234`

## Future Improvements

- Password reset flow
- OAuth providers (Google, GitHub)
- Email confirmation toggle
- Session refresh handling
- Remember me functionality
- Server-side session via cookies (eliminates need to pass access tokens from client)
