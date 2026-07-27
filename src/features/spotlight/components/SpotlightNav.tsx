'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useHotkey } from '@tanstack/react-hotkeys'
import { getSpotlightItems } from '../lib/spotlight-items'
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'

export function SpotlightNav() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const toggle = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  useHotkey(
    'Mod+K',
    (e) => {
      e.preventDefault()
      toggle()
    },
    { enabled: true },
  )

  const items = getSpotlightItems()

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Navigate"
      description="Search for a page to navigate to"
      showCloseButton={false}
    >
      <CommandInput placeholder="Go to..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {items.map((item) => (
          <CommandItem
            key={item.id}
            value={item.label}
            onSelect={() => {
              router.push(item.href)
              setOpen(false)
            }}
          >
            <item.icon />
            <span>{item.label}</span>
          </CommandItem>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
