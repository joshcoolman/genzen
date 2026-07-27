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
    // `.output/` is the Nitro build directory, and the build emits compiled
    // copies of the `server/api/*.test.ts` files into it. Without this,
    // `pnpm build && pnpm test` fails: vitest collects those bundled copies,
    // whose vitest imports are rewritten to chunk paths the mocks API can't
    // resolve. The source tests they shadow already run and pass.
    exclude: ['**/node_modules/**', '**/dist/**', '.output/**'],
  },
})
