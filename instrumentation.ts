/**
 * A long-lived Node server owns durable Director jobs, independently of tabs.
 * On Vercel there is no such process: a function instance is not promised to
 * outlive its request, so a timer loop here would run while an instance happens
 * to be warm and stop when it is not. There the page that reads a job's
 * progress advances it instead (`getSession`, #777), and this stays for
 * `pnpm dev` and any self-hosted `pnpm start`.
 */
export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.NEXT_PHASE !== 'phase-production-build' &&
    !process.env.VERCEL
  ) {
    const { startCutWorker } =
      await import('./app/(authenticated)/director/_lib/cut-worker.server')
    startCutWorker()
  }
}
