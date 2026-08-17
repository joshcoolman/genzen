'use client'

import { StyleEditor } from './_components/style-editor/style-editor'
import { useView } from './use-view'
import type { ThemeCore } from '#/features/theme'
import { PageHeader, Stack } from '#/components'

export function View({ core }: { core: ThemeCore | null }) {
  const editor = useView(core)

  return (
    <Stack gap={32}>
      <PageHeader
        title="Style"
        description="Six colors. Everything else in the palette follows from them."
      />
      <StyleEditor {...editor} />
    </Stack>
  )
}
