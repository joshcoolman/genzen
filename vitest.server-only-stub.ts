// `server-only` is a build-time guard: importing it from a client bundle is a
// Next.js error, and it has no runtime behaviour. Node cannot resolve it under
// vitest, so `vitest.config.ts` aliases it here -- otherwise any `.server.ts`
// module is untestable purely because it declares where it is allowed to run.
export {}
