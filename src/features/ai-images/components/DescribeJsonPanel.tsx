import type { useDescribeJson } from '@/features/ai-images/hooks/use-describe-json'
import { Button } from '@/components/ui/button'
import { JsonSyntaxHighlight } from '@/components/JsonSyntaxHighlight'

interface DescribeJsonPanelProps {
  describe: ReturnType<typeof useDescribeJson>
  imageUrl: string | undefined
}

export function DescribeJsonPanel({
  describe,
  imageUrl,
}: DescribeJsonPanelProps) {
  if (!imageUrl) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={describe.handleDescribe}
          disabled={describe.jsonLoading}
        >
          {describe.jsonLoading ? 'Describing...' : 'Describe JSON'}
        </Button>
        {describe.jsonDescription && (
          <button
            onClick={describe.clearDescription}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      {describe.error && (
        <p className="text-sm text-destructive">{describe.error}</p>
      )}
      {describe.jsonDescription && (
        <JsonSyntaxHighlight json={describe.jsonDescription} />
      )}
    </div>
  )
}
