import { RotateCcw, Save, Sparkles, UserPlus } from 'lucide-react'
import type { UseCharactersPageReturn } from '../hooks/useCharactersPage'
import { ActionButton } from '@/components/ActionButton'

interface CharactersPageContentProps {
  page: UseCharactersPageReturn
}

export function CharactersPageContent({ page }: CharactersPageContentProps) {
  return (
    <div className="space-y-6">
      {page.step === 'generate' && <GenerateStep page={page} />}
      {page.step === 'angles' && <AnglesStep page={page} />}
      {page.step === 'saved' && <SavedStep page={page} />}
    </div>
  )
}

const COUNT_OPTIONS = [4, 6, 9]

function GenerateStep({ page }: { page: UseCharactersPageReturn }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <textarea
          value={page.prompt}
          onChange={(e) => page.setPrompt(e.target.value)}
          placeholder="Describe a character..."
          rows={1}
          className="flex-1 resize-none rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <select
          value={page.count}
          onChange={(e) => page.setCount(Number(e.target.value))}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {COUNT_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} faces
            </option>
          ))}
        </select>
        <ActionButton
          onClick={page.generateFaces}
          disabled={!page.prompt.trim()}
          icon={<Sparkles className="size-4" />}
        >
          Generate
        </ActionButton>
      </div>

      {page.faces.length > 0 && (
        <div className="flex flex-col items-center space-y-4">
          <div className="w-2/3">
            <div className="grid grid-cols-3 gap-3">
              {page.faces.map((face) => (
                <button
                  key={face.id}
                  type="button"
                  onClick={() => page.selectFace(face.id)}
                  className="aspect-square rounded-md bg-gradient-to-br cursor-pointer transition-all hover:ring-2 hover:ring-accent-brand hover:ring-offset-2 hover:ring-offset-card"
                  style={{
                    backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))`,
                  }}
                >
                  <div
                    className={`size-full rounded-md bg-gradient-to-br ${face.gradient}`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={page.goToSaved}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          View saved characters
        </button>
      </div>
    </div>
  )
}

const ANGLE_LABELS = [
  'Front',
  'Left Quarter',
  'Left Profile',
  'Right Quarter',
  'Right Profile',
  'Back',
  'Top-Down',
  'Low Angle',
  '3/4 View',
]

function AnglesStep({ page }: { page: UseCharactersPageReturn }) {
  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="w-2/3 space-y-4">
        <h2 className="text-lg font-medium">Character Angles</h2>
        <div className="grid grid-cols-3 gap-3">
          {ANGLE_LABELS.map((label) => (
            <div
              key={label}
              className="relative aspect-square rounded-md bg-muted flex items-end justify-center pb-2"
            >
              <span className="rounded bg-background/80 px-2 py-0.5 text-xs font-medium">
                {label}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <ActionButton
            onClick={page.reset}
            icon={<RotateCcw className="size-4" />}
          >
            Reset
          </ActionButton>
          <ActionButton
            onClick={page.goToSaved}
            icon={<Save className="size-4" />}
          >
            Save Character
          </ActionButton>
        </div>
      </div>
    </div>
  )
}

function SavedStep({ page }: { page: UseCharactersPageReturn }) {
  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="w-2/3 space-y-4">
        <h2 className="text-lg font-medium">Saved Characters</h2>
        <div className="grid grid-cols-3 gap-3">
          {page.savedCharacters.map((character) => (
            <div
              key={character.id}
              className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3"
            >
              <div
                className={`size-20 rounded-full bg-gradient-to-br ${character.gradient}`}
              />
              <span className="text-sm font-medium">{character.name}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-start">
          <ActionButton
            onClick={page.reset}
            icon={<UserPlus className="size-4" />}
          >
            New Character
          </ActionButton>
        </div>
      </div>
    </div>
  )
}
