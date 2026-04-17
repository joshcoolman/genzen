import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { Analytics } from '@vercel/analytics/react'
import appCss from '../styles.css?url'
import { AuthProvider } from '@/components/auth-provider'
import { SpotlightNav } from '@/features/spotlight'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'GenZen',
      },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  component: RootComponent,
  shellComponent: RootDocument,
  notFoundComponent: NotFoundComponent,
})

function RootComponent() {
  return (
    <AuthProvider>
      <SpotlightNav />
      <Outlet />
    </AuthProvider>
  )
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <Link to="/">
        <img
          src="/404.png"
          alt="404 Not Found"
          className="max-h-[50vh] max-w-[50vw] cursor-pointer object-contain"
        />
      </Link>
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
        <Analytics />
      </body>
    </html>
  )
}
