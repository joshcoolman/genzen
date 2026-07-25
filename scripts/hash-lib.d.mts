// Types for the plain-JS provisioning helper, so the cross-boundary test in
// src/features/auth/server/credentials.server.test.ts typechecks.
export function hashPassword(password: string): Promise<string>
