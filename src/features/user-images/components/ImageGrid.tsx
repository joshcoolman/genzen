/**
 * Image Grid Component
 *
 * Responsive grid layout for displaying image cards.
 */

import type { ReactNode } from "react";

interface ImageGridProps {
  children: ReactNode;
  className?: string;
}

/**
 * Responsive grid container for images
 *
 * Grid breakpoints:
 * - Mobile: 1 column
 * - Tablet: 2 columns
 * - Desktop: 3 columns
 * - Large: 4 columns
 */
export function ImageGrid({ children, className = "" }: ImageGridProps) {
  return (
    <div
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 ${className}`}
    >
      {children}
    </div>
  );
}

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
  );
}
