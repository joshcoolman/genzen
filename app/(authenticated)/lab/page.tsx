import { redirect } from 'next/navigation'

/**
 * `/lab` has no page of its own. The rail entry has to point somewhere, and an
 * index listing the same links the nav beside it already shows would be a
 * page whose only content is a duplicate of its own navigation.
 */
export default function LabPage() {
  redirect('/lab/enhance')
}
