# Credits

Credit balance system for metering AI generation usage. Repository pattern with Supabase backend and mock for dev.

## Key Files

- `types.ts` -- CreditRepository interface, CreditReason union, cost table, pack definitions
- `index.ts` -- Factory function `getCreditRepository()`, re-exports types/constants
- `supabase-repository.ts` -- Production implementation using Supabase RPCs (`deduct_credits`, `add_credits`)
- `mock-repository.ts` -- In-memory mock with seed data (47 credits)
- `handle-credit-error.ts` -- Helper to detect "Insufficient credits" errors
- `server/check-credits.server.ts` -- `checkAndDeductCredits()` combines auth + cost lookup + deduction
- `server/deduct-credits.server.ts` -- TanStack server fn for deducting credits
- `server/add-credits.server.ts` -- TanStack server fn for adding credits
- `server/get-credits.server.ts` -- TanStack server fn returning balance + usage stats
- `server/get-transactions.server.ts` -- TanStack server fn for transaction history
- `hooks/use-credits.ts` -- React context provider hook + `useCredits()` consumer hook
- `hooks/use-insufficient-credits-dialog.ts` -- Dialog state management for low-balance prompt
- `hooks/use-require-credits.ts` -- Pre-action credit check hook used by ai-images, ai-video, multi-shot
- `components/CreditsProvider.tsx` -- Context provider wrapping `useCreditsProvider` + insufficient credits dialog
- `components/CreditPackSelector.tsx` -- Radio group UI for buying credit packs
- `components/InsufficientCreditsDialog.tsx` -- Modal shown when user can't afford an action

## Shared Dependencies

- `@/lib/server/supabase-admin.server` -- Supabase admin client for server operations
- `@/lib/server/auth.server` -- `requireAuth()` for all server functions
- `@/components/ui/radio-group` -- shadcn radio group in pack selector
- `@/components/ui/dialog` -- shadcn dialog in insufficient credits modal
- `@/components/ActionButton` -- Loading-state button for purchases

## Quirks / Notes

- ALL credit operations use Supabase SECURITY DEFINER RPCs: `get_credit_balance`, `add_credits`, `deduct_credits`
- Direct table queries must NOT be used for credit reads -- RLS blocks them if the admin client lacks the service role key
- After `add()` or `deduct()`, the hook fires a background `refresh()` to re-fetch authoritative balance
- `checkAndDeductCredits` is the main entry point other features call to gate AI operations
- Video generation and multi-shot generation cost 5 credits; all other operations cost 1
- `isLow` threshold is < 10 credits
- Transaction reads (`getTransactions`, `getUsageStats`) still use direct queries via admin client -- these are non-critical display data
