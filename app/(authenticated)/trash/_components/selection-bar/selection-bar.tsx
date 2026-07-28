'use client'

import { RotateCcw, Trash2 } from 'lucide-react'
import styles from './selection-bar.module.css'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  SelectionDrawer,
} from '#/components'

interface SelectionBarProps {
  count: number
  busy: boolean
  onClear: () => void
  onRestore: () => void
  onDelete: () => void
}

export function SelectionBar({
  count,
  busy,
  onClear,
  onRestore,
  onDelete,
}: SelectionBarProps) {
  return (
    <SelectionDrawer count={count} onClear={onClear}>
      <Button variant="ghost" size="sm" disabled={busy} onClick={onRestore}>
        <RotateCcw className={styles.icon} />
        Restore ({count})
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={busy}>
            <Trash2 className={styles.icon} />
            Delete ({count})
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {count} items?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {count}{' '}
              {count === 1 ? 'item' : 'items'} and their files. Linked items
              will be skipped. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SelectionDrawer>
  )
}
