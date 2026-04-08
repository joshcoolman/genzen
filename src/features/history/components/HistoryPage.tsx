import { LayoutGrid, List, Search } from 'lucide-react'
import { useHistoryPage } from '../hooks/use-history-page'
import { useHistoryADContext } from '../hooks/useHistoryADContext'
import { HistoryGridView } from './HistoryGridView'
import { HistoryListView } from './HistoryListView'

export function HistoryPage() {
  const page = useHistoryPage()
  useHistoryADContext({
    search: page.search,
    total: page.total,
    viewMode: page.viewMode,
  })

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search prompts..."
            value={page.search}
            onChange={(e) => page.setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
          />
        </div>
        <button
          onClick={page.toggleView}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
          title={
            page.viewMode === 'grid'
              ? 'Switch to list view'
              : 'Switch to grid view'
          }
        >
          {page.viewMode === 'grid' ? (
            <List className="h-4 w-4" />
          ) : (
            <LayoutGrid className="h-4 w-4" />
          )}
        </button>
        {!page.isLoading && (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {page.total} {page.total === 1 ? 'generation' : 'generations'}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {page.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-foreground" />
          </div>
        ) : page.entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <p className="text-sm">
              {page.search
                ? 'No generations match your search'
                : 'No generations yet'}
            </p>
          </div>
        ) : page.viewMode === 'grid' ? (
          <HistoryGridView
            entries={page.entries}
            onCopyPrompt={page.copyPrompt}
            onUseAgain={page.useAgain}
          />
        ) : (
          <HistoryListView
            entries={page.entries}
            onCopyPrompt={page.copyPrompt}
            onUseAgain={page.useAgain}
          />
        )}
      </div>

      {/* Pagination */}
      {page.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-2">
          <button
            onClick={() => page.setPage(Math.max(0, page.page - 1))}
            disabled={page.page === 0}
            className="h-8 rounded-md border border-input bg-background px-3 text-xs disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            {page.page + 1} / {page.totalPages}
          </span>
          <button
            onClick={() =>
              page.setPage(Math.min(page.totalPages - 1, page.page + 1))
            }
            disabled={page.page >= page.totalPages - 1}
            className="h-8 rounded-md border border-input bg-background px-3 text-xs disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
