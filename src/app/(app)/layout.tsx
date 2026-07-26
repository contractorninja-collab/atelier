import { redirect } from 'next/navigation'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/auth'
import { Shell } from '@/components/Shell'
import { getLookups, getMyProfile } from '@/server/queries'
import { db } from '@/db'
import * as t from '@/db/schema'
import { sql } from 'drizzle-orm'
import type { TableId } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const [lookups, counts, profile] = await Promise.all([
    getLookups(),
    tableCounts(),
    // Null when the signed-in address has no Team row — the settings dialog says
    // so rather than rendering a form that cannot save.
    session.user.memberId ? getMyProfile(session.user.memberId) : Promise.resolve(null),
  ])

  return (
    <SessionProvider session={session}>
      <Shell
        counts={counts}
        memberName={session.user.memberName}
        profile={profile}
        index={lookups}
      >
        {children}
      </Shell>
    </SessionProvider>
  )
}

/**
 * The sidebar badges, in a single round trip.
 *
 * This was eight parallel `count(*)` queries, on every navigation, for numbers
 * that decorate a nav item. On Vercel that was eight connections held at once
 * per request; when the pooler ran short, the whole layout stalled and took the
 * page down with it — the request never rendered, it just hung until the
 * function timed out.
 *
 * Subselects make it one connection and one round trip. A failure here now
 * costs the badges, not the page.
 */
async function tableCounts(): Promise<Partial<Record<TableId, number>>> {
  try {
    const rows = await db.execute<Record<string, number | string>>(sql`
      select
        (select count(*) from ${t.deals})         as deals,
        (select count(*) from ${t.organizations}) as organizations,
        (select count(*) from ${t.contacts})      as contacts,
        (select count(*) from ${t.activities})    as activities,
        (select count(*) from ${t.products})      as products,
        (select count(*) from ${t.sources})       as sources,
        (select count(*) from ${t.teamMembers})   as team,
        (select count(*) from ${t.targets})       as targets
    `)
    const row = (rows as unknown as Record<string, number | string>[])[0] ?? {}
    const n = (key: string) => Number(row[key] ?? 0)
    return {
      deals: n('deals'),
      organizations: n('organizations'),
      contacts: n('contacts'),
      activities: n('activities'),
      products: n('products'),
      sources: n('sources'),
      team: n('team'),
      targets: n('targets'),
    }
  } catch (error) {
    console.error('tableCounts failed; rendering without badges', error)
    return {}
  }
}
