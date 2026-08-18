import { config } from 'dotenv'
config({ path: '.env.local' })
import { writeFileSync } from 'node:fs'
import { storage } from './src/lib/image-storage'

const paths: Array<[string, string]> = [
  [
    'new',
    'ae36e9c6-bff8-4ecd-bfd8-014871330235/ai_1787062914723_c00933e4-89a8-4298-83ea-4a2f6715a0a1.mp4',
  ],
  [
    'old',
    'ae36e9c6-bff8-4ecd-bfd8-014871330235/ai_1786575712886_e5ad97ee-830e-4d7f-bdd1-0f714faffae4.mp4',
  ],
]
for (const [tag, p] of paths) {
  const buf = await storage.download(p)
  writeFileSync(`/tmp/${tag}.mp4`, buf as never)
  console.log(tag, (buf as Buffer).length)
}
