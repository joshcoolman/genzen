'use client'

import { DetailPanel } from './_components/detail-panel/detail-panel'
import { Filters } from './_components/filters/filters'
import { RunTable } from './_components/run-table/run-table'
import { useView } from './use-view'
import { PageHeader, Pagination, Stack } from '#/components'

export function View() {
  const {
    entries,
    total,
    totalPages,
    isLoading,
    page,
    setPage,
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    selectedId,
    setSelectedId,
  } = useView()

  return (
    <Stack gap={24}>
      <PageHeader title="Activity" />

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
        onSelect={setSelectedId}
      />

      <DetailPanel entryId={selectedId} onClose={() => setSelectedId(null)} />

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
