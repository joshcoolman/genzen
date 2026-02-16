import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="min-h-[calc(100vh-52px)] flex flex-col items-center justify-center p-4 bg-background">
      <h1 className="text-4xl font-semibold text-foreground">Home</h1>
      <p className="text-muted-foreground mt-4">Coming soon.</p>
    </div>
  )
}
