import { useState } from 'react'
import { Loader2, Sparkles, X } from 'lucide-react'
import type {
  BrainstormModelKey,
  BrainstormVibeKey,
} from '@/features/ai-images/server/brainstorm-images.server'
import { ActionButton } from '@/components/ActionButton'
import { useBrainstorm } from '@/features/ai-images/hooks/use-brainstorm'

const COLOR_GRADE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'desert_chrome', label: 'Desert Chrome' },
  { value: 'iron_city', label: 'Iron City' },
  { value: 'verde_bloom', label: 'Verde Bloom' },
] as const

const VIBE_OPTIONS = [
  { value: 'unusual', label: 'Unusual' },
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'gritty', label: 'Gritty' },
  { value: 'ethereal', label: 'Ethereal' },
  { value: 'professional', label: 'Professional' },
] as const

const MAX_CHIPS = 6

interface BrainstormPanelProps {
  accessToken: string | undefined
}

export function BrainstormPanel({ accessToken }: BrainstormPanelProps) {
  const [subjects, setSubjects] = useState<Array<string>>([
    'male',
    'female',
    'monster',
    'plant',
    'insect',
    'reptile',
  ])
  const [role, setRole] = useState('hero')
  const [vibe, setVibe] = useState<BrainstormVibeKey>('cinematic')
  const [colorGrade, setColorGrade] = useState<string | null>(null)
  const [model, setModel] = useState<BrainstormModelKey>('schnell')

  const brainstorm = useBrainstorm({
    accessToken,
    subjects,
    role,
    vibe,
    colorGrade,
    model,
  })

  return (
    <div className="bg-card rounded-lg p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Brainstorm</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Generate 6 quick ideas with Flux Schnell. Click one to refine it
            with Nano Banana Pro.
          </p>
        </div>
        <ActionButton
          onClick={() => void brainstorm.trigger()}
          loading={brainstorm.isGenerating}
          loadingText="Generating..."
          disabled={!accessToken}
          icon={<Sparkles className="size-4" />}
          className="shrink-0"
        >
          {brainstorm.hasGenerated ? 'Regenerate' : 'Brainstorm'}
        </ActionButton>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ChipInput
          values={subjects}
          onChange={setSubjects}
          placeholder="Add subjects"
          className="flex-1 min-w-0"
        />
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Role"
          className="h-8 w-24 rounded-md border border-border bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <select
          value={vibe}
          onChange={(e) => setVibe(e.target.value as BrainstormVibeKey)}
          className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
        >
          {VIBE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={colorGrade ?? ''}
          onChange={(e) => setColorGrade(e.target.value || null)}
          className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
        >
          {COLOR_GRADE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="brainstorm-model"
              value="schnell"
              checked={model === 'schnell'}
              onChange={() => setModel('schnell')}
              className="accent-foreground"
            />
            Schnell
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="brainstorm-model"
              value="dev"
              checked={model === 'dev'}
              onChange={() => setModel('dev')}
              className="accent-foreground"
            />
            Dev
          </label>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {brainstorm.images.map((img, i) => (
          <BrainstormSlot
            key={i}
            image={img}
            refineCount={brainstorm.refineCounts[i] ?? 0}
            subject={brainstorm.slotSubjects[i]}
            onSelect={() => {
              if (img.url) void brainstorm.selectImage(img.url, i)
            }}
          />
        ))}
      </div>
    </div>
  )
}

interface ChipInputProps {
  values: Array<string>
  onChange: (values: Array<string>) => void
  placeholder: string
  className?: string
}

function ChipInput({
  values,
  onChange,
  placeholder,
  className,
}: ChipInputProps) {
  const [input, setInput] = useState('')

  function add(value: string) {
    const trimmed = value.trim()
    if (!trimmed || values.length >= MAX_CHIPS) return
    if (values.includes(trimmed)) return
    onChange([...values, trimmed])
    setInput('')
  }

  function remove(index: number) {
    onChange(values.filter((_, i) => i !== index))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(input)
    }
    if (e.key === 'Backspace' && !input && values.length > 0) {
      remove(values.length - 1)
    }
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 bg-muted/50 rounded-md border border-border px-2 py-1.5 ${className ?? ''}`}
    >
      {values.map((value, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 bg-background border border-border rounded px-2 py-0.5 text-xs font-medium"
        >
          {value}
          <button
            onClick={() => remove(i)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {values.length < MAX_CHIPS && (
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => add(input)}
          placeholder={values.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      )}
    </div>
  )
}

interface BrainstormSlotProps {
  image: { url: string | null; loading: boolean }
  refineCount: number
  subject: string | null
  onSelect: () => void
}

function BrainstormSlot({
  image,
  refineCount,
  subject,
  onSelect,
}: BrainstormSlotProps) {
  if (image.loading) {
    return (
      <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!image.url) {
    return (
      <div className="aspect-video bg-muted/50 rounded-md border border-dashed border-border" />
    )
  }

  return (
    <button
      onClick={onSelect}
      className="aspect-video rounded-md overflow-hidden relative group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <img
        src={image.url}
        alt="Brainstorm idea"
        className="w-full h-full object-cover transition-opacity group-hover:opacity-80"
      />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
        <span className="text-white text-xs font-medium">Refine</span>
      </div>
      {subject && (
        <div className="absolute top-1.5 left-1.5 bg-black/70 text-white text-xs font-medium rounded px-1.5 py-0.5 leading-none max-w-[80%] truncate">
          {subject}
        </div>
      )}
      {refineCount > 0 && (
        <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-xs font-medium rounded px-1.5 py-0.5 leading-none">
          {refineCount}x
        </div>
      )}
    </button>
  )
}
