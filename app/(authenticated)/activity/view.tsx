'use client'

import { DetailPanel } from './_components/detail-panel/detail-panel'
import { Filters } from './_components/filters/filters'
import { RunTable } from './_components/run-table/run-table'
import { Totals } from './_components/totals/totals'
import { useView } from './use-view'
import { PageHeader, Pagination, Stack } from '#/components'

export function View() {
  const {
    entries,
    total,
    totalPages,
    totals,
    isLoading,
    page,
    setPage,
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    getThumbUrl,
    selectedId,
    setSelectedId,
  } = useView()

  return (
    <Stack gap={24}>
      <PageHeader
        title="Activity"
        description="Every generation you've run. Includes failures and deleted items."
      />

      <Totals totals={totals} hasActiveFilters={hasActiveFilters} />

      <Filters
        filters={filters}
        onChange={setFilters}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <RunTable
        entries={entries}
        isLoading={isLoading}
        hasActiveFilters={hasActiveFilters}
        getThumbUrl={getThumbUrl}
        onSelect={setSelectedId}
      />

      <DetailPanel
        entryId={selectedId}
        onClose={() => setSelectedId(null)}
        getThumbUrl={getThumbUrl}
      />

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        itemNoun="run"
        onChange={setPage}
      />
    </Stack>
  )
}
