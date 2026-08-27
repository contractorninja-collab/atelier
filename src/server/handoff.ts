import { and, eq } from 'drizzle-orm'
import * as t from '@/db/schema'
// Type-only: importing the value would open a connection on import, and this
// module has to be loadable by a test that supplies its own database.
import type { db } from '@/db'
import { MILESTONE_TEMPLATE } from '@/lib/tables'
import { dealMoney } from './compute'

/**
 * The Closed Won handoff.
 *
 * Lives here rather than in actions.ts for two reasons. `'use server'` turns
 * every export into a client-callable endpoint, and this should not be one. And
 * the guard below is the single most consequential piece of logic in the app —
 * it deserves a test, which means it has to be callable without a session.
 */

/** Any transaction handle, so the caller decides the boundary. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Only these produce delivery work; a pure subscription has nothing to build. */
export const DELIVERY_DEAL_TYPES = ['Project', 'Hybrid', 'Retainer']

/**
 * Create the delivery project and its milestone set for a won deal.
 *
 * Returns null — doing nothing — when the deal does not exist, is not a
 * delivery type, or **already has a project**. That last case is the one that
 * matters: duplicate projects quietly double every capacity and margin figure
 * downstream, and nobody notices for a month. Winning a deal twice, running the
 * handoff by hand after it already ran, a double-submitted form: all must be
 * inert.
 */
export type HandoffResult = {
  message: string
  projectId: string
  projectName: string
  pmId: string | null
}

export async function spawnProjectForDeal(tx: Tx, dealId: string): Promise<HandoffResult | null> {
  const deal = await tx.query.deals.findFirst({
    where: eq(t.deals.id, dealId),
    with: {
      organization: { columns: { id: true, name: true } },
      lineItems: {
        columns: {
          quantity: true, unitPriceCents: true, discountBps: true, billing: true,
          estimatedDeliveryHours: true,
        },
      },
    },
  })
  if (!deal) return null
  if (!DELIVERY_DEAL_TYPES.includes(deal.type)) return null

  // The idempotency guard. Everything above is a precondition; this is the one
  // that stops the same win being applied twice.
  const existing = await tx.query.projects.findFirst({ where: eq(t.projects.dealId, dealId) })
  if (existing) return null

  // A PM if we have one, otherwise whoever owns the deal — better an imperfect
  // owner than an unowned project.
  const pm = await tx.query.teamMembers.findFirst({
    where: and(eq(t.teamMembers.department, 'Delivery'), eq(t.teamMembers.status, 'Active')),
  })

  const money = dealMoney(deal)
  const budgetMinutes = deal.lineItems.reduce(
    (sum, line) => sum + (line.estimatedDeliveryHours ?? 0) * 60,
    0,
  )

  const start = new Date()
  const startISO = start.toISOString().slice(0, 10)
  const addDays = (days: number) =>
    new Date(start.getTime() + days * 86_400_000).toISOString().slice(0, 10)

  const lastOffset = MILESTONE_TEMPLATE[MILESTONE_TEMPLATE.length - 1].offsetDays
  const launchISO = addDays(lastOffset)

  const [project] = await tx
    .insert(t.projects)
    .values({
      name: `${deal.organization?.name ?? 'Project'} — ${deal.name.split(' — ')[1] ?? 'Delivery'} — ${start.getFullYear()}`,
      type: deal.type === 'Retainer' ? 'SupportRetainer' : 'ClientDelivery',
      status: 'Kickoff',
      health: 'Green',
      organizationId: deal.organizationId,
      dealId: deal.id,
      portfolioProductId: deal.portfolioProductId,
      pmId: pm?.id ?? deal.ownerId,
      startDate: startISO,
      targetLaunch: launchISO,
      // Frozen now so slip is always measured against the original promise.
      baselineLaunch: launchISO,
      budgetMinutes,
      contractValueCents: money.tcvCents,
      scopeSummary: `Generated from ${deal.name} on close. Confirm scope and adjust milestone dates at kickoff.`,
    })
    .returning({ id: t.projects.id, name: t.projects.name })

  const totalWeight = MILESTONE_TEMPLATE.reduce((sum, m) => sum + m.weightBps, 0)
  if (totalWeight !== 10_000) {
    // A project whose weights do not sum to 100% can never read as complete,
    // and the reason is invisible six weeks later. Fail loudly instead.
    throw new Error(`Milestone template weights total ${totalWeight}bps, expected 10000`)
  }

  await tx.insert(t.milestones).values(
    MILESTONE_TEMPLATE.map((m, index) => ({
      name: m.name,
      projectId: project.id,
      sequence: index + 1,
      phase: m.phase as 'Kickoff',
      status: 'NotStarted' as const,
      ownerId: pm?.id ?? deal.ownerId,
      startDate: index === 0 ? startISO : addDays(MILESTONE_TEMPLATE[index - 1].offsetDays),
      dueDate: addDays(m.offsetDays),
      baselineDue: addDays(m.offsetDays),
      weightBps: m.weightBps,
      acceptanceCriteria: m.acceptanceCriteria,
      clientSignOffRequired: m.clientSignOffRequired,
      paymentTrigger: m.paymentTrigger,
      invoiceAmountCents: m.paymentTrigger
        ? Math.round((money.tcvCents * m.weightBps) / 10_000)
        : 0,
    })),
  )

  return {
    message: `${project.name} created with ${MILESTONE_TEMPLATE.length} milestones`,
    projectId: project.id,
    projectName: project.name,
    // Who ended up running it — so the caller can tell them, once the
    // transaction has actually committed.
    pmId: pm?.id ?? deal.ownerId,
  }
}
