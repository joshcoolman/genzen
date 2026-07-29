'use client'

import { useState } from 'react'
import { Key } from 'lucide-react'
import styles from './ad-setup.module.css'
import { useAnthropicKey } from '#/features/ad/hooks/useAnthropicKey'
import { ActionButton, Input } from '#/components'

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
    <div className={styles.root}>
      <div className={styles.badge}>
        <Key className={styles.badgeIcon} />
      </div>

      <div className={styles.copy}>
        <p className={styles.copyTitle}>Anthropic API Key</p>
        <p className={styles.copyBody}>
          Your key is stored locally in this browser and never sent to GenZen
          servers.
        </p>
      </div>

      <div className={styles.field}>
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
        {error && <p className={styles.error}>{error}</p>}
      </div>

      <ActionButton
        onClick={handleSave}
        className={styles.save}
        icon={<Key className={styles.saveIcon} />}
      >
        Save Key
      </ActionButton>
    </div>
  )
}
