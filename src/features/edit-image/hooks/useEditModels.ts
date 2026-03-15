import { useModelSelector } from '@/components/ModelSelector'

export function useEditModels() {
  const selector = useModelSelector({ capability: 'edit', mode: 'multi' })

  return {
    selectedModelIds: selector.selectedIds,
    models: selector.models,
    toggleModel: selector.toggleSelected,
    maxRefImages: selector.maxRefImages ?? 0,
    generationsPerModel: selector.gensPerModel,
    adjustGenerations: selector.adjustGens,
  }
}
