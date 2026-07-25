# Credits

Credit balance system for metering AI generation usage. Repository pattern with Supabase backend.

## Key Files

- `types.ts` -- CreditRepository interface, CreditReason union (9 reasons), cost table (`CREDIT_COSTS`), `DOLLARS_PER_CREDIT` (0.1)
- `index.ts` -- Factory function `getCreditRepository()`, re-exports types/constants
- `supabase-repository.ts` -- Production implementation using Supabase RPCs (`get_credit_balance`, `deduct_credits`, `add_credits`); direct table queries for `credit_transactions`
- `handle-credit-error.ts` -- Helper to detect "Insufficient credits" errors
- `server/check-credits.server.ts` -- `checkAndDeductCredits(auth, reason, quantity?)` combines auth + cost lookup + deduction; `auth` accepts access token string or `{ userId }` / `{ accessToken }` object. Also exports `refundCredits()` and `withCreditRefund<T>()` (wraps post-deduction work with automatic refund on failure)
- `server/add-credits.server.ts` -- Internal helper `addCreditsInternal(userId, amount, reason)`
- `server/get-credits.server.ts` -- TanStack server fn returning balance + usage stats
- `server/get-transactions.server.ts` -- TanStack server fn for transaction history (optional limit)
- `hooks/use-credits.ts` -- React context provider hook `useCreditsProvider()` + `useCredits()` consumer; manages balance, dollarBalance, isLow (<10), isEmpty
- `hooks/use-insufficient-credits-dialog.ts` -- Dialog state management for low-balance prompt
- `hooks/use-require-credits.ts` -- Auto-shows insufficient credits dialog when balance is completely empty (isEmpty check)
- `components/CreditsProvider.tsx` -- Context provider wrapping `useCreditsProvider`; exposes `showInsufficientCredits()` through context
- `components/InsufficientCreditsDialog.tsx` -- Modal showing cost vs balance
- `components/TransactionHistory.tsx` -- Last 20 credit transactions surfaced on the account page (rendered via `getTransactions`). Refetches when balance changes so a fresh top-up appears immediately

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
