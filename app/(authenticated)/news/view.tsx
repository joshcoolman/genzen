'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useView } from './use-view'
import styles from './view.module.css'
import type { NewsPost } from '#/lib/types/db'
import { Button, Input, PageHeader, Stack } from '#/components'
import { imageUrl } from '#/lib/image-url'

function NewsCard({
  post,
  isRegen,
  onRegen,
}: {
  post: NewsPost
  isRegen: boolean
  onRegen: (id: string) => void
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
    <Link href={`/news/${post.id}`} className={styles.card}>
      {coverSlot}
      <div className={styles.caption}>
        <h2 className={styles.cardTitle}>{post.title}</h2>
        <p className={styles.cardDesc}>{post.what_happened}</p>
      </div>
    </Link>
  )
}

export function View({ initial }: { initial: Array<NewsPost> }) {
  const { posts, isFetching, error, fetchNews, regenIds, regenImage } =
    useView(initial)
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
        {error && <p className={styles.error}>{error}</p>}
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
            />
          ))}
        </div>
      )}
    </Stack>
  )
}
