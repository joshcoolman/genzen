import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Next only inlines browser-visible env vars behind a NEXT_PUBLIC_ prefix.
  // These four kept their VITE_ names -- the same way R2_* kept its name after
  // the storage client stopped being Cloudflare-specific -- so they are listed
  // explicitly rather than renamed across .env.local, scripts/local-up.mjs and
  // the deploy config. Three of the four leave with Supabase in #168 Phase 6.
  env: {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    VITE_R2_PUBLIC_URL: process.env.VITE_R2_PUBLIC_URL,
    VITE_ENABLE_FAL_WEBHOOKS: process.env.VITE_ENABLE_FAL_WEBHOOKS,
  },
  // The AD skills library is authored as markdown in src/lib/prompts/skills/
  // and read into the client bundle as text. Vite did this with
  // import.meta.glob('*.md', { query: '?raw' }); Turbopack needs an explicit
  // loader. The .md files stay the source of truth -- they are prompt-craft
  // material a human edits, not generated code.
  turbopack: {
    rules: {
      '*.md': { loaders: ['raw-loader'], as: '*.js' },
    },
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
