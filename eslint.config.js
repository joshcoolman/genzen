//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  {
    ignores: [
      '.output/',
      'eslint.config.js',
      'prettier.config.js',
      'supabase/functions/**/*',
    ],
  },
  ...tanstackConfig,
]
