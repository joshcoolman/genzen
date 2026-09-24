//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'
import effectAllowlist from './eslint-rules/effect-allowlist.js'
import serverSuffix from './eslint-rules/server-suffix.js'
import sqlScoping from './eslint-rules/sql-user-scoping.js'

export default [
  {
    ignores: [
      '.next/',
      'eslint.config.js',
      'eslint-rules/**/*',
      'prettier.config.js',
      /* An agent worktree is a second checkout of this repo living inside it,
         at `.claude/worktrees/<name>/`. Without this, lint walks into it and
         reports the whole repo twice -- and worse, its `eslint-rules/*.js`
         resolve against that checkout's tsconfig and fail to parse, so a clean
         tree reports four errors that belong to nobody. `vitest.config.ts`
         excludes the same path for the same reason. The three `check-*.mjs`
         scripts already skip every dot-directory and need nothing. */
      '.claude/**',
    ],
  },
  ...tanstackConfig,
  {
    // The one invariant no type and no test can catch: there is no RLS, so a
    // query that forgets `user_id` reads every user's rows and looks fine
    // locally (#219). Tests are excluded -- they mock `sql`.
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
    plugins: { genzen: sqlScoping },
    rules: { 'genzen/sql-user-scoping': 'error' },
  },
  {
    // The suffix says whether a client component may import the module, so it
    // has to be true (#241). Tests are included: a `.server.test.ts` left
    // beside a renamed `.action.ts` is the drift starting again.
    files: ['**/*.ts'],
    plugins: { genzenSuffix: serverSuffix },
    rules: { 'genzenSuffix/server-suffix': 'error' },
  },
  {
    // Effect lives in src/lib/effect/ and News, and spreads on purpose rather
    // than by import (#721). The rule's own comment holds the reasoning.
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { genzenEffect: effectAllowlist },
    rules: { 'genzenEffect/effect-allowlist': 'error' },
  },
]
