# Credits

Credit balance system for metering AI generation usage. Repository pattern with Supabase backend.

## Key Files

- `types.ts` -- CreditRepository interface, CreditReason union (9 reasons), cost table (`CREDIT_COSTS`), pack definitions (`CREDIT_PACKS`), `DOLLARS_PER_CREDIT` (0.1)
- `index.ts` -- Factory function `getCreditRepository()`, re-exports types/constants
- `supabase-repository.ts` -- Production implementation using Supabase RPCs (`get_credit_balance`, `deduct_credits`, `add_credits`); direct table queries for `credit_transactions`
- `handle-credit-error.ts` -- Helper to detect "Insufficient credits" errors
- `server/check-credits.server.ts` -- `checkAndDeductCredits(accessToken, reason, quantity?)` combines auth + cost lookup + deduction; also exports `refundCredits()` and `withCreditRefund<T>()` (wraps post-deduction work with automatic refund on failure)
- `server/add-credits.server.ts` -- TanStack server fn for adding credits
- `server/purchase-credits.server.ts` -- TanStack server fn for purchasing credit packs (validates pack, calls addCreditsInternal)
- `server/get-credits.server.ts` -- TanStack server fn returning balance + usage stats
- `server/get-transactions.server.ts` -- TanStack server fn for transaction history (optional limit)
- `hooks/use-credits.ts` -- React context provider hook `useCreditsProvider()` + `useCredits()` consumer; manages balance, dollarBalance, isLow (<10), isEmpty
- `hooks/use-insufficient-credits-dialog.ts` -- Dialog state management for low-balance prompt
- `hooks/use-require-credits.ts` -- Auto-shows insufficient credits dialog when balance is completely empty (isEmpty check)
- `components/CreditsProvider.tsx` -- Context provider wrapping `useCreditsProvider`; exposes `showInsufficientCredits()` through context
- `components/CreditPackSelector.tsx` -- Radio group UI for buying credit packs; pre-selects second pack (40 credits, Creator)
- `components/InsufficientCreditsDialog.tsx` -- Modal showing cost vs balance; embeds CreditPackSelector; shows success state after purchase

## Shared Dependencies

- `@/lib/server/supabase-admin.server` -- Supabase admin client for server operations
- `@/lib/server/auth.server` -- `requireAuth()` for all server functions
- `@/components/ui/radio-group` -- shadcn radio group in pack selector
- `@/components/ui/dialog` -- shadcn dialog in insufficient credits modal
- `@/components/ActionButton` -- Loading-state button for purchases

## Quirks / Notes

- ALL credit operations use Supabase SECURITY DEFINER RPCs: `get_credit_balance`, `add_credits`, `deduct_credits`
- After `add()` or `deduct()`, the hook fires a background `refresh()` to re-fetch authoritative balance
- `checkAndDeductCredits` is the main entry point other features call; supports optional `quantity` multiplier
- Video generation and multi-shot generation cost 5 credits; all other operations cost 1
- `isLow` threshold is < 10 credits; `isEmpty` is exactly 0
- `useRequireCredits()` only checks `isEmpty`, not whether balance covers specific cost
- Credit packs: $2 (20), $4 (40), $8 (80), $16 (160)
