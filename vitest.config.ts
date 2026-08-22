/// <reference types="vitest" />
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

/**
 * `.md` as a raw string, matching `turbopack.rules` in next.config.ts.
 *
 * Without it, any module that imports an instruction file is untestable --
 * Vite parses the markdown as JavaScript and fails on the first apostrophe.
 * That is why `prompts.test.ts` reads its files off disk rather than importing
 * them; a test that wants the *resolved* string had no way to get one (#463).
 */
const markdownAsText = {
  name: 'markdown-as-text',
  transform(_code: string, id: string) {
    if (!id.endsWith('.md')) return null
    const text = readFileSync(id.split('?')[0], 'utf8')
    return { code: `export default ${JSON.stringify(text)}`, map: null }
  },
}

// Vitest config. The alias is spelled out here rather than read from
// tsconfig by a plugin: the app builds with Next now, so vite-tsconfig-paths
// is no longer a dependency of anything else.
export default defineConfig({
  plugins: [markdownAsText],
  resolve: {
    alias: {
      '#': fileURLToPath(new URL('./src', import.meta.url)),
      // A `.server.ts` module declares where it may run by importing this. It
      // has no runtime and Node cannot resolve it, so without the stub a module
      // is untestable purely for saying it is server-side.
      'server-only': fileURLToPath(
        new URL('./vitest.server-only-stub.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['**/node_modules/**', '**/.next/**'],
  },
})
