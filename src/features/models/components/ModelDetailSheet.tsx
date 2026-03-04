import { ExternalLink, Loader2 } from 'lucide-react'
import type { FalModel, FalModelPricing } from '../types'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'

interface ModelDetailSheetProps {
  model: FalModel | null
  pricing: FalModelPricing | null
  pricingLoading: boolean
  onClose: () => void
}

export function ModelDetailSheet({
  model,
  pricing,
  pricingLoading,
  onClose,
}: ModelDetailSheetProps) {
  return (
    <Sheet open={!!model} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto">
        {model && (
          <>
            <SheetHeader>
              <SheetTitle>{model.display_name}</SheetTitle>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {model.thumbnail_url && (
                <div className="overflow-hidden rounded-lg">
                  <img
                    src={model.thumbnail_url}
                    alt={model.display_name}
                    className="w-full object-cover"
                  />
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Category</h4>
                <Badge variant="secondary">{model.category}</Badge>
              </div>

              {model.description && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    {model.description}
                  </p>
                </div>
              )}

              {model.tags.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {model.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Endpoint ID</h4>
                <code className="block rounded bg-muted px-2 py-1 text-xs">
                  {model.endpoint_id}
                </code>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Pricing</h4>
                {pricingLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading pricing...
                  </div>
                ) : pricing?.pricing ? (
                  <div className="rounded border p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base price</span>
                      <span>${pricing.pricing.base_price.toFixed(4)}</span>
                    </div>
                    {pricing.pricing.per_megapixel != null && (
                      <div className="mt-1 flex justify-between">
                        <span className="text-muted-foreground">
                          Per megapixel
                        </span>
                        <span>${pricing.pricing.per_megapixel.toFixed(4)}</span>
                      </div>
                    )}
                    {pricing.pricing.per_second != null && (
                      <div className="mt-1 flex justify-between">
                        <span className="text-muted-foreground">
                          Per second
                        </span>
                        <span>${pricing.pricing.per_second.toFixed(4)}</span>
                      </div>
                    )}
                    {pricing.pricing.description && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {pricing.pricing.description}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Pricing not available
                  </p>
                )}
              </div>

              <a
                href={`https://fal.ai/models/${model.endpoint_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                View on fal.ai
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
