// Warns when a shell-exported variable shadows the one in .env.local.
//
// Real environment variables beat .env files, and Node's env loaders do not
// overwrite something already in process.env. So a stale `export FAL_KEY` in a
// dotfile silently outranks the fresh key you just pasted into .env.local, and
// the failure surfaces much later as an HTTP 401 from the provider -- which
// reads like a bad key, not a shadowed one.
//
// `local:up` already checks this, but `pnpm dev` is run directly far more often,
// so the check belongs here too. Warns and exits 0: a shadowed key is not a
// reason to refuse to start.
import { existsSync, readFileSync } from 'node:fs'

const ENV_LOCAL = new URL('../.env.local', import.meta.url)
if (!existsSync(ENV_LOCAL)) process.exit(0)

const text = readFileSync(ENV_LOCAL, 'utf8')
const WATCHED = [
  'FAL_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'DATABASE_URL',
  'AUTH_SESSION_SECRET',
]

const mask = (v) => (v.length > 8 ? `${v.slice(0, 4)}…${v.slice(-4)}` : '…')

const shadowed = WATCHED.filter((name) => {
  const shell = process.env[name]
  const file = (text.match(new RegExp(`^${name}=(.*)$`, 'm')) ?? [])[1]?.trim()
  return shell && file && shell !== file
})

if (shadowed.length) {
  console.warn('')
  for (const name of shadowed) {
    console.warn(
      `!! ${name} is exported in your shell (${mask(process.env[name])}) and OVERRIDES .env.local (${mask((text.match(new RegExp(`^${name}=(.*)$`, 'm')) ?? [])[1].trim())}).`,
    )
  }
  console.warn('   Editing .env.local will not change what the app uses.')
  console.warn(
    '   `unset <NAME>` in this shell, or remove the export from your dotfiles.\n',
  )
}
