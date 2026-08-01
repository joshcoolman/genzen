/// <reference types="vitest" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Vitest config. The alias is spelled out here rather than read from
// tsconfig by a plugin: the app builds with Next now, so vite-tsconfig-paths
// is no longer a dependency of anything else.
export default defineConfig({
  resolve: {
    alias: {
      '#': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['**/node_modules/**', '**/.next/**'],
  },
})
