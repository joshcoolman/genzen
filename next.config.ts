import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Prompt-craft in src/lib/prompts/ is authored as markdown and imported as
  // text. Vite did this with import.meta.glob('*.md', { query: '?raw' });
  // Turbopack needs an explicit loader. The .md files stay the source of
  // truth -- they are material a human edits, not generated code.
  turbopack: {
    rules: {
      '*.md': { loaders: ['raw-loader'], as: '*.js' },
    },
  },
  // The dev-mode badge sits bottom-left, over the corner this app actually
  // uses -- the canvas zoom chip, the generator dock's edge. It reports build
  // activity and route type, neither of which is worth a permanent occupied
  // corner when the terminal says the same thing.
  devIndicators: false,
  // Server Function logging prints each action's serialized arguments, and this
  // app's uploads carry a base64 image -- so a single drag-and-drop buries the
  // dev terminal in several thousand lines and the request log above it. The
  // one-line `POST /path 200` entries are kept.
  logging: {
    serverFunctions: false,
  },
  experimental: {
    serverActions: {
      // Uploads and reference images reach the server through a direct Server
      // Action call rather than a native multipart submit, base64'd -- so this
      // is the real upload ceiling, and it is a third larger than the file it
      // has to admit. 22mb takes MAX_FILE_SIZE's 15MB (20MB encoded) with room
      // for the rest of the payload. The two numbers move together; see the
      // note on MAX_FILE_SIZE in src/features/user-images/types.ts.
      bodySizeLimit: '22mb',
    },
  },
}

export default nextConfig
