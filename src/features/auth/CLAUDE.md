Owns who the user is: password verification and the signed session cookie. It
imports `#/lib/server/db.server` and nothing else from the app; no feature
imports back into it.

## The dependency direction that matters

`session.ts` is **Web Crypto only — never import `node:*` into it, directly or
transitively.** It is imported by `proxy.ts`, which runs before every request, and a
`node:crypto` import anywhere in its graph breaks that bundle. That is why `server/credentials.server.ts` imports `session`
and never the reverse, and why there is no barrel here re-exporting both: a
barrel is how the Node half gets pulled into the Edge half by accident.

## Responsibilities

- Hash and verify passwords (scrypt, `salt:hash`, `timingSafeEqual`).
- Mint and verify the session value `userId.issuedAtMs.hmac`.
- Read a session out of a raw `Cookie` header, framework-agnostically.

## Does NOT own

- Setting or clearing the cookie on a response — the server actions in
  `app/login/_actions/login.ts` and `logout.action.ts` do that.
- Route protection. `proxy.ts` owns it: every path is private unless listed in
  its `PUBLIC_PATHS`.
- User provisioning as a product flow. `scripts/users.mjs` (`pnpm users`) is the
  only way in, on purpose.

## Invariants that fail silently

- **`scripts/hash-lib.mjs` and `server/credentials.server.ts` hold two separate
  scrypt calls.** If they drift — salt length, key length, an options object on
  one side — every provisioned login fails and the app reports it as a wrong
  password. `server/credentials.server.test.ts` pins this by provisioning with
  the script and verifying with the module; keep that test.
- **`DUMMY_HASH` is not decoration.** Verification runs against it when no user
  row matches, so login costs the same time whether or not the email exists.
  Returning early on an unknown email restores an account-enumeration oracle.
- **Rotating `AUTH_SESSION_SECRET` signs everyone out.** It is generated once by
  `local:up` and then left alone.

## Decided, not worth relitigating

A signed value rather than a JWT. This replaced a Supabase JWT that rode in the
request _body_ of every server function and was verified against a remote JWKS.
There is no third party to interoperate with, so the token carries exactly who
and when, and an HMAC over those is the entire requirement.
