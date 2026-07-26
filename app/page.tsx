import { redirect } from 'next/navigation'

// There is no marketing homepage. `proxy.ts` has already sent an unauthenticated
// request to /login by the time this runs, so reaching here means signed in.
export default function Home() {
  redirect('/dashboard')
}
