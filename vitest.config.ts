/// <reference types="vitest" />
import { defineConfig } from 'vite'
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
  },
})
