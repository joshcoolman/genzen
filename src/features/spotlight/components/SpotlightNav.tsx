import { useCallback, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useHotkey } from '@tanstack/react-hotkeys'
import { getSpotlightItems } from '../lib/spotlight-items'
import { useAuth } from '@/lib/auth'
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

export function SpotlightNav() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const toggle = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  useHotkey(
    'Mod+K',
    (e) => {
      e.preventDefault()
      toggle()
    },
    { enabled: !!user },
  )

  if (!user) return null

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
              navigate({ to: item.href })
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
