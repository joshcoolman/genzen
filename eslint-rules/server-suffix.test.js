import { describe, expect, it } from 'vitest'
import { checkSuffix, hasUseServerDirective } from './server-suffix.js'

// #241 split one suffix into two meanings. A rule that cannot be shown to catch
// the regression is not a rule -- these are the two mistakes the rename could
// silently reintroduce, plus the cases that must stay quiet.

const program = (...statements) => ({ body: statements })
const directive = (value) => ({
  type: 'ExpressionStatement',
  expression: { type: 'Literal', value },
})
const someCode = { type: 'VariableDeclaration' }

describe('directive detection', () => {
  it('finds a leading `use server`', () => {
    expect(hasUseServerDirective(program(directive('use server')))).toBe(true)
  })

  it('finds it after another directive', () => {
    expect(
      hasUseServerDirective(
        program(directive('use strict'), directive('use server')),
      ),
    ).toBe(true)
  })

  // The whole point of reading the prologue rather than grepping: a file that
  // merely mentions the string is not an action module.
  it('ignores the string once real code has started', () => {
    expect(
      hasUseServerDirective(program(someCode, directive('use server'))),
    ).toBe(false)
  })

  it('is false for a module with no directives', () => {
    expect(hasUseServerDirective(program(someCode))).toBe(false)
  })
})

describe('flags the two mistakes', () => {
  it('a .server.ts that declares `use server`', () => {
    expect(checkSuffix('src/lib/server/thing.server.ts', true)).toBe(
      'serverWithDirective',
    )
  })

  it('a .action.ts with no directive', () => {
    expect(checkSuffix('src/features/x/server/thing.action.ts', false)).toBe(
      'actionWithoutDirective',
    )
  })
})

describe('test files are exempt', () => {
  // A test for an action imports the module rather than declaring the
  // directive, so judging it by its own prologue would demand a directive that
  // must not be there. This was a real bug: the rule failed CI on a correctly
  // named `.action.test.ts` the moment it was switched on.
  it('.action.test.ts without a directive is fine', () => {
    expect(checkSuffix('src/lib/server/thing.action.test.ts', false)).toBeNull()
  })

  it('.server.test.ts either way is fine', () => {
    expect(checkSuffix('src/lib/server/thing.server.test.ts', false)).toBeNull()
    expect(checkSuffix('src/lib/server/thing.server.test.ts', true)).toBeNull()
  })
})

describe('stays quiet when the name matches', () => {
  it('.server.ts with no directive', () => {
    expect(checkSuffix('src/lib/server/db.server.ts', false)).toBeNull()
  })

  it('.action.ts with a directive', () => {
    expect(
      checkSuffix('src/features/x/server/upload.action.ts', true),
    ).toBeNull()
  })

  it('an unsuffixed file either way', () => {
    expect(checkSuffix('src/lib/utils.ts', false)).toBeNull()
    expect(checkSuffix('src/lib/utils.ts', true)).toBeNull()
  })
})
