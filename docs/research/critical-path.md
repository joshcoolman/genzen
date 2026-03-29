# Critical Path to Revenue

Updated 2026-03-27. The framing: this project is the only income source until paying customers validate it.

## Gate 1: It's fast, secure, and production-ready (IN PROGRESS)

Infrastructure, optimization, and hardening -- the foundation everything else sits on.

| Issue | Status | What                                   | Why                                           |
| ----- | ------ | -------------------------------------- | --------------------------------------------- |
| #103  | DONE   | Rate limit generation endpoints        | Prevent abuse and runaway FAL costs           |
| #107  |        | Thumbnail generation off critical path | App feels broken under real load without this |
| #24   |        | CI/CD pipeline (GitHub Actions)        | Deploys can't be manual for a paid product    |
| #108  |        | Soft-delete cleanup (pg_cron)          | Operational hygiene before real users         |
| #38   |        | Harden credit system security          | Can't let users bypass credits                |

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
2. #107 (thumbnail off critical path) -- performance under load
3. #24 (CI/CD) -- unblocks fast iteration on everything below
4. #108 (soft-delete cleanup) -- operational hygiene
5. #38 (harden credits) -- security before real money flows
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
