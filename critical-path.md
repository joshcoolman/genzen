# Critical Path to Revenue

Generated 2026-03-27. The framing: this project is the only income source until paying customers validate it.

## Gate 1: People can pay you (BLOCKING)

| Issue | What                                    | Why                                                        |
| ----- | --------------------------------------- | ---------------------------------------------------------- |
| #80   | Real FAL-based pricing & spend tracking | Must know unit economics before setting prices             |
| #38   | Harden credit system security           | Can't let users bypass credits when real money is involved |
| #26   | Stripe integration (credit packs)       | No Stripe, no money                                        |

## Gate 2: People can find you and sign up (BLOCKING)

| Issue | What                    | Why                                                     |
| ----- | ----------------------- | ------------------------------------------------------- |
| #28   | Landing page            | One page explaining what this is + signup CTA           |
| #27   | Branded emails (Resend) | Password resets and receipts must come from your domain |

## Gate 3: It doesn't fall over when strangers use it (HIGH RISK)

| Issue | What                                   | Why                                           |
| ----- | -------------------------------------- | --------------------------------------------- |
| #103  | Rate limit generation endpoints        | Prevent abuse and runaway FAL costs           |
| #107  | Thumbnail generation off critical path | App feels broken under real load without this |
| #24   | CI/CD pipeline (GitHub Actions)        | Deploys can't be manual for a paid product    |
| #108  | Soft-delete cleanup (pg_cron)          | Operational hygiene before real users         |

## Suggested sequence

1. Finish #103 (rate limiting) -- in progress
2. #80 (real pricing) -- understand unit economics before setting prices
3. #38 + #26 (harden credits + Stripe) -- coupled, ship together
4. #28 (landing page) -- single page, doesn't need to be fancy
5. #27 (branded emails) -- quick win with Resend
6. #24 (CI/CD) -- basic GitHub Actions
7. #107 + #108 (thumbnail + soft-delete cleanup) -- operational hygiene

## Deprioritized (park until revenue flows)

- Prompt Intelligence Layer (#91 + sub-issues #92-99) -- R&D/differentiation, not revenue-blocking
- Creative Canvas epic (#90) -- cool feature, not revenue-blocking
- Media adapter layer (#81) -- architecture work, justify with load
- Semantic search (#89) -- research spike
- Style Trainer (#55), Characters (#54), Shots (#52) -- feature depth for after people are paying
