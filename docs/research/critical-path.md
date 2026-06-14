# Critical Path to Revenue

> **Superseded (2026-06-13).** This revenue-first framing no longer reflects the project's direction. GenZen is a personal AI playground, not a product chasing paying customers. Kept as a historical record; the Stripe/credits work it drove still ships in the app, but "first paying customer" is no longer a goal.

Updated 2026-03-29. The framing: this project is the only income source until paying customers validate it.

## Where we are

Gate 1 is nearly complete -- 3 of 5 items done, #38 (credit hardening) is the last real blocker. Gates 2 and 3 are untouched: no Stripe, no Resend, no real landing page. The next meaningful milestone is wiring payments.

## Gate 1: It's fast, secure, and production-ready (NEARLY DONE)

Infrastructure, optimization, and hardening -- the foundation everything else sits on.

| Issue | Status | What                                   | Why                                                       |
| ----- | ------ | -------------------------------------- | --------------------------------------------------------- |
| #103  | DONE   | Rate limit generation endpoints        | Prevent abuse and runaway FAL costs                       |
| #107  | DONE   | Thumbnail generation off critical path | App feels broken under real load without this             |
| #108  | DONE   | Soft-delete cleanup (pg_cron)          | Operational hygiene before real users                     |
| #38   |        | Harden credit system security          | Can't let users bypass credits                            |
| #24   |        | CI/CD pipeline (GitHub Actions)        | PR checks (lint/build/test). Vercel handles deploys today |

## Gate 2: People can pay you (BLOCKING)

| Issue | Status | What                                    | Why                                            |
| ----- | ------ | --------------------------------------- | ---------------------------------------------- |
| #80   |        | Real FAL-based pricing & spend tracking | Must know unit economics before setting prices |
| #26   |        | Stripe integration (credit packs)       | No Stripe, no money                            |
|       |        | Terms of Service / Privacy Policy       | Stripe requires these for a live account       |

## Gate 3: People can find you and sign up (BLOCKING)

| Issue | Status | What                    | Why                                                     |
| ----- | ------ | ----------------------- | ------------------------------------------------------- |
| #28   |        | Landing page            | One page explaining what this is + signup CTA           |
| #27   |        | Branded emails (Resend) | Password resets and receipts must come from your domain |

## Suggested sequence

1. ~~#103 (rate limiting)~~ -- DONE
2. ~~#107 (thumbnail off critical path)~~ -- DONE
3. ~~#108 (soft-delete cleanup)~~ -- DONE
4. #38 (harden credits) -- last Gate 1 blocker before real money flows
5. #24 (CI/CD) -- PR quality gates; Vercel covers deploys already
6. #80 (real pricing) -- understand unit economics
7. #26 (Stripe) -- payments wired
8. #28 (landing page) -- front door
9. #27 (branded emails) -- quick win with Resend

## Deprioritized (park until revenue flows)

- Prompt Intelligence Layer (#91 + sub-issues #92-99) -- R&D/differentiation, not revenue-blocking
- Creative Canvas epic (#90) -- cool feature, not revenue-blocking
- Media adapter layer (#81) -- architecture work, justify with load
- Semantic search (#89) -- research spike
- Style Trainer (#55), Characters (#54), Shots (#52) -- feature depth for after people are paying
