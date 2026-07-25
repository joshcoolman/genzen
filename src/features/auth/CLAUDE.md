Owns who the user is: password verification and the signed session cookie. It
imports `@/lib/server/db.server` and nothing else from the app; no feature
imports back into it.

## The dependency direction that matters

`session.ts` is **Web Crypto only — never import `node:*` into it, directly or
transitively.** It is the module a Next Edge middleware will import once #168
reaches the framework port, and a `node:crypto` import anywhere in its graph
breaks that bundle. That is why `server/credentials.server.ts` imports `session`
and never the reverse, and why there is no barrel here re-exporting both: a
barrel is how the Node half gets pulled into the Edge half by accident.

## Responsibilities

- Hash and verify passwords (scrypt, `salt:hash`, `timingSafeEqual`).
- Mint and verify the session value `userId.issuedAtMs.hmac`.
- Read a session out of a raw `Cookie` header, framework-agnostically.

## Does NOT own

- Setting or clearing the cookie on a response — the framework layer does that
  (a Nitro h3 route today, a route handler after the port).
- Route protection. Deny-by-default middleware arrives with the Next port; until
  then the app is still on Supabase auth.
- User provisioning as a product flow. `scripts/create-user.mjs` is the only way
  in, on purpose.

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

A signed value rather than a JWT. This replaces a Supabase JWT that rode in the
request _body_ of every server function and was verified against a remote JWKS.
There is no third party to interoperate with, so the token carries exactly who
and when, and an HMAC over those is the entire requirement.
