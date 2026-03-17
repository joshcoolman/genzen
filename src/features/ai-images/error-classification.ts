export type ErrorCategory = 'retryable' | 'permanent'

interface ClassifiedError {
  category: ErrorCategory
  userMessage: string
}

const PERMANENT_PATTERNS = [
  {
    pattern: /nsfw|safety|content.?policy|inappropriate/i,
    message: 'Content policy violation',
  },
  {
    pattern: /copyright|ip.?match|intellectual.?property/i,
    message: 'Copyright/IP match detected',
  },
  { pattern: /invalid.?prompt|prompt.?too/i, message: 'Invalid prompt' },
  {
    pattern: /model.?not.?found|model.?unavailable|not.?supported/i,
    message: 'Model unavailable',
  },
  {
    pattern: /input.?validation|invalid.?input|invalid.?parameter/i,
    message: 'Invalid input parameters',
  },
  { pattern: /banned|blocked|forbidden/i, message: 'Request blocked' },
]

const RETRYABLE_PATTERNS = [
  { pattern: /timeout|timed?.?out/i, message: 'Generation timed out' },
  { pattern: /rate.?limit|too.?many.?requests|429/i, message: 'Rate limited' },
  { pattern: /server.?error|internal.?error|5\d{2}/i, message: 'Server error' },
  { pattern: /queue|overloaded|capacity/i, message: 'Service overloaded' },
  { pattern: /network|connection|fetch.?failed/i, message: 'Network error' },
  { pattern: /cleared.?manually/i, message: 'Generation timed out' },
]

export function classifyError(errorMessage: string | null): ClassifiedError {
  if (!errorMessage) {
    return { category: 'retryable', userMessage: 'Unknown error' }
  }

  for (const { pattern, message } of PERMANENT_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return { category: 'permanent', userMessage: message }
    }
  }

  for (const { pattern, message } of RETRYABLE_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return { category: 'retryable', userMessage: message }
    }
  }

  // Default: assume retryable (transient errors are more common)
  return { category: 'retryable', userMessage: errorMessage }
}
