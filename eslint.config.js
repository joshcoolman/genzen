//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'
import serverSuffix from './eslint-rules/server-suffix.js'
import sqlScoping from './eslint-rules/sql-user-scoping.js'

export default [
  {
    ignores: [
      '.next/',
      'eslint.config.js',
      'eslint-rules/**/*',
      'prettier.config.js',
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
]
