//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  {
    ignores: [
      '.next/',
      '.output/',
      'eslint.config.js',
      'prettier.config.js',
      'supabase/functions/**/*',
      'src/lib/types/supabase.ts',
    ],
  },
  ...tanstackConfig,
]
