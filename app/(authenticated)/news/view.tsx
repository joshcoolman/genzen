'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ImageIcon, MoreHorizontal, Trash2 } from 'lucide-react'
import { useView } from './use-view'
import styles from './view.module.css'
import type { NewsPost } from '#/lib/types/db'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  PageHeader,
  Stack,
} from '#/components'
import { imageUrl } from '#/lib/image-url'

/**
 * Delete is drawn only under `pnpm dev`, matching the action's own guard.
 * Read at module scope: `NODE_ENV` is inlined at build time, so the branch is
 * eliminated from the production bundle rather than evaluated in the browser.
 */
const CAN_DELETE = process.env.NODE_ENV === 'development'

/**
 * The card's own actions, over the cover.
 *
 * A sibling of the card's `<a>`, not a child of it. A `<button>` inside an
 * anchor is invalid HTML and the nesting is what breaks first in practice:
 * keyboard traversal and assistive tech both have to guess which of two
 * interactive elements they are on, and every menu item needs a
 * `preventDefault` to stop navigating. Absolutely positioning it against the
 * wrapper costs one `<div>` and the problem goes away.
 *
 * New thumbnail and Retry are one action (`regenHeroImage`) under two names.
 * The name is the difference that matters: Retry sits on the cover of a post
 * whose image failed and is the obvious thing to press, while a post that
 * already has one needs a menu, because replacing a picture you can see is a
 * deliberate act rather than a repair.
 */
function CardMenu({
  post,
  onRegen,
  onDelete,
}: {
  post: NewsPost
  onRegen: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={styles.menuBtn}
            aria-label="Post actions"
          >
            <MoreHorizontal className={styles.menuIcon} />
          </button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onRegen(post.id)}>
          <ImageIcon />
          New thumbnail
        </DropdownMenuItem>
        {CAN_DELETE && (
          <DropdownMenuItem onClick={() => onDelete(post.id)}>
            <Trash2 />
            Delete article
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NewsCard({
  post,
  isRegen,
  onRegen,
  onDelete,
}: {
  post: NewsPost
  isRegen: boolean
  onRegen: (id: string) => void
  onDelete: (id: string) => void
}) {
  const coverSlot = isRegen ? (
    <div className={styles.coverLoading} />
  ) : post.hero_image_id ? (
    <img
      src={imageUrl(post.hero_image_id, 'thumb')}
      alt=""
      className={styles.cover}
    />
  ) : (
    <div className={styles.retryWrap}>
      <div className={styles.coverEmpty} />
      <button
        className={styles.retryBtn}
        onClick={(e) => {
          e.preventDefault()
          onRegen(post.id)
        }}
        aria-label="Retry image generation"
      >
        <span className={styles.retryLabel}>Retry image</span>
      </button>
    </div>
  )

  return (
    <div className={styles.cardWrap}>
      <Link href={`/news/${post.id}`} className={styles.card}>
        {coverSlot}
        <div className={styles.caption}>
          <h2 className={styles.cardTitle}>{post.title}</h2>
          <p className={styles.cardDesc}>{post.what_happened}</p>
        </div>
      </Link>
      {!isRegen && (
        <CardMenu post={post} onRegen={onRegen} onDelete={onDelete} />
      )}
    </div>
  )
}

export function View({ initial }: { initial: Array<NewsPost> }) {
  const {
    posts,
    isFetching,
    error,
    fetchNews,
    regenIds,
    regenImage,
    deletePost,
  } = useView(initial)
  const [guidance, setGuidance] = useState('')

  return (
    <Stack gap={24}>
      <PageHeader
        title="News"
        description={
          posts.length > 0
            ? `${posts.length} ${posts.length === 1 ? 'post' : 'posts'}`
            : undefined
        }
      />

      <div className={styles.controls}>
        <div className={styles.guidanceBox}>
          <Input
            className={styles.guidanceInput}
            type="text"
            placeholder="Optional: paste a link, describe something on X, or steer the search"
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isFetching) fetchNews(guidance)
            }}
            disabled={isFetching}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={() => fetchNews(guidance)}
            disabled={isFetching}
          >
            {isFetching ? 'Searching...' : 'Get news'}
          </Button>
        </div>
        {error && <p className={styles.error}>{error.message}</p>}
      </div>

      {posts.length === 0 ? (
        <p className={styles.empty}>
          Press Get news to fetch the latest in image and video generation.
        </p>
      ) : (
        <div className={styles.feed}>
          {posts.map((post) => (
            <NewsCard
              key={post.id}
              post={post}
              isRegen={regenIds.has(post.id)}
              onRegen={regenImage}
              onDelete={deletePost}
            />
          ))}
        </div>
      )}
    </Stack>
  )
}
