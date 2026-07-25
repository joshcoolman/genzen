import { classifyError } from './error-classification'
import { getModelName } from './models'

export interface GenerationRecord {
  status: string | null
  generation_metadata: unknown
  generation_error: string | null
  storage_path?: string | null
}

export interface GenerationView {
  status: 'pending' | 'completed' | 'failed'
  modelName: string
  prompt?: string
  imageUrl?: string
  errorMessage?: string
  isRetryable?: boolean
}

const VALID_STATUSES = new Set(['pending', 'completed', 'failed'])

function coerceStatus(raw: string | null): GenerationView['status'] {
  if (raw && VALID_STATUSES.has(raw)) return raw as GenerationView['status']
  return 'pending'
}

export function normalizeGeneration(
  record: GenerationRecord,
  imageUrl?: string,
): GenerationView {
  const meta = record.generation_metadata as {
    model?: string
    prompt?: string
  } | null
  const status = coerceStatus(record.status)
  const modelName = getModelName(meta?.model ?? '')
  const prompt = meta?.prompt || undefined

  if (status === 'failed') {
    const { category, userMessage } = classifyError(record.generation_error)
    return {
      status,
      modelName,
      prompt,
      errorMessage: userMessage,
      isRetryable: category === 'retryable',
    }
  }

  return {
    status,
    modelName,
    prompt,
    imageUrl: status === 'completed' ? imageUrl : undefined,
  }
}
