import { redirect } from 'next/navigation'

// /dashboard has no landing view of its own -- AI Images is the app.
export default function DashboardIndex() {
  redirect('/dashboard/ai-images')
}
