import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useApiKeys } from '../hooks/use-api-keys'
import { CreateApiKeyDialog } from './CreateApiKeyDialog'
import type { ApiKey } from '../types'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CopyButton } from '@/components/CopyButton'

function formatDate(iso: string | null): string {
  if (!iso) return 'Never'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function buildInstallTemplate(): string {
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:3000'
  return `claude mcp add --transport http genzen ${origin}/api/mcp --header "Authorization: Bearer <YOUR_GENZEN_KEY>"`
}

export function ApiKeysSection() {
  const { keys, loading, createKey, revokeKey } = useApiKeys()
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null)
  const [revoking, setRevoking] = useState(false)

  const activeKeys = keys.filter((k) => !k.revoked_at)
  const revokedKeys = keys.filter((k) => k.revoked_at)

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      await revokeKey(revokeTarget.id)
      setRevokeTarget(null)
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div className="bg-card rounded-lg p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">API keys</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Personal access tokens for the Genzen MCP server. Treat them like
            passwords.
          </p>
        </div>
        <CreateApiKeyDialog onCreate={createKey} />
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Install in Claude Code
        </p>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3 font-mono text-xs break-all">
          <span className="flex-1">{buildInstallTemplate()}</span>
          <CopyButton text={buildInstallTemplate()} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Replace <code className="font-mono">{'<YOUR_GENZEN_KEY>'}</code> with
          a key you saved when you created it. Keys are only shown once — if you
          lost it, revoke it and create a new one.
        </p>
      </div>

      {loading && keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t created any API keys yet.
        </p>
      ) : (
        <div className="space-y-2">
          {[...activeKeys, ...revokedKeys].map((key) => {
            const isRevoked = !!key.revoked_at
            return (
              <div
                key={key.id}
                className={`flex items-center gap-4 rounded-md border border-border px-4 py-3 ${
                  isRevoked ? 'opacity-50' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {key.name}
                    </span>
                    {isRevoked && (
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                        Revoked
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {key.key_prefix}…
                  </div>
                </div>
                <div className="hidden text-xs text-muted-foreground sm:block">
                  <div>Created {formatDate(key.created_at)}</div>
                  <div>Last used {formatDate(key.last_used_at)}</div>
                </div>
                {!isRevoked && (
                  <button
                    type="button"
                    onClick={() => setRevokeTarget(key)}
                    className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    aria-label={`Revoke ${key.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke this API key?"
        description={
          revokeTarget
            ? `"${revokeTarget.name}" will stop working immediately. This cannot be undone.`
            : ''
        }
        confirmLabel="Revoke"
        onConfirm={handleConfirmRevoke}
        loading={revoking}
      />
    </div>
  )
}
