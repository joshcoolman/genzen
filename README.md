# GenZen

AI image generation app with real-time job status updates.

## Stack

- **TanStack Start** - Full-stack React framework
- **Supabase** - Auth, Postgres, Realtime
- **Trigger.dev v3** - Durable background jobs
- **FAL** - Image generation API
- **Fly.io** - Hosting

## Live

https://genzen.fly.dev/

## Local Development

```bash
# Start Supabase (Docker required)
supabase start

# Start dev server
pnpm dev

# Start Trigger.dev dev (separate terminal)
pnpm dev:trigger
```

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start>
TRIGGER_SECRET_KEY=tr_dev_...
FAL_KEY=...
```

## Deploy

```bash
fly deploy
```
