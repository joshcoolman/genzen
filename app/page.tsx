import { redirect } from 'next/navigation'

// There is no marketing homepage, and no landing view behind the login either --
// Images is the app. `proxy.ts` has already sent an unauthenticated request to
// /login by the time this runs, so reaching here means signed in.
export default function Home() {
  redirect('/images')
}
