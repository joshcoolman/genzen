import { Outlet, createFileRoute } from '@tanstack/react-router'
import { DocsSidebar } from '@/features/docs/components/DocsSidebar'
import { getDocNavCategories } from '@/lib/docs/loadDocs.server'

export const Route = createFileRoute('/docs')({
  loader: async () => {
    const categories = await getDocNavCategories()
    return { categories }
  },
  component: DocsLayout,
})

function DocsLayout() {
  const { categories } = Route.useLoaderData()

  return (
    <div className="flex h-[calc(100vh-49px)]">
      <DocsSidebar categories={categories} />
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
