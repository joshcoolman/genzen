/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import viteTsConfigPaths from 'vite-tsconfig-paths'

// Vitest config — deliberately excludes TanStack Start and Nitro plugins
// which perform SSR code-splitting transforms incompatible with unit tests.
export default defineConfig({
  plugins: [
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
  ],
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
