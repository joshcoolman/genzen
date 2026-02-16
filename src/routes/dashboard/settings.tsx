import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div className="bg-card rounded-lg p-6 space-y-4">
        <h2 className="font-medium">Preferences</h2>
        <p className="text-sm text-muted-foreground">
          Settings configuration coming soon.
        </p>
      </div>
    </div>
  )
}
