'use client'

import { useState } from 'react'
import { Key } from 'lucide-react'
import { useAnthropicKey } from '#/features/ad/hooks/useAnthropicKey'
import { Input } from '#/components/ui/input'
import { ActionButton } from '#/components/ActionButton'

export function ADSetup() {
  const { setApiKey } = useAnthropicKey()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  function handleSave() {
    const trimmed = value.trim()
    if (!trimmed.startsWith('sk-ant-')) {
      setError('Key must start with sk-ant-')
      return
    }
    setApiKey(trimmed)
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Key className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="space-y-1 text-center">
        <p className="text-sm font-medium">Anthropic API Key</p>
        <p className="text-xs text-muted-foreground">
          Your key is stored locally in this browser and never sent to GenZen
          servers.
        </p>
      </div>

      <div className="w-full space-y-2">
        <Input
          type="password"
          placeholder="sk-ant-..."
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
          }}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <ActionButton
        onClick={handleSave}
        className="w-full"
        icon={<Key className="h-4 w-4" />}
      >
        Save Key
      </ActionButton>
    </div>
  )
}
