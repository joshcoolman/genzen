import { useCallback, useMemo, useState } from 'react'

export type CharactersStep = 'generate' | 'angles' | 'saved'

export interface MockCharacter {
  id: string
  gradient: string
}

export interface MockSavedCharacter {
  id: string
  name: string
  gradient: string
}

const GRADIENTS = [
  'from-rose-500 to-orange-400',
  'from-violet-500 to-purple-400',
  'from-blue-500 to-cyan-400',
  'from-emerald-500 to-teal-400',
  'from-amber-500 to-yellow-400',
  'from-pink-500 to-fuchsia-400',
  'from-sky-500 to-indigo-400',
  'from-lime-500 to-green-400',
  'from-red-500 to-rose-400',
]

const MOCK_SAVED_CHARACTERS: Array<MockSavedCharacter> = [
  { id: 'saved-1', name: 'Aria', gradient: GRADIENTS[0] },
  { id: 'saved-2', name: 'Marcus', gradient: GRADIENTS[1] },
  { id: 'saved-3', name: 'Luna', gradient: GRADIENTS[2] },
]

function generateMockFaces(count: number): Array<MockCharacter> {
  return GRADIENTS.slice(0, count).map((gradient, i) => ({
    id: `face-${i + 1}`,
    gradient,
  }))
}

export interface UseCharactersPageReturn {
  step: CharactersStep
  prompt: string
  count: number
  faces: Array<MockCharacter>
  selectedFaceId: string | null
  savedCharacters: Array<MockSavedCharacter>
  setPrompt: (prompt: string) => void
  setCount: (count: number) => void
  generateFaces: () => void
  selectFace: (id: string) => void
  goToSaved: () => void
  reset: () => void
}

export function useCharactersPage(): UseCharactersPageReturn {
  const [step, setStep] = useState<CharactersStep>('generate')
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState(9)
  const [faces, setFaces] = useState<Array<MockCharacter>>([])
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null)

  const generateFaces = useCallback(() => {
    setFaces(generateMockFaces(count))
    setSelectedFaceId(null)
    setStep('generate')
  }, [count])

  const selectFace = useCallback((id: string) => {
    setSelectedFaceId(id)
    setStep('angles')
  }, [])

  const goToSaved = useCallback(() => {
    setStep('saved')
  }, [])

  const reset = useCallback(() => {
    setStep('generate')
    setPrompt('')
    setFaces([])
    setSelectedFaceId(null)
  }, [])

  return useMemo(
    () => ({
      step,
      prompt,
      count,
      faces,
      selectedFaceId,
      savedCharacters: MOCK_SAVED_CHARACTERS,
      setPrompt,
      setCount,
      generateFaces,
      selectFace,
      goToSaved,
      reset,
    }),
    [
      step,
      prompt,
      count,
      faces,
      selectedFaceId,
      generateFaces,
      selectFace,
      goToSaved,
      reset,
    ],
  )
}
