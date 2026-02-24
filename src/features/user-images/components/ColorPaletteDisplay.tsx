/**
 * Color Palette Display
 *
 * 8x3 grid showing 8 hue-diverse colors
 * with 3 representative shades (900/600/400) per color.
 * Uses client-side Canvas API for palette generation.
 */

import { useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  defaultAnimateLayoutChanges,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Check,
  Clipboard,
  Loader2,
  Lock,
  RefreshCw,
  Shuffle,
  Unlock,
  X,
} from 'lucide-react'
import { isColorPaletteV3 } from '../types'
import {
  generatePaletteFromImage,
  getHueFromHex,
  getLightnessFromHex,
  getSaturationFromHex,
  shiftHueAndRegenerateScale,
} from '../lib/palette-generator'
import { HueShiftPopover } from './HueShiftPopover'
import { ColorSwatch } from './ColorSwatch'
import type { PaletteMode } from '../lib/palette-generator'
import type { ColorPalette, ShadeScale } from '../types'
import type { AnimateLayoutChanges } from '@dnd-kit/sortable'
import type { DragEndEvent } from '@dnd-kit/core'
import type { Json } from '@/lib/types/supabase'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

interface ColorPaletteDisplayProps {
  palette: ColorPalette | null
  imageId: string
  imageUrl: string
  userId: string
  onPaletteGenerated: (palette: ColorPalette) => void
  onClose?: () => void
}

const DISPLAY_SHADES = [900, 700, 500, 400] as const

interface SortableColumnProps {
  id: string
  colorScale: ShadeScale
  colorIdx: number
  isLocked: boolean
  isRegenerating: boolean
  isGenerating: boolean
  onRegenerate: () => void
  onToggleLock: () => void
  onColorChange: (hue: number, saturation: number, lightness: number) => void
}

// Disable animation when dropping to prevent confusing "return" animation
const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  const { wasDragging } = args
  // Skip animation when dropping (was dragging but no longer sorting)
  if (wasDragging) {
    return false
  }
  return defaultAnimateLayoutChanges(args)
}

function SortableColumn({
  id,
  colorScale,
  colorIdx,
  isLocked,
  isRegenerating,
  isGenerating,
  onRegenerate,
  onToggleLock,
  onColorChange,
}: SortableColumnProps) {
  // Get current HSL values from the 500 shade (base color)
  const currentHue = getHueFromHex(colorScale[500])
  const currentSaturation = getSaturationFromHex(colorScale[500])
  const currentLightness = getLightnessFromHex(colorScale[500])
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, animateLayoutChanges })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col gap-1.5"
      data-column={colorIdx}
    >
      {/* 900 swatch - draggable with icons */}
      <div
        className={`group/swatch relative aspect-square rounded-sm ${isDragging ? 'ring-2 ring-primary' : ''}`}
        style={{ backgroundColor: colorScale[900] }}
      >
        {/* Drag handle - entire swatch except icon areas */}
        <div
          {...attributes}
          {...listeners}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
        />
        {/* Regenerate icon - top left, hover only */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRegenerate()
          }}
          disabled={isLocked || isRegenerating || isGenerating}
          className={`absolute top-1 left-1 p-0.5 rounded transition-colors z-10 opacity-0 group-hover/swatch:opacity-100 ${
            isLocked
              ? 'opacity-30 cursor-not-allowed'
              : 'hover:bg-white/20 cursor-pointer'
          }`}
          title={isLocked ? 'Unlock to regenerate' : 'Regenerate column'}
        >
          {isRegenerating ? (
            <Loader2 className="h-3 w-3 text-white/70 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3 text-white/70" />
          )}
        </button>
        {/* HSL color adjust icon - top right, hover only */}
        <div className="absolute top-0 right-1 z-10 opacity-0 group-hover/swatch:opacity-100 transition-opacity">
          <HueShiftPopover
            currentHue={currentHue}
            currentSaturation={currentSaturation}
            currentLightness={currentLightness}
            columnIndex={colorIdx}
            disabled={isLocked || isRegenerating || isGenerating}
            onColorChange={onColorChange}
          />
        </div>
        {/* Lock icon - bottom right, always visible */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleLock()
          }}
          disabled={isRegenerating || isGenerating}
          className="absolute bottom-1 right-1 p-0.5 rounded hover:bg-white/20 transition-colors z-10"
          title={isLocked ? 'Unlock column' : 'Lock column'}
        >
          {isLocked ? (
            <Lock className="h-3 w-3 text-white/90" />
          ) : (
            <Unlock className="h-3 w-3 text-white/50" />
          )}
        </button>
      </div>
      {/* Remaining shades */}
      {DISPLAY_SHADES.slice(1).map((shade) => (
        <ColorSwatch
          key={shade}
          hex={colorScale[shade]}
          size="fill"
          label={String(shade)}
        />
      ))}
    </div>
  )
}

