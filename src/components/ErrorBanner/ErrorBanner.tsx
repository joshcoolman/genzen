interface ErrorBannerProps {
  message: string
  action?: { label: string; onClick: () => void }
}

export function ErrorBanner({ message, action }: ErrorBannerProps) {
  return (
    <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
      <p className="text-sm text-destructive">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 text-xs font-medium text-destructive underline underline-offset-2 hover:no-underline"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
