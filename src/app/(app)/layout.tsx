import { redirect } from 'next/navigation'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/auth'
import { Shell } from '@/components/Shell'
import { getLookups, getMyProfile } from '@/server/queries'
import { db } from '@/db'
import * as t from '@/db/schema'
import { count } from 'drizzle-orm'
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

async function tableCounts(): Promise<Partial<Record<TableId, number>>> {
  const [deals, orgs, contacts, activities, products, sources, team, targets] = await Promise.all([
    db.select({ n: count() }).from(t.deals),
    db.select({ n: count() }).from(t.organizations),
    db.select({ n: count() }).from(t.contacts),
    db.select({ n: count() }).from(t.activities),
    db.select({ n: count() }).from(t.products),
    db.select({ n: count() }).from(t.sources),
    db.select({ n: count() }).from(t.teamMembers),
    db.select({ n: count() }).from(t.targets),
  ])
  return {
    deals: deals[0].n,
    organizations: orgs[0].n,
    contacts: contacts[0].n,
    activities: activities[0].n,
    products: products[0].n,
    sources: sources[0].n,
    team: team[0].n,
    targets: targets[0].n,
  }
}
