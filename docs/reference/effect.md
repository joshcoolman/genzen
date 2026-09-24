# Effect in genzen

News runs on Effect (#721). Nothing else does, and that is enforced:
`eslint-rules/effect-allowlist.js` fails an `effect` import outside
`src/lib/effect/` and `app/(authenticated)/news/`.

The point of the border is that Effect spreads **on purpose**. A library this
pleasant leaks -- someone reaches for `Effect.retry` in a video action because
it is right there -- and a half-converted backend with two error models is
worse than either one. Widening the list is a one-line edit; it should show up
in a diff.

## What the app had already hand-written

Effect was not adopted for novelty. About a third of it already existed here,
discovered one outage at a time and in a different shape each time:

- `fal-retry.server.ts` is a `Schedule` plus a retry predicate.
- `fal-error.server.ts` is `Cause` walking plus a hand-decoded error union.
- `processImageResult` removing the object when the row update fails is
  `acquireRelease`.
- `error-classification.ts` is a `Match.tag` -- run in the browser, on a regex
  over a message string, after the moment a retry would have helped.

The decision those four share is one decision: retry, refuse, or mark failed.
Split across four files it can only be answered four times.

## The shape

| Module                                | What it is                                                                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/effect/result.ts`            | The wire contract. Types only, no `effect` import -- so a view can `import type` it without pulling the runtime into the browser bundle |
| `src/lib/effect/errors.ts`            | The error family as `Schema.TaggedError`, `isRetryable` as an exhaustive `Match`, and `toWire`                                          |
| `src/lib/effect/decode-fal.server.ts` | The one place a thrown FAL value is read. Takes `isTransientNetworkError` as input rather than keeping a second copy of its code set    |
| `src/lib/effect/services.server.ts`   | `Fal`, `Reasoning`, `Db`, `Storage` and their live Layers                                                                               |
| `src/lib/effect/run-action.server.ts` | `ManagedRuntime`, built once per process, and the action boundary                                                                       |

Three rules fell out of building it, and they are the ones worth copying:

- **Services are named for the job, not the vendor.** `Reasoning` is a model
  that thinks and can search; Anthropic is one Layer providing it, and every
  vendor knob (`web_search`, the model ids, the key check) lives inside that
  Layer. Trying Google or OpenAI is a second Layer and one line in `AppLayer`.
- **`Db.query` takes a callback, not a query string.** The statement stays at
  the call site where `eslint-rules/sql-user-scoping.js` can see its `user_id`
  filter. A `Db` that took strings would hide every query in the app from the
  only check that catches a missing scope. The `label` argument is the span
  name _and_ the key a fake `Db` answers on, which is how a test satisfies a
  program's queries without a database.
- **Expected failure and defect are not the same thing.** A member of the
  family crosses to the client as plain tagged data. A defect is logged here as
  a `Cause` -- fibre trace, whole `cause` chain -- and the client is told
  `Unexpected` and nothing else. The old code threw `new Error(string)` for
  both, which is how a dead HTTP/2 session reached the UI as "fetch failed"
  (#556).

## What it bought in the tests

`app/(authenticated)/news/_lib/news-program.server.test.ts` has no `vi.mock`.
It provides real Layers that happen to be fake, so the program under test is the
program that ships. Compare `generate-video.action.test.ts`, which opens with
seven `vi.mock` calls naming module paths -- those pass whether or not the code
still imports those paths, and say nothing about what the program does with a
refusal.

An action module may only export async functions, so a program that is exported
as a _value_ cannot live in one. Hence the `_lib/news-program.server.ts` /
`_actions/news.ts` split: the action file resolves who is asking, calls
`runAction`, and does nothing else.

## Not done, and why

- `NeverSubmitted` is in the issue's error family but not in `errors.ts`. The
  only thing that can observe it is `submitFalOnce`, which is queue-based
  generation and outside the border. It goes in with that call, not as a class
  nothing can construct.
- `StorageFailed` is in `errors.ts` and not in the issue. Pulling a paid asset
  into our bucket is its own failure and its own verdict -- it is the one case
  where retrying the _storage_ step rather than the generation is right.
- Effect AI, `effect/workflow` and `effect/unstable/sql` are all untouched.
  Reassess after v4 goes stable; Director storyboard is the intended second
  surface.

Effect is on `4.0.0-rc.*`, not v3, and deliberately: the AI, SQL, HTTP and
workflow modules fold into `effect/*` in v4 with no compatibility path. The
package ships its own docs at `node_modules/effect/ai-docs/` -- read those
rather than anything on the web, which is v3.
