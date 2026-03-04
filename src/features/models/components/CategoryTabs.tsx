import type { ModelCategory } from '../types'

const categories: Array<{ value: ModelCategory; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'text-to-image', label: 'Text to Image' },
  { value: 'image-to-video', label: 'Image to Video' },
  { value: 'text-to-video', label: 'Text to Video' },
]

interface CategoryTabsProps {
  value: ModelCategory
  onChange: (category: ModelCategory) => void
}

export function CategoryTabs({ value, onChange }: CategoryTabsProps) {
  return (
    <div className="flex gap-1">
      {categories.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onChange(cat.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === cat.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  )
}
