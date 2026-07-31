import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Next only inlines browser-visible env vars behind a NEXT_PUBLIC_ prefix, so
  // a `VITE_` name has to be forwarded by hand. The webhook flag was renamed to
  // NEXT_PUBLIC_ instead (#225) -- it is genuinely client-read, and a Vite
  // prefix in a Next app reads as a bug even when it works.
  //
  // VITE_R2_PUBLIC_URL is the last one, and it is on its way out rather than
  // being renamed: #226 serves images through the app, after which no browser
  // needs the bucket's address at all.
  env: {
    VITE_R2_PUBLIC_URL: process.env.VITE_R2_PUBLIC_URL,
  },
  // Prompt-craft in src/lib/prompts/ is authored as markdown and imported as
  // text. Vite did this with import.meta.glob('*.md', { query: '?raw' });
  // Turbopack needs an explicit loader. The .md files stay the source of
  // truth -- they are material a human edits, not generated code.
  turbopack: {
    rules: {
      '*.md': { loaders: ['raw-loader'], as: '*.js' },
    },
  },
  // Server Function logging prints each action's serialized arguments, and this
  // app's uploads carry a base64 image -- so a single drag-and-drop buries the
  // dev terminal in several thousand lines and the request log above it. The
  // one-line `POST /path 200` entries are kept.
  logging: {
    serverFunctions: false,
  },
  experimental: {
    serverActions: {
      // Reference images reach the server through a direct Server Action call
      // rather than a native multipart submit, so they are subject to this
      // limit -- the 1MB default is well under a typical phone photo.
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
