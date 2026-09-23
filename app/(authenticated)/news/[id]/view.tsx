import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import styles from './view.module.css'
import type { NewsPost } from '#/lib/types/db'
import { imageUrl } from '#/lib/image-url'

interface Section {
  label: string
  body: string
}

export function PostView({ post }: { post: NewsPost }) {
  const sections: Array<Section> = [
    { label: 'What happened', body: post.what_happened },
    { label: 'Why it is interesting', body: post.why_interesting },
    { label: 'The details', body: post.the_details },
    { label: 'For genzen', body: post.for_genzen },
  ]

  return (
    <div className={styles.page}>
      {/* Not PageHeader: that pins its aside to the far edge of the content
          area, and the way out belongs beside the title it leaves -- the same
          shape as GroupHeading and BoardHeading, chevron first. */}
      <div className={styles.heading}>
        <Link href="/news" className={styles.backBtn} aria-label="Back to News">
          <ChevronLeft className={styles.backIcon} />
        </Link>
        <h1 className={styles.title}>{post.title}</h1>
      </div>

      {post.hero_image_id && (
        <img
          src={imageUrl(post.hero_image_id, 'full')}
          alt=""
          className={styles.hero}
        />
      )}

      <div className={styles.sections}>
        {sections.map((s) => (
          <div key={s.label} className={styles.section}>
            <p className={styles.sectionLabel}>{s.label}</p>
            <p className={styles.sectionBody}>{s.body}</p>
          </div>
        ))}

        {post.source_links.length > 0 && (
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Sources</p>
            <div className={styles.sources}>
              {post.source_links.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.sourceLink}
                >
                  {url}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
