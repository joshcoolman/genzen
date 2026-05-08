# Credits

Credit balance system for metering AI generation usage. Repository pattern with Supabase backend.

## Key Files

- `types.ts` -- CreditRepository interface, CreditReason union (9 reasons), cost table (`CREDIT_COSTS`), pack definitions (`CREDIT_PACKS`: $20/$40/$60/$80), `DOLLARS_PER_CREDIT` (0.1)
- `index.ts` -- Factory function `getCreditRepository()`, re-exports types/constants
- `supabase-repository.ts` -- Production implementation using Supabase RPCs (`get_credit_balance`, `deduct_credits`, `add_credits` w/ optional `p_stripe_event_id`); direct table queries for `credit_transactions`
- `handle-credit-error.ts` -- Helper to detect "Insufficient credits" errors
- `server/check-credits.server.ts` -- `checkAndDeductCredits(auth, reason, quantity?)` combines auth + cost lookup + deduction; `auth` accepts access token string or `{ userId }` / `{ accessToken }` object. Also exports `refundCredits()` and `withCreditRefund<T>()` (wraps post-deduction work with automatic refund on failure)
- `server/add-credits.server.ts` -- Internal helper `addCreditsInternal(userId, amount, reason, stripeEventId?)`. The optional event id enables webhook idempotency via `credit_transactions.stripe_event_id` unique constraint (Postgres 23505 = already processed)
- `server/create-checkout-session.server.ts` -- TanStack server fn that creates a Stripe Checkout Session. Looks up or creates a Stripe customer, persists `stripe_customer_id` on `user_profiles`, returns `{ url }` for client redirect. The webhook (`server/api/stripe-webhook.post.ts`) grants credits on `checkout.session.completed`.
- `server/get-credits.server.ts` -- TanStack server fn returning balance + usage stats
- `server/get-transactions.server.ts` -- TanStack server fn for transaction history (optional limit)
- `hooks/use-credits.ts` -- React context provider hook `useCreditsProvider()` + `useCredits()` consumer; manages balance, dollarBalance, isLow (<10), isEmpty
- `hooks/use-insufficient-credits-dialog.ts` -- Dialog state management for low-balance prompt
- `hooks/use-require-credits.ts` -- Auto-shows insufficient credits dialog when balance is completely empty (isEmpty check)
- `components/CreditsProvider.tsx` -- Context provider wrapping `useCreditsProvider`; exposes `showInsufficientCredits()` through context
- `components/CreditPackSelector.tsx` -- Radio group UI for buying credit packs; pre-selects second pack (400 credits, Creator). Click "Buy" -> creates Checkout Session -> redirects to Stripe-hosted page
- `components/InsufficientCreditsDialog.tsx` -- Modal showing cost vs balance; embeds CreditPackSelector. Closes when user is redirected to Stripe; success/cancel feedback is shown on `/dashboard/account` after redirect
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
- Credit packs: $20 (200), $40 (400), $60 (600), $80 (800). Smaller packs were dropped because Stripe's $0.30 flat fee makes sub-$20 transactions unworkable (an $8 pack would lose ~7% to fees).
- Stripe integration: Hosted Checkout. `create-checkout-session.server.ts` returns a URL the client redirects to. `server/api/stripe-webhook.post.ts` listens for `checkout.session.completed` and grants credits via `addCreditsInternal(..., stripeEventId)`. Webhook idempotency: unique constraint on `credit_transactions.stripe_event_id` raises `23505` on duplicate delivery, which the handler treats as already-processed.
- `stripe_customer_id` is stored on `user_profiles` and looked up on each checkout to avoid creating duplicate Stripe customers
