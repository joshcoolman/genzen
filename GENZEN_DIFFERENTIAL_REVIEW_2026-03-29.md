# Differential Security Review: Credit System Hardening

**Branch:** `feature/38-harden-credit-system`
**Commit Range:** `main..afa8255` (2 commits)
**Date:** 2026-03-29
**Strategy:** FOCUSED (19 files changed, MEDIUM codebase)

---

## Executive Summary

| Severity | Count |
| -------- | ----- |
| CRITICAL | 0     |
| HIGH     | 1     |
| MEDIUM   | 2     |
| LOW      | 1     |
| INFO     | 3     |

**Overall Risk:** MEDIUM
**Recommendation:** CONDITIONAL -- address HIGH finding before merge

**Key Metrics:**

- Files analyzed: 19/19 (100%)
- Test coverage gaps: 0 test files in diff (no tests for credit system)
- High blast radius changes: `checkAndDeductCredits` (10 callers), `addCreditsInternal` (2 callers)
- Security regressions detected: 0

---

## What Changed

**Commits:**

1. `3936c14` feat: harden credit system security (pre-Stripe) (#38)
2. `afa8255` feat: add "Spent today" stat to account page

| File                                                | +Lines | -Lines | Risk       | Blast Radius   |
| --------------------------------------------------- | ------ | ------ | ---------- | -------------- |
| `credits/server/check-credits.server.ts`            | +43    | -7     | **HIGH**   | 10 callers     |
| `credits/server/add-credits.server.ts`              | +23    | -18    | **HIGH**   | 2 callers      |
| `credits/server/purchase-credits.server.ts` (NEW)   | +24    | 0      | **HIGH**   | 1 caller       |
| `credits/server/deduct-credits.server.ts` (DELETED) | 0      | -21    | **HIGH**   | was 1 caller   |
| `credits/types.ts`                                  | +27    | -7     | **MEDIUM** | system-wide    |
| `credits/hooks/use-credits.ts`                      | -39    | +15    | **MEDIUM** | all features   |
| `credits/mock-repository.ts` (DELETED)              | 0      | -99    | LOW        | 0 callers      |
| `supabase/migrations/20260329100000_*.sql` (NEW)    | +68    | 0      | **HIGH**   | DB-level       |
| `credits/supabase-repository.ts`                    | +10    | -1     | MEDIUM     | 1 caller       |
| `credits/index.ts`                                  | +15    | -3     | LOW        | re-exports     |
| `credits/components/CreditPackSelector.tsx`         | +10    | -4     | MEDIUM     | 1 caller       |
| 7x generation server files                          | +473   | -428   | MEDIUM     | N/A (wrapping) |
| `routes/dashboard/account.tsx`                      | +16    | -75    | LOW        | UI only        |

**Total:** +990, -934 lines across 19 files

---

## Positive Security Changes

This PR makes several significant security improvements:

### 1. Removed Client-Callable Credit Mutation

**BEFORE:** `deductCredits` and `addCredits` were TanStack `createServerFn` endpoints, meaning any authenticated client could call them directly with arbitrary amounts and reasons (e.g., `addCredits({ amount: 999999, reason: 'initial_grant' })`).

**AFTER:** `deductCredits` server fn deleted. `addCredits` replaced by `addCreditsInternal()` -- a plain async function, NOT a server fn. Only callable from server-side code. The only remaining client-callable credit mutation is `purchaseCredits`, which validates against the CREDIT_PACKS whitelist.

### 2. DB-Level CHECK Constraints (Migration)

New constraints prevent invalid state even if application logic has bugs:

- `credit_balance_non_negative`: `credit_balance >= 0` on `user_profiles`
- `credit_tx_balance_non_negative`: `balance_after >= 0` on `credit_transactions`
- `credit_tx_valid_reason`: Whitelist of 9 valid reason strings

### 3. FOR UPDATE Row Locking

Both `deduct_credits` and `add_credits` DB functions now use `SELECT ... FOR UPDATE`, preventing race conditions where concurrent requests could overdraw balance.

### 4. Amount Guard in DB Functions

Both DB functions now reject `p_amount <= 0` before any state change, preventing zero-cost or negative-cost operations.

### 5. Zod Schema Validation

`checkAndDeductCredits` and `addCreditsInternal` now validate all inputs through Zod schemas before processing.

### 6. withCreditRefund Pattern

New `withCreditRefund()` wrapper auto-refunds credits if the wrapped operation (FAL submission, DB insert) throws. Applied to 7 generation server functions.

### 7. Dev Tools Removed

"Dev: Add 50 Credits" and "Dev: Clear Credits" buttons removed from account page, along with the unused coupon code UI.

---

## Critical Findings

### HIGH: Unsafe Type Cast in CREDIT_COSTS Lookup

**File:** `src/features/credits/server/check-credits.server.ts:34`
**Commit:** `3936c14`
**Blast Radius:** 10 callers (all generation server functions)
**Test Coverage:** NO

**Description:**

```typescript
const unitCost = CREDIT_COSTS[reason as keyof typeof CREDIT_COSTS]
```

`CREDIT_COSTS` is typed as `Record<DeductionReason, number>` (7 keys), but `reason` has type `CreditReason` (9 values including `'pack_purchase'` and `'initial_grant'`). The `as` cast suppresses the TypeScript error. If `checkAndDeductCredits` is ever called with a non-deduction reason, `unitCost` becomes `undefined`, `cost` becomes `NaN`, and `deductCredits(userId, NaN, reason)` is called.

**What happens at DB level:** The Postgres function checks `IF p_amount <= 0`, but `NaN` comparisons in Postgres return `false` for all numeric operators, so this guard would NOT catch it. The `INSERT INTO credit_transactions` would store `NaN` as the amount -- or more likely, the RPC layer would reject the malformed numeric.

**Current risk:** LOW in practice -- all 10 callers hardcode valid `DeductionReason` strings. But the Zod schema validates against ALL 9 reasons, so any future caller could pass a non-deduction reason through validation.

**Recommendation:**

```typescript
// Option A: Narrow the type
import type { DeductionReason } from '@/features/credits'

export async function checkAndDeductCredits(
  accessToken: string,
  reason: DeductionReason, // was CreditReason
  quantity: number = 1,
)

// Option B: Runtime guard
const unitCost = CREDIT_COSTS[reason as keyof typeof CREDIT_COSTS]
if (unitCost === undefined) {
  throw new Error(`No cost defined for reason: ${reason}`)
}
```

---

### MEDIUM: Inconsistent withCreditRefund Coverage

**Files:** `generate-image.server.ts`, `edit-image.server.ts`, `generate-variation.server.ts`
**Blast Radius:** 3 generation paths without refund protection

**Description:**
This PR wraps 7 generation functions in `withCreditRefund`, but 3 remain unwrapped. If FAL submission or the Supabase insert fails after `checkAndDeductCredits` succeeds, the user loses credits without getting their generation.

| Function              | Has withCreditRefund? |
| --------------------- | --------------------- |
| retryGeneration       | YES                   |
| submitVariations      | YES                   |
| generateFirstFrame    | YES                   |
| generateLastFrame     | YES                   |
| generateFlfVideo      | YES                   |
| generateMultishot     | YES                   |
| outpaintImage         | YES                   |
| **generateImage**     | **NO**                |
| **editImage**         | **NO**                |
| **generateVariation** | **NO**                |

These 3 files were not modified in this PR (pre-existing gap), but the pattern is now established and they should be wrapped for consistency.

**Recommendation:** Wrap all 3 remaining callers in `withCreditRefund` before merge or as immediate follow-up.

---

### MEDIUM: purchaseCredits Has No Payment Verification

**File:** `src/features/credits/server/purchase-credits.server.ts`
**Commit:** `3936c14`
**Test Coverage:** NO

**Description:**
The new `purchaseCredits` server fn validates the pack exists and adds credits, but performs no payment. Any authenticated user can call this endpoint to mint credits for free:

```typescript
// Client can call:
await purchaseCredits({ data: { accessToken, packCredits: 160 } })
// Gets 160 credits, pays nothing
```

**Current risk:** This is explicitly "pre-Stripe" per the PR title. The pack whitelist prevents arbitrary amounts. But this endpoint MUST be gated behind Stripe payment verification before any revenue path goes live.

**Recommendation:** Add a prominent TODO or throw in production until Stripe is wired:

```typescript
if (process.env.NODE_ENV === 'production') {
  throw new Error('Payment integration not yet configured')
}
```

---

### LOW: refundCredits Logs Deduction Reason, Not Refund Reason

**File:** `src/features/credits/server/check-credits.server.ts:64`

**Description:**
When `withCreditRefund` issues a refund, it passes the original deduction reason (e.g., `'image_gen'`) to `addCreditsInternal`. The DB `credit_tx_valid_reason` constraint accepts this, and the ledger records a positive amount with reason `'image_gen'`. This makes it impossible to distinguish refunds from grants in the transaction history without checking the sign of `amount`.

**Recommendation (future):** Consider adding a `'refund'` reason to `CREDIT_REASONS` and the DB constraint, and recording the original reason in metadata.

---

## Test Coverage Analysis

**Coverage:** 0% -- no test files in diff, no existing credit system tests found.

**Untested Changes:**

| Function                               | Risk   | Impact                           |
| -------------------------------------- | ------ | -------------------------------- |
| `checkAndDeductCredits`                | HIGH   | Core deduction path, 10 callers  |
| `addCreditsInternal`                   | HIGH   | Core credit addition, validation |
| `purchaseCredits`                      | HIGH   | Client-callable credit minting   |
| `withCreditRefund`                     | MEDIUM | Refund-on-failure path           |
| DB migration (constraints + functions) | HIGH   | All credit operations            |

**Risk Assessment:** The DB constraints and `FOR UPDATE` locking provide strong defense-in-depth, partially compensating for the lack of application-level tests. However, the `NaN` edge case (HIGH finding) would benefit from a unit test.

---

## Blast Radius Analysis

| Function                | Callers                         | Risk   | Priority |
| ----------------------- | ------------------------------- | ------ | -------- |
| `checkAndDeductCredits` | 10                              | HIGH   | P0       |
| `addCreditsInternal`    | 2 (purchase + refund)           | HIGH   | P1       |
| `CREDIT_COSTS`          | 1 (check-credits)               | MEDIUM | P1       |
| `CreditReasonSchema`    | 2 (check-credits + add-credits) | LOW    | P2       |

---

## Historical Context

**Removed files:**

- `deduct-credits.server.ts`: Was a `createServerFn` (client-callable). Removed to eliminate client-side deduction surface. **Correct removal.**
- `mock-repository.ts`: Dev-only mock with hardcoded 47-credit balance. No security impact from removal.

**No security-related regressions detected.** The removed code was the attack surface; removing it is the fix.

---

## Recommendations

### Immediate (Blocking)

- [ ] Fix unsafe `as` cast in `check-credits.server.ts:34` -- either narrow parameter type to `DeductionReason` or add runtime guard

### Before Production

- [ ] Gate `purchaseCredits` behind Stripe payment verification
- [ ] Wrap `generateImage`, `editImage`, `generateVariation` in `withCreditRefund`
- [ ] Add integration test for concurrent deduction race condition (verify `FOR UPDATE` works)

### Technical Debt

- [ ] Add `'refund'` to CREDIT_REASONS for ledger clarity
- [ ] Update `src/features/credits/CLAUDE.md` to reflect removed files and new architecture
- [ ] Consider adding rate limiting to `purchaseCredits` endpoint

---

## Analysis Methodology

**Strategy:** FOCUSED (19 files, medium codebase)

**Analysis Scope:**

- Files reviewed: 19/19 (100%)
- HIGH RISK: 100% coverage (credit core + migration + generation wrappers)
- MEDIUM RISK: 100% coverage
- LOW RISK: 100% coverage

**Techniques:**

- Full diff analysis of all 19 changed files
- Blast radius calculation via grep for all exported functions
- Cross-reference of all `checkAndDeductCredits` callers (10) for `withCreditRefund` coverage
- Type flow analysis through `CreditReason` -> `CREDIT_COSTS` lookup
- DB constraint analysis for defense-in-depth
- Verified no remaining imports of deleted modules

**Limitations:**

- No runtime testing performed
- Did not review Supabase RLS policies for `credit_transactions` / `user_profiles`
- Did not verify existing DB state compatibility with new CHECK constraints

**Confidence:** HIGH for analyzed scope
