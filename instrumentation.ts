/** The self-hosted Node server owns durable Director jobs, independently of tabs. */
export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  ) {
    const { startCutWorker } =
      await import('./app/(authenticated)/director/_lib/cut-worker.server')
    startCutWorker()
  }
}
