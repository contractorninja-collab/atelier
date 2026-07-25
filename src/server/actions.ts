'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import * as t from '@/db/schema'
import { auth } from '@/auth'
import { MILESTONE_TEMPLATE, getTable } from '@/lib/tables'
import { daysBetween, normaliseDomain, toISODate } from '@/lib/format'
import { dealMoney } from './compute'
import type { ActionResult, TableId } from '@/lib/types'

/** Every action goes through this. No session, no write. */
async function requireMember() {
  const session = await auth()
  if (!session?.user) throw new Error('Not signed in')
  return { userId: session.user.id, memberId: session.user.memberId }
}

const TABLE_TO_DRIZZLE = {
  deals: t.deals,
  organizations: t.organizations,
  contacts: t.contacts,
  activities: t.activities,
  products: t.products,
  sources: t.sources,
  team: t.teamMembers,
  targets: t.targets,
  portfolio: t.portfolioProducts,
  projects: t.projects,
  milestones: t.milestones,
  tasks: t.tasks,
  sprints: t.sprints,
  timeEntries: t.timeEntries,
  allocations: t.allocations,
  absences: t.absences,
  changeRequests: t.changeRequests,
  risks: t.risks,
} as const

/**
 * Columns the UI is allowed to write, per table. An allow-list rather than a
 * deny-list: a new column is read-only until someone deliberately opens it.
 * Computed fields (tcv, hygiene, daysInStage…) are absent by design.
 */
const WRITABLE: Record<TableId, string[]> = {
  deals: [
    'name', 'type', 'motion', 'forecast', 'expectedCloseDate', 'actualCloseDate',
    'nextStep', 'nextStepDate', 'contractMonths', 'championIdentified',
    'economicBuyerIdentified', 'painDocumented', 'decisionProcessDocumented',
    'lossReason', 'lossNotes', 'notes', 'organizationId', 'primaryContactId',
    'ownerId', 'sourceId', 'probabilityOverrideBps',
  ],
  organizations: [
    'name', 'legalName', 'domain', 'lifecycle', 'segment', 'industry', 'country',
    'city', 'employeeCount', 'website', 'linkedin', 'vatId', 'notes', 'ownerId', 'sourceId',
  ],
  contacts: [
    'firstName', 'lastName', 'email', 'phone', 'title', 'persona', 'status',
    'marketingOptIn', 'language', 'linkedin', 'notes', 'organizationId', 'ownerId',
  ],
  activities: [
    'subject', 'type', 'outcome', 'occurredAt', 'nextStep', 'nextStepDue',
    'durationMinutes', 'notes', 'organizationId', 'dealId', 'contactId', 'ownerId',
  ],
  products: ['name', 'type', 'listPriceCents', 'billing', 'unit', 'costToServeCents', 'active', 'description'],
  sources: ['name', 'category', 'active', 'monthlyCostCents'],
  team: ['name', 'email', 'role', 'department', 'status', 'weeklyCapacityHours', 'timezone', 'startDate', 'squad'],
  targets: ['period', 'metric', 'scope', 'value', 'teamMemberId'],
  portfolio: [
    'name', 'slug', 'status', 'description', 'color', 'ownerId', 'launchedAt',
    'repoUrl', 'productionUrl', 'active',
  ],
  projects: [
    'name', 'type', 'status', 'health', 'healthNote', 'organizationId', 'dealId',
    'portfolioProductId', 'pmId', 'startDate', 'targetLaunch', 'baselineLaunch',
    'actualLaunch', 'budgetMinutes', 'contractValueCents', 'scopeSummary',
    'repoUrl', 'stagingUrl', 'notes',
  ],
  milestones: [
    'name', 'projectId', 'sequence', 'phase', 'status', 'ownerId', 'startDate',
    'dueDate', 'baselineDue', 'completedDate', 'weightBps', 'acceptanceCriteria',
    'clientSignOffRequired', 'signedOffById', 'signedOffDate', 'paymentTrigger',
    'invoiceAmountCents',
  ],
  tasks: [
    'title', 'type', 'status', 'blocked', 'blockedReason', 'priority', 'severity',
    'reportSource', 'projectId', 'milestoneId', 'sprintId', 'portfolioProductId',
    'assigneeId', 'reviewerId', 'estimateMinutes', 'startDate', 'dueDate',
    'acceptanceCriteria', 'reproSteps', 'prUrl',
  ],
  sprints: ['name', 'goal', 'status', 'startDate', 'endDate', 'committedMinutes', 'retroNotes', 'squad'],
  timeEntries: ['teamMemberId', 'workedOn', 'minutes', 'taskId', 'projectId', 'billable', 'invoiced', 'notes'],
  allocations: [
    'teamMemberId', 'projectId', 'portfolioProductId', 'weekStarting',
    'plannedMinutes', 'roleOnEngagement', 'billable', 'confidence',
  ],
  absences: ['teamMemberId', 'type', 'startDate', 'endDate', 'workingDays', 'approved'],
  changeRequests: [
    'title', 'projectId', 'requestedById', 'raisedDate', 'description',
    'impactMinutes', 'impactCostCents', 'impactDays', 'status', 'approvedDate', 'upsellDealId',
  ],
  risks: [
    'title', 'projectId', 'category', 'probability', 'impact', 'ownerId',
    'status', 'mitigation', 'raisedDate', 'targetDate', 'resolvedDate',
  ],
}

