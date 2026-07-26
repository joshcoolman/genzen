import { LoginForm } from './_components/login-form'

// No signed-in check here. `proxy.ts` bounces an authenticated request to
// /dashboard before this component runs, which is what retires the
// loading/redirect dance the TanStack version needed.
export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <LoginForm />
      </div>
    </div>
  )
}
