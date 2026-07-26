import { notFound } from 'next/navigation'
import { TableWorkspace } from '@/components/TableWorkspace'
import { Topbar } from '@/components/Topbar'
import { getLookups, getRows } from '@/server/queries'
import { getTable, SPACES } from '@/lib/tables'

export const dynamic = 'force-dynamic'

export default async function TablePage({ params }: { params: Promise<{ table: string }> }) {
  const { table } = await params
  const config = getTable(table)
  if (!config) notFound()

  const [rows, lookups] = await Promise.all([getRows(config.id), getLookups()])
  const space = SPACES.find((s) => s.tables.includes(config.id as never))

  return (
    <>
      <Topbar
        crumbs={[{ label: space?.name ?? 'Workspace', color: space?.color, abbr: space?.abbr, icon: space?.icon }]}
        title={config.name}
      />
      <TableWorkspace config={config} rows={rows} lookups={lookups} />
    </>
  )
}
