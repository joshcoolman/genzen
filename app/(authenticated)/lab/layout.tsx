import { LabShell } from './_components/lab-shell/lab-shell'

/**
 * The lab: a nav down the left, the chosen experiment beside it (#424).
 *
 * Deliberately the same shape as `/account` — a layout rather than a component
 * each page renders, so the nav is not remounted on navigation and the active
 * item does not flicker. The two columns and the rail's collapsed state live in
 * `LabShell`, which is a client component; this stays a layout so that property
 * still holds.
 */
export default function LabLayout({ children }: { children: React.ReactNode }) {
  return <LabShell>{children}</LabShell>
}
