import { createFileRoute } from '@tanstack/react-router'
import { CharactersPageContent, useCharactersPage } from '@/features/characters'

export const Route = createFileRoute('/dashboard/characters')({
  component: CharactersPage,
})

function CharactersPage() {
  const page = useCharactersPage()
  return <CharactersPageContent page={page} />
}
