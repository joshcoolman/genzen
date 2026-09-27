// Next initializes its render server (and instrumentation) on the first request.
// Warm the public login page ourselves so durable Director jobs resume after a
// restart even when nobody has a browser open. No credentials or paid work here.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'

const mode = process.argv[2] ?? 'start'
const port = Number(process.argv[3] ?? 3000)
if (
  !['dev', 'start'].includes(mode) ||
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535
)
  throw new Error('Usage: node scripts/serve.mjs <dev|start> [port]')
const require = createRequire(import.meta.url)
const child = spawn(
  process.execPath,
  [require.resolve('next/dist/bin/next'), mode, '--port', String(port)],
  {
    stdio: 'inherit',
  },
)
let stopped = false
let startupFailed = false
const shutdown = new AbortController()
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    stopped = true
    shutdown.abort()
    child.kill(signal)
  })
child.on('error', (error) => {
  console.error(error.message)
  stopped = true
  shutdown.abort()
  process.exitCode = 1
})
child.on('exit', (code, signal) => {
  stopped = true
  shutdown.abort()
  process.exitCode = startupFailed
    ? 1
    : (code ?? (signal === 'SIGINT' || signal === 'SIGTERM' ? 0 : 1))
})

for (let attempt = 0; !stopped && attempt < 60; attempt++) {
  try {
    const response = await fetch(`http://localhost:${port}/login`, {
      signal: AbortSignal.any([shutdown.signal, AbortSignal.timeout(2000)]),
    })
    await response.body?.cancel()
    if (response.ok) break
  } catch {
    // The socket is not listening yet, or the first page is still compiling.
  }
  if (attempt === 59 && !stopped) {
    console.error(
      'The server did not initialize its background worker within the startup window.',
    )
    startupFailed = true
    child.kill('SIGTERM')
    process.exitCode = 1
    break
  }
  await delay(500, undefined, { signal: shutdown.signal }).catch(() => {})
}