export function ColorPaletteDisplay({
  palette,
  imageId,
  imageUrl,
  userId,
  onPaletteGenerated,
  onClose,
}: ColorPaletteDisplayProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentMode, setCurrentMode] = useState<PaletteMode | null>(null)
  const [regeneratingColumn, setRegeneratingColumn] = useState<number | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [lockedColumns, setLockedColumns] = useState<Array<boolean>>(
    Array(6).fill(false),
  )
  const [view, setView] = useState<'palette' | 'json'>('palette')
  const [copied, setCopied] = useState(false)
  // Stable IDs for dnd-kit sortable context
  const columnIds = Array.from({ length: 6 }, (_, i) => `col-${i}`)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !palette) return

    const oldIndex = columnIds.indexOf(active.id as string)
    const newIndex = columnIds.indexOf(over.id as string)

    // Capture previous state for rollback
    const prevLockedColumns = lockedColumns
    const prevPalette = palette

    // Reorder locked columns to match
    const newLockedColumns = arrayMove([...lockedColumns], oldIndex, newIndex)
    setLockedColumns(newLockedColumns)

    // Reorder palette colors
    const newColors = arrayMove([...palette.colors], oldIndex, newIndex)
    const reorderedPalette = { ...palette, colors: newColors }

    // Optimistic update - apply immediately for smooth UX
    onPaletteGenerated(reorderedPalette)

    // Save to database in background
    const { error: updateError } = await supabase
      .from('user_images')
      .update({ color_palette: reorderedPalette as unknown as Json })
      .eq('id', imageId)
      .eq('user_id', userId)

    if (updateError) {
      // Revert on error
      setLockedColumns(prevLockedColumns)
      onPaletteGenerated(prevPalette)
      setError('Failed to save column order')
    }
  }

  const toggleLock = (idx: number) => {
    setLockedColumns((prev) => {
      const next = [...prev]
      next[idx] = !next[idx]
      return next
    })
  }

  const handleGenerate = async (mode: PaletteMode = 'balanced') => {
    setIsGenerating(true)
    setCurrentMode(mode)
    setError(null)

    try {
      // Generate palette client-side using Canvas API
      let newPalette = await generatePaletteFromImage(imageUrl, mode)

      // Merge: keep locked colors from current palette
      if (palette) {
        newPalette = {
          ...newPalette,
          colors: newPalette.colors.map((color, idx) =>
            lockedColumns[idx] ? palette.colors[idx] : color,
          ),
        }
      }

      // Save to database
      const { error: updateError } = await supabase
        .from('user_images')
        .update({ color_palette: newPalette as unknown as Json })
        .eq('id', imageId)
        .eq('user_id', userId)

      if (updateError) {
        throw updateError
      }

      onPaletteGenerated(newPalette)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate palette',
      )
    } finally {
      setIsGenerating(false)
      setCurrentMode(null)
    }
  }

  const handleRegenerateColumn = async (columnIdx: number) => {
    if (!palette || lockedColumns[columnIdx]) return

    setRegeneratingColumn(columnIdx)
    setError(null)

    try {
      // Generate a new palette and pick a random color from it
      const newPalette = await generatePaletteFromImage(imageUrl, 'balanced')
      const randomIdx = Math.floor(Math.random() * newPalette.colors.length)

      // Merge: replace the specified column with a random color from the new palette
      const mergedPalette = {
        ...palette,
        colors: palette.colors.map((color, idx) =>
          idx === columnIdx ? newPalette.colors[randomIdx] : color,
        ),
      }

      // Save to database
      const { error: updateError } = await supabase
        .from('user_images')
        .update({ color_palette: mergedPalette as unknown as Json })
        .eq('id', imageId)
        .eq('user_id', userId)

      if (updateError) {
        throw updateError
      }

      onPaletteGenerated(mergedPalette)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to regenerate column',
      )
    } finally {
      setRegeneratingColumn(null)
    }
  }

  const handleColorChange = async (
    columnIdx: number,
    newHue: number,
    newSaturation: number,
    newLightness: number,
  ) => {
    if (!palette || lockedColumns[columnIdx]) return

    setError(null)

    try {
      // Get current 500 shade and regenerate with new HSL values
      const currentScale = palette.colors[columnIdx]
      const newScale = shiftHueAndRegenerateScale(
        currentScale[500],
        newHue,
        newSaturation,
        newLightness,
      )

      // Update palette with new scale
      const updatedPalette = {
        ...palette,
        colors: palette.colors.map((color, idx) =>
          idx === columnIdx ? newScale : color,
        ),
      }

      // Save to database
      const { error: updateError } = await supabase
        .from('user_images')
        .update({ color_palette: updatedPalette as unknown as Json })
        .eq('id', imageId)
        .eq('user_id', userId)

      if (updateError) {
        throw updateError
      }

      onPaletteGenerated(updatedPalette)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust color')
    }
  }

  // No palette yet - show generate button
  if (!palette) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-full">
        {isGenerating ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Generating palette...
            </span>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={() => handleGenerate('balanced')}
              className="gap-2"
            >
              Generate Color Palette
            </Button>
            {error && <span className="text-sm text-destructive">{error}</span>}
          </>
        )}
      </div>
    )
  }

  // Check for v3 palette format
  if (!isColorPaletteV3(palette)) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-full">
        <span className="text-sm text-muted-foreground">
          Legacy palette format detected
        </span>
        <Button
          variant="outline"
          onClick={() => handleGenerate('balanced')}
          disabled={isGenerating}
          className="gap-2"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Regenerate Palette
        </Button>
      </div>
    )
  }

  const handleCopyJson = async () => {
    const json = JSON.stringify(palette, null, 2)
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header bar: tabs left, action icons right */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex gap-1">
          <button
            onClick={() => setView('palette')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              view === 'palette'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Palette
          </button>
          <button
            onClick={() => setView('json')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              view === 'json'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            JSON
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleGenerate('balanced')}
            disabled={isGenerating || regeneratingColumn !== null}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
            title="Regenerate palette"
          >
            {isGenerating && currentMode === 'balanced' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => handleGenerate('random')}
            disabled={isGenerating || regeneratingColumn !== null}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
            title="Randomize palette"
          >
            {isGenerating && currentMode === 'random' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Shuffle className="h-4 w-4" />
            )}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="px-4 py-1">
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {view === 'palette' ? (
        <>
          {/* 6-column grid: draggable color columns */}
          <div className="flex-1 p-4 overflow-y-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={columnIds}
                strategy={horizontalListSortingStrategy}
              >
                <div className="grid grid-cols-6 gap-1.5">
                  {columnIds.map((colId, idx) => (
                    <SortableColumn
                      key={colId}
                      id={colId}
                      colorScale={palette.colors[idx]}
                      colorIdx={idx}
                      isLocked={lockedColumns[idx]}
                      isRegenerating={regeneratingColumn === idx}
                      isGenerating={isGenerating}
                      onRegenerate={() => handleRegenerateColumn(idx)}
                      onToggleLock={() => toggleLock(idx)}
                      onColorChange={(hue, sat, light) =>
                        handleColorChange(idx, hue, sat, light)
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </>
      ) : (
        <div className="flex-1 min-h-0 p-4 pb-5 flex flex-col">
          <div className="relative flex-1 min-h-0">
            <button
              onClick={handleCopyJson}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-accent transition-colors z-10"
              title="Copy JSON"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Clipboard className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <pre className="text-xs bg-muted rounded-md p-4 overflow-auto h-full font-mono">
              {JSON.stringify(palette, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
