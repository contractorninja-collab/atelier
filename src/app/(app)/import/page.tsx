import { Topbar } from '@/components/Topbar'
import { ImportWorkspace } from '@/components/ImportWorkspace'
import { existingCounts } from '@/server/import'

export const dynamic = 'force-dynamic'

export default async function ImportPage() {
  const counts = await existingCounts()
  return (
    <>
      <Topbar title="Import data" />
      <ImportWorkspace counts={counts} />
    </>
  )
}
