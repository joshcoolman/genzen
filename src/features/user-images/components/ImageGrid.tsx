export { ImageGrid, ImageGridSkeleton } from '#/components/ImageGrid'

/**
 * Empty state component
 */
export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
      <div className="mb-4 text-4xl text-muted-foreground">No images</div>
      <h3 className="mb-2 text-lg font-semibold text-foreground">
        No images yet
      </h3>
      <p className="text-sm text-muted-foreground">
        Upload your first image to get started
      </p>
    </div>
  )
}
