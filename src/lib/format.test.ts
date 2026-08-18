import { describe, expect, it } from 'vitest'
import { formatCents } from './format'

/**
 * These exist because five copies of this function had drifted into two
 * different answers (#416). The cases below are the ones they disagreed on.
 */
describe('formatCents', () => {
  it('keeps a sub-cent figure visible', () => {
    // Video's `formatCost` was a flat toFixed(2), which rendered this as
    // $0.00 -- undoing #400's whole point at the last step.
    expect(formatCents(0.04)).toBe('$0.0004')
  })

  it('renders a genuine zero as $0.00, not $0.0000', () => {
    // The activity preview had lost this guard.
    expect(formatCents(0)).toBe('$0.00')
  })

  it('drops to two decimals above a dollar', () => {
    expect(formatCents(450)).toBe('$4.50')
  })

  it('uses three decimals between a cent and a dollar', () => {
    expect(formatCents(8)).toBe('$0.080')
  })

  it('marks an estimate and leaves a known figure bare', () => {
    expect(formatCents(450, { estimate: true })).toBe('~$4.50')
    expect(formatCents(450)).toBe('$4.50')
  })

  it('renders an absent figure as a dash rather than zero', () => {
    // A missing cost and a free generation are different facts.
    expect(formatCents(null)).toBe('—')
    expect(formatCents(undefined)).toBe('—')
  })
})
