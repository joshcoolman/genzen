# Connection Status

Dashboard displays real-time connection status for all external services.

## Status

- [x] Complete

## Overview

The dashboard shows whether each service in the stack is properly configured and reachable. This verifies the infrastructure is working before building features.

## Implementation

### Key Files

- `src/lib/server/check-connections.ts` - Server function to check FAL and Trigger.dev
- `src/routes/dashboard.tsx` - Displays status for all services

### How It Works

**Client-side checks:**

- Supabase: Calls `supabase.auth.getUser()` to verify connection
- Auth: Displays logged-in user email

**Server-side checks (via TanStack Start server function):**

- FAL: Configures client and makes a test API call; "not found" error means auth worked
- Trigger.dev: Validates key format (starts with `tr_dev_` or `tr_prod_`)

### Dependencies

- `@fal-ai/client` - FAL API client
- `@trigger.dev/sdk` - Trigger.dev SDK

## Usage

Navigate to `/dashboard` after signing in. Status badges show:

- **Checking...** (yellow) - Request in progress
- **Connected** (green) - Service is working
- **Error** (red) - Configuration issue or service unreachable

## Configuration

```bash
# Server-side secrets
FAL_KEY=...
TRIGGER_SECRET_KEY=tr_dev_...
```

For Fly.io:

```bash
fly secrets set FAL_KEY=... TRIGGER_SECRET_KEY=...
```

## Testing

1. Sign in to dashboard
2. All 4 statuses should show "Connected"
3. Remove a key from `.env.local` to verify error states

## Future Improvements

- Actually trigger a Trigger.dev task to verify full connectivity
- Add latency/response time metrics
- Add refresh button to re-check connections
