import { createFileRoute, redirect } from '@tanstack/react-router'
import { getFirstDocSlug } from '@/lib/docs/loadDocs.server'

export const Route = createFileRoute('/docs/')({
  loader: async () => {
    const firstSlug = await getFirstDocSlug()
    if (firstSlug) {
      throw redirect({ to: `/docs/${firstSlug}` as string })
    }
    return {}
  },
  component: () => (
    <div className="p-8 text-muted-foreground">No documentation found.</div>
  ),
})
