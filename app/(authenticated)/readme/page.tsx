import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { marked } from 'marked'
import styles from './readme.module.css'

// Re-read the file every request so README edits show on refresh, no rebuild.
export const dynamic = 'force-dynamic'

export default async function Readme() {
  const source = await readFile(path.join(process.cwd(), 'README.md'), 'utf8')
  const html = await marked.parse(source)
  return (
    <article
      className={styles.markdown}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
