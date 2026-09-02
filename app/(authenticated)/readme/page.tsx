import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { marked } from 'marked'
import styles from './readme.module.css'

// Re-read the file every request so README edits show on refresh, no rebuild.
export const dynamic = 'force-dynamic'

export default async function Readme() {
  const source = await readFile(path.join(process.cwd(), 'README.md'), 'utf8')
  // Image paths are written repo-relative so GitHub renders them. Here they are
  // served from `public/`, and a relative src would resolve against `/readme/`.
  const html = (await marked.parse(source)).replaceAll('src="public/', 'src="/')
  return (
    <article
      className={styles.markdown}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
