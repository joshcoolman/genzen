//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'
import sqlScoping from './eslint-rules/sql-user-scoping.js'

export default [
  {
    ignores: [
      '.next/',
      '.output/',
      'eslint.config.js',
      'eslint-rules/**/*',
      'prettier.config.js',
      'supabase/functions/**/*',
      'src/lib/types/supabase.ts',
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
]
