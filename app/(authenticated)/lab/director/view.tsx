'use client'

import { LabPage } from '../_components/lab-page/lab-page'
import { Workspace } from './_components/workspace/workspace'
import { useView } from './use-view'

export function View({ owner }: { owner: string }) {
  const state = useView(owner)
  return (
    <LabPage
      title="Director"
      question="Build a cut one short clip at a time. Keep watching while you decide what comes next."
      instructionFile="src/lib/prompts/director-clips.md"
      wide
    >
      <Workspace state={state} />
    </LabPage>
  )
}
