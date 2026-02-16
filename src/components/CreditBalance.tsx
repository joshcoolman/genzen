import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

/**
 * Credit balance component
 * Currently links to FAL dashboard since they don't expose a public balance API
 * Future: Show GenZen credits or user's BYOK balance
 */
export function CreditBalance() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="text-xs">Credits:</span>
      <Button
        variant="outline"
        size="sm"
        asChild
        className="h-7 text-xs"
      >
        <a
          href="https://fal.ai/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5"
        >
          View FAL Balance
          <ExternalLink className="h-3 w-3" />
        </a>
      </Button>
    </div>
  )
}
