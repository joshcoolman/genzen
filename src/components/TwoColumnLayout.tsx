import type { ReactNode } from 'react'

interface TwoColumnLayoutProps {
  left: ReactNode
  right: ReactNode
  topOffset?: string
  fixedHeight?: boolean
}

export function TwoColumnLayout({
  left,
  right,
  topOffset = '4rem',
  fixedHeight = true,
}: TwoColumnLayoutProps) {
  return (
    <div
      className={`flex gap-4 ${fixedHeight ? 'overflow-hidden' : ''}`}
      style={fixedHeight ? { height: `calc(100vh - ${topOffset})` } : undefined}
    >
      <div
        className={`flex w-80 shrink-0 flex-col gap-3 ${fixedHeight ? 'overflow-y-auto' : ''}`}
      >
        {left}
      </div>
      <div
        className={`flex flex-1 flex-col gap-3 ${fixedHeight ? 'overflow-y-auto' : ''}`}
      >
        {right}
      </div>
    </div>
  )
}
