// Placeholder while the port is in flight. The real `/` behaviour -- redirect
// to /dashboard when signed in, /login otherwise -- lands with the auth flows,
// where it becomes a middleware decision rather than a client-side fork.
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground">GenZen — Next port in progress</p>
    </main>
  )
}
