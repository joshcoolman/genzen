export interface DocMetadata {
  title: string
  description?: string
  status?: string
  order?: number
}

export interface DocFile {
  slug: string
  metadata: DocMetadata
  content: string
  html: string
  category?: string
}

export interface DocNavItem {
  slug: string
  title: string
  category?: string
}

export interface DocNavCategory {
  name: string
  items: Array<DocNavItem>
}

export interface TocHeading {
  id: string
  text: string
  level: number
}
