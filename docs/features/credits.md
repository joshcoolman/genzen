## Overview

All AI operations (image generation, video, variations) cost credits. The system tracks balance, handles deduction/refund, and shows purchase UI when balance is low. Uses Supabase SECURITY DEFINER RPCs for all credit operations.

## How It Works

1. Features call `checkAndDeductCredits(accessToken, reason, quantity?)` before AI operations
2. Cost looked up from `CREDIT_COSTS` table (1 credit for most ops, 5 for video/multi-shot)
3. Deduction via Supabase RPC `deduct_credits`
4. Hook fires background `refresh()` after any credit change
5. `useRequireCredits()` auto-shows dialog when balance hits 0

## Usage

- Credits display in the nav header
- When balance is insufficient, a dialog shows with pack purchase options
- Credit packs: $2 (20 credits), $4 (40), $8 (80), $16 (160)

## Key Files

- `src/features/credits/types.ts` -- CreditRepository interface, CreditReason (9 reasons), CREDIT_COSTS table, CREDIT_PACKS, DOLLARS_PER_CREDIT (0.1)
- `src/features/credits/supabase-repository.ts` -- Production implementation using Supabase RPCs
- `src/features/credits/mock-repository.ts` -- In-memory mock for dev (47 credits, 4 fake transactions)
- `src/features/credits/server/check-credits.server.ts` -- `checkAndDeductCredits()` combines auth + cost lookup + deduction; also `refundCredits()`
- `src/features/credits/hooks/use-credits.ts` -- React context: balance, dollarBalance, isLow (<10), isEmpty
- `src/features/credits/hooks/use-insufficient-credits-dialog.ts` -- Dialog state for low-balance prompt
- `src/features/credits/components/InsufficientCreditsDialog.tsx` -- Modal with cost vs balance, pack selector

## Dependencies

- Supabase RPCs: `get_credit_balance`, `add_credits`, `deduct_credits`
- `@/lib/server/auth.server` -- authentication

## Cost Table

| Operation             | Cost      |
| --------------------- | --------- |
| Image generation      | 1 credit  |
| Variation             | 1 credit  |
| Edit                  | 1 credit  |
| Video generation      | 5 credits |
| Multi-shot generation | 5 credits |

## Database

- `credit_transactions` -- transaction history
- Supabase RPCs for balance operations (SECURITY DEFINER)
