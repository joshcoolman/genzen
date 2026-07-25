import type { Metadata } from 'next'
import '@/styles.css'

// The App Router equivalent of __root.tsx's `head`. Fonts stay as plain
// stylesheet links rather than next/font: the theme in src/styles.css refers to
// them by family name, and next/font would rename them to a generated class.
export const metadata: Metadata = {
  title: 'GenZen',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
