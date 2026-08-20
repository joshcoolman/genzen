// Warns when a shell-exported variable shadows the one in .env.local.
//
// Real environment variables beat .env files, and Node's env loaders do not
// overwrite something already in process.env. So a stale `export FAL_KEY` in a
// dotfile silently outranks the fresh key you just pasted into .env.local, and
// the failure surfaces much later as an HTTP 401 from the provider -- which
// reads like a bad key, not a shadowed one.
//
// `local:up` already checks this, but `pnpm dev` is run directly far more often,
// so the check belongs here too.
//
// **An EMPTY export refuses to start; a stale one only warns.** The warning was
// the whole check until Aug 2026, when an `export FAL_KEY=""` cost two separate
// debugging sessions -- new keys minted, .env.local re-pasted, server restarted,
// logged out and back in -- because the banner had scrolled away above a request
// log by the time anything failed. There is no reason to run the app with a
// variable exported as empty over a real value in .env.local, so it is not a
// judgement call worth leaving open. A stale non-empty value still warns: that
// one can be deliberate, like pointing at another account for an afternoon.
import { existsSync, readFileSync } from 'node:fs'

const ENV_LOCAL = new URL('../.env.local', import.meta.url)
if (!existsSync(ENV_LOCAL)) process.exit(0)

const text = readFileSync(ENV_LOCAL, 'utf8')
const WATCHED = [
  'FAL_KEY',
  'ANTHROPIC_API_KEY',
  'DATABASE_URL',
  'AUTH_SESSION_SECRET',
]

const mask = (v) => (v.length > 8 ? `${v.slice(0, 4)}…${v.slice(-4)}` : '…')

// `name in process.env`, not a truthiness check: an EMPTY export shadows just
// as effectively as a stale one, and reads far worse. A stale key 401s with the
// credential named; an empty one makes the app report "FAL_KEY is not set"
// while .env.local plainly holds a key, so you go looking at the file.
const shadowed = WATCHED.filter((name) => {
  if (!(name in process.env)) return false
  const shell = process.env[name]
  const file = (text.match(new RegExp(`^${name}=(.*)$`, 'm')) ?? [])[1]?.trim()
  return file && shell !== file
})

const empty = shadowed.filter((name) => process.env[name] === '')

if (shadowed.length) {
  const say = empty.length ? console.error : console.warn
  say('')
  for (const name of shadowed) {
    const shell = process.env[name]
    const file = (text.match(new RegExp(`^${name}=(.*)$`, 'm')) ?? [])[1].trim()
    say(
      `!! ${name} is exported in your shell (${shell === '' ? 'EMPTY STRING' : mask(shell)}) and OVERRIDES .env.local (${mask(file)}).`,
    )
  }
  say('   Editing .env.local will not change what the app uses.')
  say(
    '   `unset <NAME>` in this shell, or remove the export from your dotfiles.',
  )
  if (empty.length) {
    say(
      `   Refusing to start: ${empty.join(', ')} exported as an empty string.`,
    )
    say(
      '   Nothing in the app can work around this, and it reports itself as a\n' +
        '   missing key, which sends you to the file that is already correct.\n',
    )
    process.exit(1)
  }
  say('')
}
