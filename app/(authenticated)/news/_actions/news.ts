'use server'

import {
  deletePost,
  regenHero,
  researchNews,
} from '../_lib/news-program.server'
import type { ActionResult } from '#/lib/effect/result'
import type { NewsPost } from '#/lib/types/db'
import { runAction } from '#/lib/effect/run-action.server'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'

/**
 * The boundary, and nothing else (#721).
 *
 * Each of these resolves who is asking, hands an Effect program to
 * `runAction`, and returns `{ ok, value } | { ok, error }`. The pipeline lives
 * in `_lib/news-program.server.ts`: an action module may only export async
 * functions, so the programs cannot be exported from here -- and keeping them
 * out is what lets the tests run them against fake Layers.
 *
 * `listNewsPosts` and `getNewsPost` stay plain reads. They are awaited by
 * server components that want the rows, not a result envelope, and a select
 * with a `user_id` filter has no failure worth a tag.
 */

export async function getNews(
  guidance: string,
): Promise<ActionResult<Array<NewsPost>>> {
  const { userId } = await resolveAuth()
  return runAction(researchNews(userId, guidance))
}

export async function regenHeroImage(
  postId: string,
): Promise<ActionResult<string | null>> {
  const { userId } = await resolveAuth()
  return runAction(regenHero(userId, postId))
}

export async function deleteNewsPost(
  postId: string,
): Promise<ActionResult<void>> {
  const { userId } = await resolveAuth()
  return runAction(deletePost(userId, postId))
}

export async function listNewsPosts(): Promise<Array<NewsPost>> {
  const { userId } = await resolveAuth()
  return sql<Array<NewsPost>>`
    select
      id, user_id, title, what_happened, why_interesting, the_details,
      for_genzen, hero_image_id, source_links, run_id,
      created_at::text as created_at
    from news_posts
    where user_id = ${userId}
    order by created_at desc
  `
}

export async function getNewsPost(id: string): Promise<NewsPost | null> {
  const { userId } = await resolveAuth()
  const rows = await sql<Array<NewsPost>>`
    select
      id, user_id, title, what_happened, why_interesting, the_details,
      for_genzen, hero_image_id, source_links, run_id,
      created_at::text as created_at
    from news_posts
    where id = ${id} and user_id = ${userId}
  `
  return first(rows) ?? null
}
