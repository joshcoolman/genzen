import { describe, expect, it } from 'vitest'
import { scriptOf } from './script'

describe('scriptOf', () => {
  it('joins the prompts verbatim with a blank line, keeping an upload as an empty entry', () => {
    expect(
      scriptOf([
        { description: "waves, 'hi everyone', looks down" },
        { description: null },
        { description: '  she picks up the phone  ' },
      ]),
    ).toBe("waves, 'hi everyone', looks down\n\n\n\nshe picks up the phone")
  })
})
