'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import styles from './board-heading.module.css'

/**
 * Which board you are on, and the way back to the others (#446).
 *
 * The same two parts as a group's heading -- a round back control and the name,
 * one click target -- but floating over the plane rather than sitting in a
 * content column, because a canvas has no column: it is the whole viewport.
 *
 * It exists because a board is now one of several. With a single canvas the
 * route said everything there was to say; with five, arriving somewhere that
 * does not name itself means checking the URL to find out where you are.
 *
 * A `Link`, not a router push: it is navigation to a real address, so it should
 * open in a new tab on a modifier-click like any other.
 */
export function BoardHeading({ name }: { name: string }) {
  return (
    <Link href="/canvas" className={styles.row} title="All canvases">
      <span className={styles.back} aria-hidden="true">
        <ChevronLeft className={styles.backIcon} />
      </span>
      <span className={styles.name}>{name}</span>
    </Link>
  )
}
