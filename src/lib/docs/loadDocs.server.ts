import { createServerFn } from '@tanstack/react-start'
import matter from 'gray-matter'
import { marked } from 'marked'
import { parseFileName, sortFileNames } from './parseFileName'
import { extractHeadings } from './extractHeadings'
import { slugToTitle, slugify } from './slugify'
import type { DocFile, DocNavCategory, DocNavItem } from './types'

// Bundle all markdown files at build time (no filesystem access at runtime)
const docModules = import.meta.glob('/docs/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

// Configure marked with heading IDs
const renderer = new marked.Renderer()
renderer.heading = ({ text, depth }: { text: string; depth: number }) => {
  const id = slugify(text)
  return `<h${depth} id="${id}">${text}</h${depth}>`
}

marked.use({ renderer, gfm: true })

interface DocEntry {
  slug: string
  fileName: string
  category?: string
  content: string
}

function buildDocEntries(): Array<DocEntry> {
  const rootEntries: Array<DocEntry> = []
  const categoryEntries: Map<string, Array<DocEntry>> = new Map()

  for (const [filePath, rawContent] of Object.entries(
    docModules as Record<string, string>,
  )) {
    const relativePath = filePath.replace(/^\/docs\//, '')
    const parts = relativePath.split('/')

    if (parts.length === 1) {
      const fileName = parts[0]
      if (!fileName.endsWith('.md') || fileName.startsWith('_')) continue
      const parsed = parseFileName(fileName)
      rootEntries.push({
        slug: parsed.slug,
        fileName,
        content: rawContent,
      })
    } else if (parts.length === 2) {
      const [dir, fileName] = parts
      if (
        dir.startsWith('_') ||
        !fileName.endsWith('.md') ||
        fileName.startsWith('_')
      )
        continue
      const parsed = parseFileName(fileName)
      if (!categoryEntries.has(dir)) categoryEntries.set(dir, [])
      categoryEntries.get(dir)!.push({
        slug: `${dir}/${parsed.slug}`,
        fileName,
        category: dir,
        content: rawContent,
      })
    }
  }

  // Sort root files by numeric prefix, then alphabetically
  const sortedRootFileNames = sortFileNames(rootEntries.map((e) => e.fileName))
  const sortedRoot = sortedRootFileNames.map(
    (fn) => rootEntries.find((e) => e.fileName === fn)!,
  )

  // Sort category dirs alphabetically, then files within each
  const sortedDirs = [...categoryEntries.keys()].sort()
  const sortedCategory: Array<DocEntry> = []
  for (const dir of sortedDirs) {
    const entries = categoryEntries.get(dir)!
    const sortedFileNames = sortFileNames(entries.map((e) => e.fileName))
    for (const fn of sortedFileNames) {
      sortedCategory.push(entries.find((e) => e.fileName === fn)!)
    }
  }

  return [...sortedRoot, ...sortedCategory]
}

function scanDocsDirectory(): Array<DocNavItem> {
  return buildDocEntries().map((entry) => ({
    slug: entry.slug,
    title: slugToTitle(entry.slug.split('/').pop()!),
    category: entry.category ? slugToTitle(entry.category) : undefined,
  }))
}

function readDocFile(slug: string): DocFile | null {
  const entries = buildDocEntries()
  const entry = entries.find((e) => e.slug === slug)
  if (!entry) return null

  const { data, content } = matter(entry.content)
  const html = marked(content) as string
  const parts = slug.split('/')

  return {
    slug,
    metadata: {
      title: data.title || slugToTitle(parts[parts.length - 1]),
      description: data.description,
      status: data.status,
      order: data.order,
    },
    content,
    html,
    category: entry.category ? slugToTitle(entry.category) : undefined,
  }
}

export const getAllDocSlugs = createServerFn({ method: 'GET' }).handler(() => {
  return scanDocsDirectory().map((item) => item.slug)
})

export const getDocBySlug = createServerFn({ method: 'GET' }).handler(
  (ctx: { data?: { slug?: string }; slug?: string }) => {
    const slug: string = ctx.data?.slug ?? ctx.slug ?? ''
    const doc = readDocFile(slug)
    if (!doc) throw new Error(`Doc not found: ${slug}`)

    const headings = extractHeadings(doc.content)
    return { doc, headings }
  },
)

export const getDocNavCategories = createServerFn({ method: 'GET' }).handler(
  () => {
    const items = scanDocsDirectory()
    const categories: Array<DocNavCategory> = []
    const uncategorized: Array<DocNavItem> = []

    for (const item of items) {
      if (item.category) {
        let cat = categories.find((c) => c.name === item.category)
        if (!cat) {
          cat = { name: item.category, items: [] }
          categories.push(cat)
        }
        cat.items.push(item)
      } else {
        uncategorized.push(item)
      }
    }

    // Put uncategorized items first as a "General" category
    const result: Array<DocNavCategory> = []
    if (uncategorized.length > 0) {
      result.push({ name: 'General', items: uncategorized })
    }
    result.push(...categories)

    return result
  },
)

export const getFirstDocSlug = createServerFn({ method: 'GET' }).handler(() => {
  const items = scanDocsDirectory()
  return items.length > 0 ? items[0].slug : null
})