/** Fields the UI calls one thing and the database calls another. */
const COLUMN_ALIASES: Record<string, string> = {
  portfolioProductId: 'portfolioProductId',
  projectId: 'projectId',
  milestoneId: 'milestoneId',
  sprintId: 'sprintId',
  assigneeId: 'assigneeId',
  reviewerId: 'reviewerId',
  pmId: 'pmId',
  teamMemberId: 'teamMemberId',
  requestedById: 'requestedById',
  signedOffById: 'signedOffById',
  upsellDealId: 'upsellDealId',
  taskId: 'taskId',
  organizationId: 'organizationId',
  ownerId: 'ownerId',
  sourceId: 'sourceId',
  dealId: 'dealId',
  contactId: 'contactId',
  primaryContactId: 'primaryContactId',
}

const cellSchema = z.object({
  table: z.string(),
  id: z.string().min(1),
  field: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
})

export async function updateCell(input: z.infer<typeof cellSchema>): Promise<ActionResult> {
  try {
    await requireMember()
    const parsed = cellSchema.parse(input)
    const config = getTable(parsed.table)
    if (!config) return { ok: false, error: 'Unknown table' }

    const tableId = config.id
    if (!WRITABLE[tableId].includes(parsed.field)) {
      return { ok: false, error: `${parsed.field} is read-only` }
    }

    const field = config.fields.find((f) => f.id === parsed.field)
    if (!field) return { ok: false, error: 'Unknown field' }

    // Validate select values against the configured options rather than trusting
    // the client — a hand-crafted request must not be able to write a bad enum.
    if ((field.type === 'select' || field.type === 'multi') && parsed.value !== null) {
      const ok = field.options?.some((o) => o.value === parsed.value)
      if (!ok) return { ok: false, error: 'Invalid option' }
    }

    let value: unknown = parsed.value
    if (value === '') value = null
    if (field.type === 'number' && typeof value === 'string') value = Number(value)
    if (field.type === 'currency' && typeof value === 'string') value = Math.round(Number(value) * 100)
    // Durations are entered in hours and stored in minutes.
    if (field.type === 'duration' && typeof value === 'string') value = Math.round(Number(value) * 60)
    // Weights are entered as a percentage and stored in basis points.
    if (field.type === 'percent' && typeof value === 'string') value = Math.round(Number(value) * 100)
    if (parsed.field === 'domain' && typeof value === 'string') value = normaliseDomain(value)
    if (field.type === 'date' && typeof value === 'string' && parsed.field === 'occurredAt') {
      value = new Date(value)
    }

    const column = COLUMN_ALIASES[parsed.field] ?? parsed.field
    const drizzleTable = TABLE_TO_DRIZZLE[tableId]

    await db
      .update(drizzleTable)
      .set({ [column]: value } as never)
      .where(eq((drizzleTable as unknown as { id: typeof t.deals.id }).id, parsed.id))

    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    console.error('updateCell failed', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Update failed' }
  }
}

/**
 * The one action that is more than a field write.
 *
 * Moving a deal's stage must always write history — stage-conversion analysis
 * cannot be reconstructed later, so the append happens here rather than in a
 * background job that might not run.
 *
 * Closing a deal won additionally promotes the account. The project and
 * subscription half of the handoff (spec section 6, steps 3–6) lands with the
 * Phase 2 tables; the hook below is where it goes.
 */
const stageSchema = z.object({
  dealId: z.string().min(1),
  toStage: z.enum(t.dealStage.enumValues),
})

export async function moveDealStage(input: z.infer<typeof stageSchema>): Promise<ActionResult> {
  try {
    const { memberId } = await requireMember()
    const { dealId, toStage } = stageSchema.parse(input)

    const deal = await db.query.deals.findFirst({ where: eq(t.deals.id, dealId) })
    if (!deal) return { ok: false, error: 'Deal not found' }
    if (deal.stage === toStage) return { ok: true }

    const closing = toStage === 'ClosedWon' || toStage === 'ClosedLost'
    let handoff: string | null = null

    await db.transaction(async (tx) => {
      await tx
        .update(t.deals)
        .set({
          stage: toStage,
          stageEnteredAt: new Date(),
          updatedAt: new Date(),
          actualCloseDate: closing ? toISODate() : null,
          forecast: toStage === 'ClosedWon' ? 'ClosedWon' : toStage === 'ClosedLost' ? 'ClosedLost' : deal.forecast,
        })
        .where(eq(t.deals.id, dealId))

      await tx.insert(t.dealStageHistory).values({
        dealId,
        fromStage: deal.stage,
        toStage,
        daysInPreviousStage: daysBetween(deal.stageEnteredAt),
        changedById: memberId,
      })

      if (toStage === 'ClosedWon') {
        // Step 2 of the handoff: promote the account.
        const org = await tx.query.organizations.findFirst({
          where: eq(t.organizations.id, deal.organizationId),
        })
        if (org) {
          await tx
            .update(t.organizations)
            .set({
              lifecycle: 'Customer',
              types: org.types.includes('Customer') ? org.types : [...org.types, 'Customer'],
              updatedAt: new Date(),
            })
            .where(eq(t.organizations.id, org.id))
        }

        // Steps 5 and 6: spawn the delivery project and its milestone set.
        handoff = await spawnProjectForDeal(tx, deal.id)
      }
    })

    revalidatePath('/', 'layout')
    return { ok: true, detail: handoff ?? undefined }
  } catch (error) {
    console.error('moveDealStage failed', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Stage change failed' }
  }
}

/* ------------------------------------------------------------- the handoff */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Deal types that imply delivery work. A pure subscription sale does not. */
const DELIVERY_DEAL_TYPES = ['Project', 'Hybrid', 'Retainer']

/**
 * Creates the delivery project for a won deal, plus the standard milestone set.
 *
 * Idempotent by design: a single accidental stage toggle must not spawn a
 * second project. Duplicate projects quietly corrupt every capacity and margin
 * report downstream, and nobody notices for a month.
 *
 * Returns a short human-readable summary, or null when nothing was created.
 */
async function spawnProjectForDeal(tx: Tx, dealId: string): Promise<string | null> {
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

  return `${project.name} created with ${MILESTONE_TEMPLATE.length} milestones`
}

/**
 * Run the handoff by hand. Needed for deals that closed before Phase 2 existed,
 * and for the case where someone deleted the project and wants it back.
 */
export async function runHandoff(dealId: string): Promise<ActionResult> {
  try {
    await requireMember()
    let detail: string | null = null
    await db.transaction(async (tx) => {
      detail = await spawnProjectForDeal(tx, dealId)
    })
    revalidatePath('/', 'layout')
    return detail
      ? { ok: true, detail }
      : { ok: false, error: 'Nothing to create — the deal already has a project, or it sells no delivery work.' }
  } catch (error) {
    console.error('runHandoff failed', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Handoff failed' }
  }
}

/**
 * Task status changes stamp the timestamps that cycle time is computed from.
 * A plain field write would leave them null and quietly make every cycle-time
 * figure meaningless.
 */
const taskStatusSchema = z.object({
  taskId: z.string().min(1),
  toStatus: z.enum(t.taskStatus.enumValues),
})

export async function moveTaskStatus(input: z.infer<typeof taskStatusSchema>): Promise<ActionResult> {
  try {
    await requireMember()
    const { taskId, toStatus } = taskStatusSchema.parse(input)

    const task = await db.query.tasks.findFirst({ where: eq(t.tasks.id, taskId) })
    if (!task) return { ok: false, error: 'Task not found' }
    if (task.status === toStatus) return { ok: true }

    const now = new Date()
    const leftBacklog = toStatus !== 'Backlog' && toStatus !== 'Ready'
    const isDone = toStatus === 'Done'

    await db
      .update(t.tasks)
      .set({
        status: toStatus,
        // Stamp the first time it starts moving, and never overwrite it —
        // a task bounced back from review has not restarted its clock.
        inProgressAt: task.inProgressAt ?? (leftBacklog ? now : null),
        completedAt: isDone ? (task.completedAt ?? now) : null,
        // Reaching Done resolves whatever was blocking it.
        blocked: isDone ? false : task.blocked,
        updatedAt: now,
      })
      .where(eq(t.tasks.id, taskId))

    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    console.error('moveTaskStatus failed', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Status change failed' }
  }
}

/**
 * Logging time. Rates are snapshotted from the member at entry time so a raise
 * next year does not silently restate this year's project margin.
 */
const timeSchema = z.object({
  teamMemberId: z.string().min(1),
  projectId: z.string().min(1),
  taskId: z.string().nullable().optional(),
  workedOn: z.string().min(8),
  hours: z.number().positive().max(24),
  billable: z.boolean().default(true),
  notes: z.string().nullable().optional(),
})

export async function logTime(input: z.infer<typeof timeSchema>): Promise<ActionResult> {
  try {
    await requireMember()
    const data = timeSchema.parse(input)
    const member = await db.query.teamMembers.findFirst({
      where: eq(t.teamMembers.id, data.teamMemberId),
    })
    if (!member) return { ok: false, error: 'Team member not found' }

    await db.insert(t.timeEntries).values({
      teamMemberId: data.teamMemberId,
      projectId: data.projectId,
      taskId: data.taskId ?? null,
      workedOn: data.workedOn,
      minutes: Math.round(data.hours * 60),
      billable: data.billable,
      costRateCents: member.costRateCents ?? 0,
      billRateCents: member.billRateCents ?? 0,
      notes: data.notes ?? null,
    })

    revalidatePath('/', 'layout')
    return { ok: true, detail: `${data.hours} h logged` }
  } catch (error) {
    console.error('logTime failed', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Could not log time' }
  }
}

/* ------------------------------------------------------------ creation ---- */

const newDealSchema = z.object({
  name: z.string().min(2),
  organizationId: z.string().min(1),
  ownerId: z.string().min(1).nullable().optional(),
  type: z.enum(t.dealType.enumValues).default('Subscription'),
  expectedCloseDate: z.string().nullable().optional(),
})

export async function createDeal(input: z.infer<typeof newDealSchema>): Promise<ActionResult> {
  try {
    const { memberId } = await requireMember()
    const data = newDealSchema.parse(input)
    const [deal] = await db
      .insert(t.deals)
      .values({
        name: data.name,
        organizationId: data.organizationId,
        ownerId: data.ownerId ?? memberId,
        type: data.type,
        expectedCloseDate: data.expectedCloseDate ?? null,
      })
      .returning({ id: t.deals.id })

    await db.insert(t.dealStageHistory).values({
      dealId: deal.id,
      fromStage: null,
      toStage: 'Qualifying',
      changedById: memberId,
    })

    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    console.error('createDeal failed', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Could not create deal' }
  }
}

const newOrgSchema = z.object({
  name: z.string().min(2),
  domain: z.string().min(3),
  ownerId: z.string().nullable().optional(),
})

export async function createOrganization(input: z.infer<typeof newOrgSchema>): Promise<ActionResult> {
  try {
    const { memberId } = await requireMember()
    const data = newOrgSchema.parse(input)
    const domain = normaliseDomain(data.domain)

    const existing = await db.query.organizations.findFirst({
      where: eq(t.organizations.domain, domain),
    })
    if (existing) return { ok: false, error: `${existing.name} already uses ${domain}` }

    await db.insert(t.organizations).values({
      name: data.name,
      domain,
      ownerId: data.ownerId ?? memberId,
    })
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    console.error('createOrganization failed', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Could not create company' }
  }
}

export async function deleteRecord(table: TableId, id: string): Promise<ActionResult> {
  try {
    await requireMember()
    const drizzleTable = TABLE_TO_DRIZZLE[table]
    if (!drizzleTable) return { ok: false, error: 'Unknown table' }
    await db.delete(drizzleTable).where(eq((drizzleTable as unknown as { id: typeof t.deals.id }).id, id))
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    console.error('deleteRecord failed', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Delete failed' }
  }
}
