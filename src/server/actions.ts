'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import * as t from '@/db/schema'
import { auth } from '@/auth'
import {
  CREATE_SPEC, ROCK_QUARTER_PATTERN, TARGET_METRIC_UNIT, TARGET_PERIOD_PATTERN, getTable,
} from '@/lib/tables'
import { canDelete, canWrite, refusal } from '@/lib/permissions'
// Not defined here because 'use server' allows only async exports, which would
// put this list beyond the reach of any test. See writable.ts.
import { WRITABLE } from '@/lib/writable'
import { ASSIGNMENT_FIELDS, assignmentPhrase } from '@/lib/assignments'
import { notifyAssignment } from './notify'
import { daysBetween, normaliseDomain, toISODate } from '@/lib/format'
import { invoiceState, mondayOf, nextInvoiceNumber, nextRenewalDate, quarterEndDate } from './compute'
// Not defined here on purpose: 'use server' would publish it as an endpoint, and
// it has to be callable from a test with no session. See handoff.ts.
import { spawnProjectForDeal, type HandoffResult } from './handoff'
import type { ActionResult, TableId } from '@/lib/types'

/** Every action goes through this. No session, no write. */
async function requireMember() {
  const session = await auth()
  if (!session?.user) throw new Error('Not signed in')
  return {
    userId: session.user.id,
    memberId: session.user.memberId,
    role: session.user.role,
    email: session.user.email,
  }
}

/**
 * The authorization gate.
 *
 * Server-side and non-negotiable: the UI also hides what you cannot do, but that
 * is a courtesy. This is the check that matters, because a hand-crafted request
 * never goes near the components.
 */
async function requirePermission(table: TableId, action: 'edit' | 'delete') {
  const member = await requireMember()
  const allowed = action === 'delete' ? canDelete(member.role, table) : canWrite(member.role, table)
  if (!allowed) throw new PermissionError(refusal(action, table))
  return member
}

/** Distinguishes "you may not" from "something broke", which are reported differently. */
class PermissionError extends Error {}

type Actor = Awaited<ReturnType<typeof requireMember>>

/**
 * Append to the audit log. Never throws: losing an audit row is bad, but failing
 * the user's actual write because the logging failed is worse, and the write has
 * already happened by the time this runs.
 */
async function recordAudit(
  actor: Actor,
  action: 'delete' | 'update' | 'create',
  tableId: TableId,
  rows: Record<string, unknown>[],
) {
  if (rows.length === 0) return
  try {
    await db.insert(t.auditLog).values(
      rows.map((row) => ({
        actorMemberId: actor.memberId,
        actorEmail: actor.email,
        action,
        tableId,
        rowId: String(row.id ?? ''),
        before: action === 'create' ? null : row,
        after: action === 'create' ? row : null,
      })),
    )
  } catch (error) {
    console.error('audit write failed', { action, tableId, error })
  }
}

/**
 * The single failure path for every action.
 *
 * A permission refusal is the user's business and is returned verbatim.
 * Everything else is logged in full server-side and reported generically —
 * a database error message in a toast tells the user nothing and tells anyone
 * else the column names.
 */
function failure(where: string, error: unknown, fallback: string, table?: TableId): ActionResult {
  if (error instanceof PermissionError) return { ok: false, error: error.message }
  console.error(`${where} failed`, error)
  return { ok: false, error: duplicateMessage(error, table) ?? fallback }
}

const UNIQUE_CONSTRAINT = /unique constraint "([^"]+)"/

/**
 * Nouns for the columns people actually collide on.
 *
 * The field label reads badly in a sentence: products call their name column
 * "Product", so the label alone would produce "a product with this product".
 */
const DUPLICATE_NOUN: Record<string, string> = {
  name: 'name',
  email: 'email address',
  domain: 'domain',
  slug: 'slug',
  number: 'number',
  period: 'period',
}

/**
 * Turn a unique-constraint violation into something a person can act on.
 *
 * Left alone, the whole class arrives as "Could not create the record" — which
 * names no field, suggests nothing to change, and looks exactly like a bug in
 * whatever the person happened to touch last. The real cause was in the server
 * log all along, which is no help to the person staring at the form.
 *
 * Only the constraint's own column is revealed, which the form already showed.
 */
function duplicateMessage(error: unknown, table?: TableId): string | null {
  if (!table) return null

  // Drizzle wraps the driver error, so the constraint name is on the cause.
  let text = ''
  let current: unknown = error
  for (let depth = 0; current && depth < 4; depth += 1) {
    if (current instanceof Error) text += ` ${current.message}`
    current = (current as { cause?: unknown }).cause
  }

  const constraint = text.match(UNIQUE_CONSTRAINT)?.[1]
  if (!constraint) return null

  const config = getTable(table)
  if (!config) return null

  // Constraints are named after their column. The longest field id appearing in
  // the name is the one that collided — longest because a short id can be a
  // substring of a longer one.
  const field = config.fields
    .filter((f) => constraint.includes(f.id.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)))
    .sort((a, b) => b.id.length - a.id.length)[0]
  if (!field) return null

  const noun = DUPLICATE_NOUN[field.id] ?? field.label.toLowerCase()
  return `A ${config.singular} with this ${noun} already exists.`
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
  subscriptions: t.subscriptions,
  invoices: t.invoices,
  payments: t.payments,
  audit: t.auditLog,
  /** A client *is* an organization; edits from the Clients grid go to that row. */
  clients: t.organizations,
  meetings: t.meetings,
  rocks: t.rocks,
  measurables: t.measurables,
  scorecardEntries: t.scorecardEntries,
  todos: t.eosTodos,
  issues: t.eosIssues,
} as const


/**
 * Writable fields whose column is a `timestamp`, not a `date`.
 *
 * Verified against the schema: `occurredAt` is currently the only one. Keep this
 * in step if another timestamp column is ever added to WRITABLE — see the note
 * in prepareCellWrite for what goes wrong otherwise.
 */
const TIMESTAMP_FIELDS = new Set(['occurredAt'])

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

/** The id column, past the fact that TABLE_TO_DRIZZLE is a union of table types. */
const idOf = (table: (typeof TABLE_TO_DRIZZLE)[TableId]) =>
  (table as unknown as { id: typeof t.deals.id }).id

/**
 * Check a field is writable and coerce the incoming value into what the column
 * actually stores. Shared by the single-cell and bulk writes so there is one
 * definition of "allowed" and one of "cents, minutes, basis points" — two copies
 * would drift and the bulk path would quietly become the lenient one.
 */
type PreparedWrite =
  | { ok: true; tableId: TableId; column: string; value: unknown }
  | { ok: false; error: string }

function prepareCellWrite(
  table: string,
  fieldId: string,
  raw: string | number | boolean | null,
): PreparedWrite {
  const config = getTable(table)
  if (!config) return { ok: false, error: 'Unknown table' }

  const tableId = config.id
  if (!WRITABLE[tableId].includes(fieldId)) {
    return { ok: false, error: `${fieldId} is read-only` }
  }

  const field = config.fields.find((f) => f.id === fieldId)
  if (!field) return { ok: false, error: 'Unknown field' }

  // Validate select values against the configured options rather than trusting
  // the client — a hand-crafted request must not be able to write a bad enum.
  if ((field.type === 'select' || field.type === 'multi') && raw !== null) {
    const known = field.options?.some((o) => o.value === raw)
    if (!known) return { ok: false, error: 'Invalid option' }
  }

  let value: unknown = raw
  if (value === '') value = null
  if (field.type === 'number' && typeof value === 'string') value = Number(value)
  if (field.type === 'currency' && typeof value === 'string') value = Math.round(Number(value) * 100)
  // Durations are entered in hours and stored in minutes.
  if (field.type === 'duration' && typeof value === 'string') value = Math.round(Number(value) * 60)
  // Weights are entered as a percentage and stored in basis points.
  if (field.type === 'percent' && typeof value === 'string') value = Math.round(Number(value) * 100)
  if (fieldId === 'domain' && typeof value === 'string') value = normaliseDomain(value)
  /**
   * A `date` field may sit on a `date` column or a `timestamp` one, and Drizzle
   * treats them differently: a date column takes the ISO string as-is, a
   * timestamp column expects a JS Date and calls `.toISOString()` on whatever it
   * is given. Hand it a string and it throws `value.toISOString is not a
   * function` — from inside the driver, with a stack that names none of this.
   *
   * Listed explicitly rather than inferred, so adding a writable timestamp means
   * adding it here and not discovering the same error again.
   */
  if (field.type === 'date' && typeof value === 'string' && TIMESTAMP_FIELDS.has(fieldId)) {
    value = new Date(value)
  }

  return { ok: true, tableId, column: COLUMN_ALIASES[fieldId] ?? fieldId, value }
}

export async function updateCell(input: z.infer<typeof cellSchema>): Promise<ActionResult> {
  try {
    const parsed = cellSchema.parse(input)

    const prepared = prepareCellWrite(parsed.table, parsed.field, parsed.value)
    if (!prepared.ok) return prepared
    const member = await requirePermission(prepared.tableId, 'edit')

    const drizzleTable = TABLE_TO_DRIZZLE[prepared.tableId]
    await db
      .update(drizzleTable)
      .set({ [prepared.column]: prepared.value } as never)
      .where(eq(idOf(drizzleTable), parsed.id))

    // Handing work to somebody sends them an email. After the commit, never
    // instead of it: the row fetch rides as a thunk so it runs inside
    // notifyAssignment's own never-throw try — a pooler blip while fetching
    // the label must not report a committed write as failed.
    if (typeof prepared.value === 'string' && prepared.value && assignmentPhrase(prepared.tableId, parsed.field)) {
      await notifyAssignment({
        actorMemberId: member.memberId, actorEmail: member.email,
        table: prepared.tableId, field: parsed.field, assigneeMemberId: prepared.value,
        rows: async () =>
          (await db.select().from(drizzleTable).where(eq(idOf(drizzleTable), parsed.id))) as Record<string, unknown>[],
      })
    }

    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    // input rather than parsed: the parsed value is scoped to the try block.
    return failure('updateCell', error, 'Update failed', getTable(input.table)?.id)
  }
}

/* ------------------------------------------------------------ bulk actions */

/**
 * Ceiling on one bulk request. Retyping a field across a screenful of rows is a
 * normal thing to want; rewriting the whole table from one click is not, and an
 * unbounded IN list is a good way to discover your statement timeout.
 */
const BULK_LIMIT = 200

const bulkCellSchema = z.object({
  table: z.string(),
  ids: z.array(z.string().min(1)).min(1).max(BULK_LIMIT),
  field: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
})

/**
 * Set one field across many rows in a single statement.
 *
 * Deal stage and task status are refused here on purpose. Both carry side
 * effects — stage history, the Closed Won handoff — and a bulk UPDATE would skip
 * every one of them without saying so, which is exactly the silent corruption
 * the handoff's idempotency guard exists to prevent. The client walks those
 * through moveDealStage/moveTaskStatus one row at a time instead.
 */
export async function bulkUpdateCell(input: z.infer<typeof bulkCellSchema>): Promise<ActionResult> {
  try {
    const parsed = bulkCellSchema.parse(input)

    const hasSideEffects =
      (parsed.table === 'deals' && parsed.field === 'stage') ||
      (parsed.table === 'tasks' && parsed.field === 'status')
    if (hasSideEffects) {
      return { ok: false, error: 'Stage moves are applied one at a time so history is written' }
    }

    const prepared = prepareCellWrite(parsed.table, parsed.field, parsed.value)
    if (!prepared.ok) return prepared
    const member = await requirePermission(prepared.tableId, 'edit')

    const drizzleTable = TABLE_TO_DRIZZLE[prepared.tableId]
    await db
      .update(drizzleTable)
      .set({ [prepared.column]: prepared.value } as never)
      .where(inArray(idOf(drizzleTable), parsed.ids))

    // A bulk hand-over is one email naming the batch, not one per row. The
    // fetch rides as a thunk for the same reason as updateCell's.
    if (typeof prepared.value === 'string' && prepared.value && assignmentPhrase(prepared.tableId, parsed.field)) {
      await notifyAssignment({
        actorMemberId: member.memberId, actorEmail: member.email,
        table: prepared.tableId, field: parsed.field, assigneeMemberId: prepared.value,
        rows: async () =>
          (await db.select().from(drizzleTable).where(inArray(idOf(drizzleTable), parsed.ids))) as Record<string, unknown>[],
      })
    }

    revalidatePath('/', 'layout')
    const n = parsed.ids.length
    return { ok: true, detail: `${n} ${n === 1 ? 'record' : 'records'} updated` }
  } catch (error) {
    return failure('bulkUpdateCell', error, 'Bulk update failed', getTable(input.table)?.id)
  }
}

const bulkDeleteSchema = z.object({
  table: z.string(),
  ids: z.array(z.string().min(1)).min(1).max(BULK_LIMIT),
})

export async function bulkDelete(input: z.infer<typeof bulkDeleteSchema>): Promise<ActionResult> {
  try {
    const parsed = bulkDeleteSchema.parse(input)

    const config = getTable(parsed.table)
    if (!config) return { ok: false, error: 'Unknown table' }
    const member = await requirePermission(config.id, 'delete')

    const drizzleTable = TABLE_TO_DRIZZLE[config.id]
    // Read before deleting: once the rows are gone the audit entry cannot be
    // reconstructed, which would make the log a list of regrets rather than a
    // recovery path.
    const doomed = await db.select().from(drizzleTable).where(inArray(idOf(drizzleTable), parsed.ids))
    await db.delete(drizzleTable).where(inArray(idOf(drizzleTable), parsed.ids))
    await recordAudit(member, 'delete', config.id, doomed)

    revalidatePath('/', 'layout')
    const n = parsed.ids.length
    return { ok: true, detail: `${n} ${n === 1 ? config.singular : `${config.singular}s`} deleted` }
  } catch (error) {
    return failure('bulkDelete', error, 'Bulk delete failed')
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
    const { memberId } = await requirePermission('deals', 'edit')
    const { dealId, toStage } = stageSchema.parse(input)

    const deal = await db.query.deals.findFirst({ where: eq(t.deals.id, dealId) })
    if (!deal) return { ok: false, error: 'Deal not found' }
    if (deal.stage === toStage) return { ok: true }

    const closing = toStage === 'ClosedWon' || toStage === 'ClosedLost'
    let handoff: HandoffResult | null = null

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

    // Read through a local: the assignment happened inside the transaction
    // callback, which TypeScript's narrowing cannot see.
    const made = handoff as HandoffResult | null

    // After the transaction, never inside it: an email is not worth a rollback,
    // and a rollback must not have already sent an email.
    if (made?.pmId && made.pmId !== memberId) {
      await notifyAssignment({
        actorMemberId: memberId, actorEmail: null,
        table: 'projects', field: 'pmId', assigneeMemberId: made.pmId,
        rows: [{ id: made.projectId, name: made.projectName }],
      })
    }

    revalidatePath('/', 'layout')
    return { ok: true, detail: made?.message }
  } catch (error) {
    return failure('moveDealStage', error, 'Stage change failed')
  }
}

/* ------------------------------------------------------------- the handoff */

/**
 * Run the handoff by hand. Needed for deals that closed before Phase 2 existed,
 * and for the case where someone deleted the project and wants it back.
 */
export async function runHandoff(dealId: string): Promise<ActionResult> {
  try {
    const { memberId } = await requirePermission('deals', 'edit')
    let handoff: HandoffResult | null = null
    await db.transaction(async (tx) => {
      handoff = await spawnProjectForDeal(tx, dealId)
    })
    // Read through a local: the closure assignment defeats TS narrowing.
    const made = handoff as HandoffResult | null
    if (!made) {
      return { ok: false, error: 'Nothing to create — the deal already has a project, or it sells no delivery work.' }
    }
    if (made.pmId && made.pmId !== memberId) {
      await notifyAssignment({
        actorMemberId: memberId, actorEmail: null,
        table: 'projects', field: 'pmId', assigneeMemberId: made.pmId,
        rows: [{ id: made.projectId, name: made.projectName }],
      })
    }
    revalidatePath('/', 'layout')
    return { ok: true, detail: made.message }
  } catch (error) {
    return failure('runHandoff', error, 'Handoff failed')
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
    await requirePermission('tasks', 'edit')
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
    return failure('moveTaskStatus', error, 'Status change failed')
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
    await requirePermission('timeEntries', 'edit')
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
    return failure('logTime', error, 'Could not log time')
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
    const { memberId } = await requirePermission('deals', 'edit')
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
      .returning({ id: t.deals.id, name: t.deals.name, ownerId: t.deals.ownerId })

    await db.insert(t.dealStageHistory).values({
      dealId: deal.id,
      fromStage: null,
      toStage: 'Qualifying',
      changedById: memberId,
    })

    if (deal.ownerId && deal.ownerId !== memberId) {
      await notifyAssignment({
        actorMemberId: memberId, actorEmail: null,
        table: 'deals', field: 'ownerId', assigneeMemberId: deal.ownerId,
        rows: [deal as unknown as Record<string, unknown>],
      })
    }

    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return failure('createDeal', error, 'Could not create deal')
  }
}

const newOrgSchema = z.object({
  name: z.string().min(2),
  domain: z.string().min(3),
  ownerId: z.string().nullable().optional(),
})

export async function createOrganization(input: z.infer<typeof newOrgSchema>): Promise<ActionResult> {
  try {
    const { memberId } = await requirePermission('organizations', 'edit')
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
    return failure('createOrganization', error, 'Could not create company')
  }
}

export async function deleteRecord(table: TableId, id: string): Promise<ActionResult> {
  try {
    const drizzleTable = TABLE_TO_DRIZZLE[table]
    if (!drizzleTable) return { ok: false, error: 'Unknown table' }
    const member = await requirePermission(table, 'delete')

    const doomed = await db.select().from(drizzleTable).where(eq(idOf(drizzleTable), id))
    await db.delete(drizzleTable).where(eq(idOf(drizzleTable), id))
    await recordAudit(member, 'delete', table, doomed)

    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return failure('deleteRecord', error, 'Delete failed')
  }
}

/* --------------------------------------------------------------- team members */

const newMemberSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  role: z.string(),
  department: z.string(),
  weeklyCapacityHours: z.number().int().min(0).max(80),
})

export type NewMemberInput = z.infer<typeof newMemberSchema>

/**
 * Add a team member.
 *
 * This is the invite: sign-in is invite-only and the callback in auth.ts admits
 * any address that exists in this table, so creating a row here is what grants
 * access. The form says so in as many words — it is not the kind of side effect
 * that should be discovered later.
 *
 * The email is lower-cased before it is stored because every lookup that matters
 * — the sign-in check and the session callback — lower-cases the incoming
 * address before comparing. A row saved as `Anna@Studio.com` would sit there
 * looking correct and refuse her every time she tried to sign in.
 */
export async function createTeamMember(input: NewMemberInput): Promise<ActionResult> {
  try {
    await requirePermission('team', 'edit')
    const data = newMemberSchema.parse(input)
    const email = data.email.toLowerCase()

    const config = getTable('team')
    for (const fieldId of ['role', 'department'] as const) {
      const options = config?.fields.find((f) => f.id === fieldId)?.options ?? []
      if (!options.some((o) => o.value === data[fieldId])) {
        return { ok: false, error: `${data[fieldId]} is not a valid ${fieldId}` }
      }
    }

    // Checked explicitly rather than left to the unique constraint, so the
    // message names who already holds the address.
    const existing = await db.query.teamMembers.findFirst({
      where: eq(t.teamMembers.email, email),
    })
    if (existing) {
      return { ok: false, error: `${existing.name} already uses ${email}` }
    }

    await db.insert(t.teamMembers).values({
      name: data.name,
      email,
      role: data.role as never,
      department: data.department as never,
      weeklyCapacityHours: data.weeklyCapacityHours,
    })

    revalidatePath('/', 'layout')
    return { ok: true, detail: `${data.name} can now sign in with ${email}` }
  } catch (error) {
    return failure('createTeamMember', error, 'Could not add member')
  }
}

/* -------------------------------------------------------------------- targets */

const newTargetSchema = z.object({
  period: z.string().trim(),
  metric: z.string(),
  scope: z.string(),
  teamMemberId: z.string().nullable().optional(),
  /** Entered in natural units — euros, percent, or a plain count. */
  amount: z.number().finite(),
})

export type NewTargetInput = z.infer<typeof newTargetSchema>

/**
 * Create a target.
 *
 * Two things make this more than an insert. The `value` column's unit depends on
 * the metric, so the form asks for euros or percent and the conversion happens
 * here rather than trusting the client to have multiplied by 100.
 *
 * And the duplicate check is done explicitly rather than left to the table's
 * unique index. That index covers (period, metric, scope, team_member_id), but
 * Postgres treats NULLs as distinct in a unique index — so it never actually
 * blocked two identical *company* targets, whose member is NULL. Coverage would
 * then double-count against the quarter and read as healthy when it is not.
 */
const newMeasurableSchema = z.object({
  name: z.string().trim().min(1),
  unit: z.string(),
  direction: z.string(),
  ownerId: z.string().nullable().optional(),
  /** Entered in natural units — euros, percent, or a plain count. */
  goal: z.number().finite(),
})

export type NewMeasurableInput = z.infer<typeof newMeasurableSchema>

/**
 * Bespoke for the same reason targets are: the goal's unit depends on the unit
 * field beside it, which a static field list cannot express. The conversion is
 * createTarget's exact arithmetic, so €12,000 and 75% mean what was typed.
 */
export async function createMeasurable(input: NewMeasurableInput): Promise<ActionResult> {
  try {
    const member = await requirePermission('measurables', 'edit')
    const data = newMeasurableSchema.parse(input)

    const config = getTable('measurables')
    for (const fieldId of ['unit', 'direction'] as const) {
      const options = config?.fields.find((f) => f.id === fieldId)?.options ?? []
      if (!options.some((o) => o.value === data[fieldId])) {
        return { ok: false, error: `${data[fieldId]} is not a valid ${fieldId}` }
      }
    }

    if (data.goal < 0) return { ok: false, error: 'A goal cannot be negative' }
    if (data.unit === 'Percent' && data.goal > 100) {
      return { ok: false, error: 'A percentage goal cannot exceed 100' }
    }

    const goalValue =
      data.unit === 'Money' || data.unit === 'Percent'
        ? Math.round(data.goal * 100)
        : Math.round(data.goal)

    // Checked ahead of the unique constraint for the friendlier sentence.
    const existing = await db.query.measurables.findFirst({ where: eq(t.measurables.name, data.name) })
    if (existing) return { ok: false, error: `A measurable called ${data.name} already exists` }

    // New rows join the end of the scorecard rather than colliding at zero.
    const last = await db.query.measurables.findMany({
      columns: { sequence: true }, orderBy: [desc(t.measurables.sequence)], limit: 1,
    })

    const [created] = await db.insert(t.measurables).values({
      name: data.name,
      unit: data.unit as never,
      direction: data.direction as never,
      ownerId: data.ownerId ?? null,
      goalValue,
      sequence: (last[0]?.sequence ?? 0) + 1,
    }).returning()

    await recordAudit(member, 'create', 'measurables', [created as Record<string, unknown>])
    revalidatePath('/', 'layout')
    return { ok: true, detail: `${data.name} added to the scorecard` }
  } catch (error) {
    return failure('createMeasurable', error, 'Could not create the measurable', 'measurables')
  }
}

export async function createTarget(input: NewTargetInput): Promise<ActionResult> {
  try {
    await requirePermission('targets', 'edit')
    const data = newTargetSchema.parse(input)

    if (!TARGET_PERIOD_PATTERN.test(data.period)) {
      return { ok: false, error: 'Period must look like 2026-Q3 or 2026-07' }
    }

    const config = getTable('targets')
    for (const fieldId of ['metric', 'scope'] as const) {
      const options = config?.fields.find((f) => f.id === fieldId)?.options ?? []
      if (!options.some((o) => o.value === data[fieldId])) {
        return { ok: false, error: `${data[fieldId]} is not a valid ${fieldId}` }
      }
    }

    // An individual target without a person is unattributable; a company target
    // with one is a contradiction. Normalising here keeps the duplicate check
    // below meaningful.
    const memberId = data.scope === 'Individual' ? (data.teamMemberId ?? null) : null
    if (data.scope === 'Individual' && !memberId) {
      return { ok: false, error: 'An individual target needs a team member' }
    }

    const unit = TARGET_METRIC_UNIT[data.metric] ?? 'count'
    if (data.amount < 0) return { ok: false, error: 'A target cannot be negative' }
    if (unit === 'percent' && data.amount > 100) {
      return { ok: false, error: 'A percentage target cannot exceed 100' }
    }

    // Money becomes cents and percentages become basis points — the same
    // arithmetic, two different meanings.
    const value =
      unit === 'money' || unit === 'percent'
        ? Math.round(data.amount * 100)
        : Math.round(data.amount)

    const existing = await db.query.targets.findFirst({
      where: and(
        eq(t.targets.period, data.period),
        eq(t.targets.metric, data.metric as never),
        eq(t.targets.scope, data.scope as never),
        memberId ? eq(t.targets.teamMemberId, memberId) : isNull(t.targets.teamMemberId),
      ),
    })
    if (existing) {
      return { ok: false, error: `A ${data.scope} target for ${data.metric} in ${data.period} already exists` }
    }

    await db.insert(t.targets).values({
      period: data.period,
      metric: data.metric as never,
      scope: data.scope as never,
      value,
      teamMemberId: memberId,
    })

    revalidatePath('/', 'layout')
    return { ok: true, detail: `Target set for ${data.period}` }
  } catch (error) {
    return failure('createTarget', error, 'Could not create target')
  }
}

/* ------------------------------------------------------------ generic create */

const createSchema = z.object({
  table: z.string(),
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
})

/**
 * Create a row in any table the config declares creatable.
 *
 * Coercion goes through the same prepareCellWrite the grid uses, so euros become
 * cents and hours become minutes by one definition rather than two. What this
 * function adds on top are the invariants a field list cannot express — see
 * `applyCreateRules`. Those run server-side because they are the difference
 * between a record that is merely accepted and one that is correct.
 */
export async function createRecord(input: z.infer<typeof createSchema>): Promise<ActionResult> {
  try {
    const parsed = createSchema.parse(input)
    const config = getTable(parsed.table)
    if (!config) return { ok: false, error: 'Unknown table' }

    const spec = CREATE_SPEC[config.id]
    if (!spec) return { ok: false, error: `${config.name} cannot be created from here` }

    const member = await requirePermission(config.id, 'edit')

    for (const field of spec.required) {
      const value = parsed.values[field]
      if (value === undefined || value === null || value === '') {
        const label = config.fields.find((f) => f.id === field)?.label ?? field
        return { ok: false, error: `${label} is required` }
      }
    }

    // Coerce each supplied value exactly as an inline edit would.
    const row: Record<string, unknown> = {}
    for (const [field, raw] of Object.entries(parsed.values)) {
      if (raw === '' || raw === undefined) continue
      const prepared = prepareCellWrite(parsed.table, field, raw)
      if (!prepared.ok) return prepared
      row[prepared.column] = prepared.value
    }

    const ruled = await applyCreateRules(config.id, row, member)
    if (!ruled.ok) return ruled

    const drizzleTable = TABLE_TO_DRIZZLE[config.id]
    const [created] = await db.insert(drizzleTable).values(ruled.row as never).returning()

    await recordAudit(member, 'create', config.id, [created as Record<string, unknown>])

    // A record born assigned to somebody else emails them — the quick-add in a
    // meeting is exactly "you, by Friday", and Friday should not be a surprise.
    for (const field of Object.keys(ASSIGNMENT_FIELDS[config.id] ?? {})) {
      const assignee = (created as Record<string, unknown>)[field]
      if (typeof assignee === 'string' && assignee) {
        await notifyAssignment({
          actorMemberId: member.memberId, actorEmail: member.email,
          table: config.id, field, assigneeMemberId: assignee,
          rows: [created as Record<string, unknown>],
        })
      }
    }

    revalidatePath('/', 'layout')

    return {
      ok: true,
      detail: `${humanLabel(created as Record<string, unknown>, config.singular)} created${ruled.note ? ` — ${ruled.note}` : ''}`,
    }
  } catch (error) {
    return failure('createRecord', error, 'Could not create the record', getTable(input.table)?.id)
  }
}

/**
 * Something a person will recognise in the toast.
 *
 * Not the config's first field: on a subscription that is the client *id*, so
 * the confirmation read "5fa0d478-b144-… created". Falls back to the table's
 * singular rather than showing a UUID.
 */
function humanLabel(row: Record<string, unknown>, singular: string): string {
  for (const key of ['name', 'title', 'subject', 'number', 'period', 'email', 'slug']) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return `A ${singular}`
}

type RuleResult =
  | { ok: true; row: Record<string, unknown>; note?: string }
  | { ok: false; error: string }

/**
 * The per-table rules. Everything here exists because getting it wrong produces
 * a row that looks fine and reports wrongly.
 */
async function applyCreateRules(
  table: TableId,
  row: Record<string, unknown>,
  member: Actor,
): Promise<RuleResult> {
  const str = (key: string) => (typeof row[key] === 'string' ? (row[key] as string) : null)
  const num = (key: string) => (typeof row[key] === 'number' ? (row[key] as number) : null)

  const endAfterStart = (startKey: string, endKey: string, what: string): string | null => {
    const start = str(startKey)
    const end = str(endKey)
    return start && end && end < start ? `${what} cannot end before it starts` : null
  }

  switch (table) {
    case 'clients': {
      // A client is an organization that has reached Customer. Creating one here
      // sets that, otherwise it would not appear in the list it was created from.
      const domain = str('domain')
      if (!domain) return { ok: false, error: 'Domain is required' }
      const normalised = normaliseDomain(domain)
      const clash = await db.query.organizations.findFirst({ where: eq(t.organizations.domain, normalised) })
      if (clash) return { ok: false, error: `${clash.name} already uses ${normalised}` }
      return {
        ok: true,
        row: { ...row, domain: normalised, lifecycle: 'Customer', types: ['Customer'], ownerId: row.ownerId ?? member.memberId },
      }
    }

    case 'subscriptions': {
      const startDate = str('startDate')
      const termMonths = num('termMonths') ?? 12
      if (!startDate) return { ok: false, error: 'Start date is required' }
      // Derived, never asked for: renewsOn is start + term, and it moves on renewal.
      const renewsOn = nextRenewalDate(startDate, termMonths)
      return { ok: true, row: { ...row, termMonths, renewsOn }, note: `renews ${renewsOn}` }
    }

    case 'timeEntries': {
      const memberId = str('teamMemberId')
      if (!memberId) return { ok: false, error: 'Team member is required' }
      const person = await db.query.teamMembers.findFirst({
        where: eq(t.teamMembers.id, memberId),
        columns: { costRateCents: true, billRateCents: true },
      })
      if (!person) return { ok: false, error: 'Unknown team member' }
      // Snapshotted deliberately. Looking these up live would restate last
      // year's margin the day somebody gets a raise.
      return {
        ok: true,
        row: { ...row, costRateCents: person.costRateCents ?? 0, billRateCents: person.billRateCents ?? 0 },
      }
    }

    case 'milestones': {
      const projectId = str('projectId')
      const weight = num('weightBps') ?? 0
      if (!projectId) return { ok: false, error: 'Project is required' }
      const siblings = await db.query.milestones.findMany({
        where: eq(t.milestones.projectId, projectId),
        columns: { weightBps: true },
      })
      const total = siblings.reduce((sum, m) => sum + m.weightBps, 0) + weight
      // Reported, not refused: you may legitimately add milestones one at a time
      // and rebalance after. Silence would be the problem.
      const note = total === 10_000
        ? 'weights now total 100%'
        : `weights now total ${(total / 100).toFixed(1)}% — percent complete cannot reach 100 until they total 100`
      return { ok: true, row, note }
    }

    case 'contacts': {
      const email = str('email')
      if (email) {
        const lower = email.toLowerCase()
        const clash = await db.query.contacts.findFirst({ where: eq(t.contacts.email, lower) })
        if (clash) return { ok: false, error: `${clash.firstName} ${clash.lastName} already uses ${lower}` }
        return { ok: true, row: { ...row, email: lower } }
      }
      return { ok: true, row }
    }

    case 'sprints': {
      const bad = endAfterStart('startDate', 'endDate', 'A sprint')
      return bad ? { ok: false, error: bad } : { ok: true, row }
    }

    case 'absences': {
      const bad = endAfterStart('startDate', 'endDate', 'An absence')
      return bad ? { ok: false, error: bad } : { ok: true, row }
    }

    case 'projects': {
      // Slip is measured against the baseline. Defaulting it to the target means
      // a project that has never moved reads as zero slip rather than unknown.
      const target = str('targetLaunch')
      return { ok: true, row: target && !row.baselineLaunch ? { ...row, baselineLaunch: target } : row }
    }

    case 'meetings': {
      // The planned length follows the type; nobody should have to know that an
      // L10 is ninety minutes to schedule one.
      if (num('durationMinutes')) return { ok: true, row }
      const byType: Record<string, number> = { L10: 90, Quarterly: 480, Annual: 960 }
      return { ok: true, row: { ...row, durationMinutes: byType[str('type') ?? 'L10'] ?? 90 } }
    }

    case 'rocks': {
      const quarter = str('quarter') ?? ''
      if (!ROCK_QUARTER_PATTERN.test(quarter)) {
        return { ok: false, error: 'Quarter must look like 2026-Q3' }
      }
      // Due at quarter end unless somebody chose otherwise — a rock without a
      // date is a wish.
      return { ok: true, row: row.dueDate ? row : { ...row, dueDate: quarterEndDate(quarter) } }
    }

    case 'scorecardEntries': {
      const measurableId = str('measurableId')
      if (!measurableId) return { ok: false, error: 'Measurable is required' }
      const measurable = await db.query.measurables.findFirst({
        where: eq(t.measurables.id, measurableId),
        columns: { name: true, unit: true },
      })
      if (!measurable) return { ok: false, error: 'Unknown measurable' }

      // "Always a Monday" is enforced, not documented: whatever day was picked,
      // the entry lands on that week's Monday.
      const week = mondayOf(str('weekStarting') ?? '')

      // Entered in natural units, stored in raw ones — createTarget's exact
      // conversion, so €12,000 and 75% mean what the person typed.
      const raw = num('value') ?? 0
      const value =
        measurable.unit === 'Money' ? Math.round(raw * 100)
        : measurable.unit === 'Percent' ? Math.round(raw * 100)
        : Math.round(raw)

      // Checked ahead of the unique constraint for the friendlier sentence; the
      // constraint still backstops a race.
      const existing = await db.query.scorecardEntries.findFirst({
        where: and(eq(t.scorecardEntries.measurableId, measurableId), eq(t.scorecardEntries.weekStarting, week)),
        columns: { id: true },
      })
      if (existing) {
        return { ok: false, error: `${measurable.name} already has a value for the week of ${week} — edit that entry instead.` }
      }

      return { ok: true, row: { ...row, weekStarting: week, value }, note: `week of ${week}` }
    }

    case 'todos': {
      // Due in seven days — that is the cadence. Anything longer is a rock or a task.
      if (row.dueDate) return { ok: true, row }
      const due = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
      return { ok: true, row: { ...row, dueDate: due } }
    }

    default:
      return { ok: true, row }
  }
}

/* ------------------------------------------------------------------ invoices */

/** Standard payment terms. Used to seed the due date, not enforced. */
const PAYMENT_TERMS_DAYS = 30

/** The next free reference, for the form to show before anything is saved. */
export async function suggestInvoiceNumber(): Promise<{ number: string; dueDate: string; issueDate: string }> {
  await requirePermission('invoices', 'edit')
  const issued = await db.select({ number: t.invoices.number }).from(t.invoices)
  const issueDate = toISODate()
  return {
    number: nextInvoiceNumber(issued.map((i) => i.number), new Date().getFullYear()),
    issueDate,
    dueDate: toISODate(new Date(Date.now() + PAYMENT_TERMS_DAYS * 86_400_000)),
  }
}

/**
 * Attach the hours this invoice bills.
 *
 * Which hours depends on what the invoice is for, and the rule is deliberately
 * conservative — marking too many understates future billable work, which is the
 * expensive direction to be wrong in:
 *
 *   against a milestone  the hours logged on that milestone's tasks
 *   against a project    unbilled project hours up to the issue date
 *   against neither      none
 *
 * Entries logged straight to a project with no task cannot be attributed to a
 * milestone, so a milestone invoice leaves them alone rather than guessing.
 * Already-billed hours are never re-attached.
 */
async function attachTimeToInvoice(
  invoiceId: string,
  scope: { projectId: string | null; milestoneId: string | null; issueDate: string },
): Promise<{ count: number; minutes: number }> {
  if (!scope.projectId && !scope.milestoneId) return { count: 0, minutes: 0 }

  const candidates = await db.query.timeEntries.findMany({
    where: isNull(t.timeEntries.invoiceId),
    with: { task: { columns: { milestoneId: true } } },
    columns: { id: true, minutes: true, projectId: true, workedOn: true },
  })

  const chosen = candidates.filter((entry) => {
    if (scope.milestoneId) return entry.task?.milestoneId === scope.milestoneId
    return entry.projectId === scope.projectId && entry.workedOn <= scope.issueDate
  })

  if (chosen.length === 0) return { count: 0, minutes: 0 }

  await db
    .update(t.timeEntries)
    .set({ invoiceId })
    .where(inArray(t.timeEntries.id, chosen.map((e) => e.id)))

  return {
    count: chosen.length,
    minutes: chosen.reduce((sum, e) => sum + e.minutes, 0),
  }
}

const newInvoiceSchema = z.object({
  number: z.string().trim().min(3).max(40),
  organizationId: z.string().min(1),
  projectId: z.string().nullable().optional(),
  milestoneId: z.string().nullable().optional(),
  subscriptionId: z.string().nullable().optional(),
  status: z.string(),
  issueDate: z.string().min(10),
  dueDate: z.string().min(10),
  /** Entered in euros; cents are this function's business. */
  amount: z.number().finite().min(0),
  tax: z.number().finite().min(0),
})

export type NewInvoiceInput = z.infer<typeof newInvoiceSchema>

/**
 * Raise an invoice.
 *
 * Created as Draft or Sent only — you do not issue a void invoice, you void one
 * that already exists, and offering it here would let somebody create a record
 * that was never real.
 *
 * The reference is checked explicitly rather than left to the unique constraint,
 * so the error names the invoice already holding it instead of surfacing a
 * Postgres violation.
 */
export async function createInvoice(input: NewInvoiceInput): Promise<ActionResult> {
  try {
    const member = await requirePermission('invoices', 'edit')
    const data = newInvoiceSchema.parse(input)

    if (data.status !== 'Draft' && data.status !== 'Sent') {
      return { ok: false, error: 'A new invoice can only be a draft or sent' }
    }
    // An invoice due before it was issued is born overdue and would poison the
    // aging report from the moment it is saved.
    if (data.dueDate < data.issueDate) {
      return { ok: false, error: 'The due date cannot be before the issue date' }
    }

    const clash = await db.query.invoices.findFirst({ where: eq(t.invoices.number, data.number) })
    if (clash) return { ok: false, error: `${data.number} already exists` }

    const org = await db.query.organizations.findFirst({
      where: eq(t.organizations.id, data.organizationId),
      columns: { id: true, name: true },
    })
    if (!org) return { ok: false, error: 'Unknown client' }

    // A milestone belonging to another project would silently mis-attribute the
    // revenue and break the cockpit's unbilled figure.
    if (data.milestoneId) {
      const milestone = await db.query.milestones.findFirst({
        where: eq(t.milestones.id, data.milestoneId),
        columns: { id: true, projectId: true },
      })
      if (!milestone) return { ok: false, error: 'Unknown milestone' }
      if (data.projectId && milestone.projectId !== data.projectId) {
        return { ok: false, error: 'That milestone belongs to a different project' }
      }
    }

    const amountCents = Math.round(data.amount * 100)
    const taxCents = Math.round(data.tax * 100)

    const [created] = await db.insert(t.invoices).values({
      number: data.number,
      organizationId: data.organizationId,
      projectId: data.projectId || null,
      milestoneId: data.milestoneId || null,
      subscriptionId: data.subscriptionId || null,
      status: data.status as never,
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      amountCents,
      taxCents,
      ownerId: member.memberId,
    }).returning()

    await recordAudit(member, 'create', 'invoices', [created])

    const time = await attachTimeToInvoice(created.id, {
      projectId: data.projectId || null,
      milestoneId: data.milestoneId || null,
      issueDate: data.issueDate,
    })

    revalidatePath('/', 'layout')

    const total = amountCents + taxCents
    const hours = Math.round(time.minutes / 60)
    return {
      ok: true,
      detail: time.count > 0
        ? `${data.number} raised for ${org.name} — €${(total / 100).toLocaleString('en-IE')}, ${hours}h across ${time.count} entries marked invoiced`
        : `${data.number} raised for ${org.name} — €${(total / 100).toLocaleString('en-IE')}`,
    }
  } catch (error) {
    return failure('createInvoice', error, 'Could not raise the invoice')
  }
}

/* ------------------------------------------------------------------ payments */

/**
 * Invoices with money still on them, for the payment picker.
 *
 * Void and fully settled invoices are left out: you cannot pay a written-off
 * bill, and offering a paid one invites recording the same transfer twice.
 */
export async function openInvoices(): Promise<
  { id: string; number: string; client: string; outstandingCents: number }[]
> {
  await requirePermission('payments', 'edit')
  const rows = await db.query.invoices.findMany({
    with: {
      organization: { columns: { name: true } },
      payments: { columns: { amountCents: true } },
    },
    orderBy: [t.invoices.dueDate],
  })

  return rows
    .map((i) => ({ invoice: i, state: invoiceState(i, i.payments) }))
    .filter((x) => x.state.outstandingCents > 0 && x.state.state !== 'Void')
    .map(({ invoice, state }) => ({
      id: invoice.id,
      number: invoice.number,
      client: invoice.organization?.name ?? '',
      outstandingCents: state.outstandingCents,
    }))
}

const newPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  paidOn: z.string().min(10),
  /** Entered in euros. */
  amount: z.number().finite().positive(),
  method: z.string(),
  reference: z.string().trim().max(80).nullable().optional(),
})

export type NewPaymentInput = z.infer<typeof newPaymentSchema>

/**
 * Record money received against an invoice.
 *
 * No side effects by design — whether the invoice is now settled, part paid or
 * still overdue follows from the payment rows, so there is no status to flip and
 * nothing to forget.
 *
 * Overpayment is allowed rather than refused: bank rounding and a client paying
 * two invoices in one transfer are ordinary, and blocking them over fifty cents
 * is worse than the alternative. It is reported back, because the surplus is not
 * tracked anywhere — Atelier has no concept of a credit balance.
 */
export async function createPayment(input: NewPaymentInput): Promise<ActionResult> {
  try {
    const member = await requirePermission('payments', 'edit')
    const data = newPaymentSchema.parse(input)

    const config = getTable('payments')
    const methods = config?.fields.find((f) => f.id === 'method')?.options ?? []
    if (!methods.some((o) => o.value === data.method)) {
      return { ok: false, error: `${data.method} is not a valid payment method` }
    }

    const invoice = await db.query.invoices.findFirst({
      where: eq(t.invoices.id, data.invoiceId),
      with: {
        organization: { columns: { name: true } },
        payments: { columns: { amountCents: true } },
      },
    })
    if (!invoice) return { ok: false, error: 'Unknown invoice' }
    if (invoice.status === 'Void') {
      return { ok: false, error: `${invoice.number} is void — nothing is owed on it` }
    }

    const amountCents = Math.round(data.amount * 100)
    const before = invoiceState(invoice, invoice.payments)

    const [created] = await db.insert(t.payments).values({
      invoiceId: data.invoiceId,
      paidOn: data.paidOn,
      amountCents,
      method: data.method as never,
      reference: data.reference?.trim() || null,
    }).returning()

    await recordAudit(member, 'create', 'payments', [created])
    revalidatePath('/', 'layout')

    const surplus = amountCents - before.outstandingCents
    const settled = amountCents >= before.outstandingCents
    const euro = (cents: number) => `€${(cents / 100).toLocaleString('en-IE')}`

    return {
      ok: true,
      detail: surplus > 0
        ? `${euro(amountCents)} recorded — ${invoice.number} settled, ${euro(surplus)} more than outstanding`
        : settled
          ? `${euro(amountCents)} recorded — ${invoice.number} settled`
          : `${euro(amountCents)} recorded — ${euro(before.outstandingCents - amountCents)} still outstanding`,
    }
  } catch (error) {
    return failure('createPayment', error, 'Could not record the payment')
  }
}

/* ------------------------------------------------------------- subscriptions */

/**
 * How early a renewal may be recorded. A client confirming a fortnight ahead is
 * normal; "renewing" something due in eight months is a mis-click.
 */
const RENEW_WINDOW_DAYS = 30

/**
 * Move a subscription on to its next term.
 *
 * Without this, `renewsOn` is written once at creation and never again, so a
 * customer you actually renewed sits permanently past due and the client cockpit
 * keeps reporting them At risk — the temperature quietly becomes noise.
 *
 * Guarded rather than idempotent, because renewal is a recurring event and
 * "already done" is not a permanent state. The window is what makes a
 * double-click safe: once applied, the next date is a whole term away and the
 * second call is refused, so nobody skips a year by clicking twice.
 */
export async function renewSubscription(id: string): Promise<ActionResult> {
  try {
    const member = await requirePermission('subscriptions', 'edit')

    const sub = await db.query.subscriptions.findFirst({ where: eq(t.subscriptions.id, id) })
    if (!sub) return { ok: false, error: 'Subscription not found' }
    if (sub.status !== 'Active') {
      return { ok: false, error: `A ${sub.status.toLowerCase()} subscription cannot be renewed` }
    }

    const today = toISODate()
    const daysAway = daysBetween(today, sub.renewsOn)
    if (daysAway > RENEW_WINDOW_DAYS) {
      return { ok: false, error: `Not due for ${daysAway} days — nothing to renew yet` }
    }

    const next = nextRenewalDate(sub.renewsOn, sub.termMonths)
    await db
      .update(t.subscriptions)
      .set({ renewsOn: next, updatedAt: new Date() })
      .where(eq(t.subscriptions.id, id))

    await recordAudit(member, 'update', 'subscriptions', [sub])
    revalidatePath('/', 'layout')

    // A record left untouched for several terms needs more than one click, and
    // saying so beats silently jumping three years of history the house never had.
    const stillBehind = next <= today
    return {
      ok: true,
      detail: stillBehind
        ? `Renewed to ${next} — still overdue, renew again`
        : `Renewed to ${next}`,
    }
  } catch (error) {
    return failure('renewSubscription', error, 'Could not renew the subscription')
  }
}

/* ---------------------------------------------------------------- my profile */

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  role: z.string(),
  department: z.string(),
  status: z.string(),
  weeklyCapacityHours: z.number().int().min(0).max(80),
  timezone: z.string().trim().max(64).nullable(),
  squad: z.string().trim().max(64).nullable(),
  startDate: z.string().nullable(),
})

export type ProfileInput = z.infer<typeof profileSchema>

/**
 * Update the signed-in member's own Team row.
 *
 * Separate from updateCell for two reasons. The row id comes from the session and
 * is never accepted from the client, so this cannot be pointed at a colleague.
 * And `email` is absent from the schema on purpose: it is the join key between
 * the Auth.js user and the Team row, so writing it here would sign you out of
 * your own account and, on a real deployment, lock you out for good — the sign-in
 * callback refuses any address that is not in the Team table.
 */
export async function updateMyProfile(input: ProfileInput): Promise<ActionResult> {
  try {
    const { memberId } = await requireMember()
    if (!memberId) {
      return { ok: false, error: 'Your sign-in is not linked to a team member' }
    }

    const data = profileSchema.parse(input)

    // Enum-backed columns are checked against the same option sets the grid
    // renders, rather than a second list of literals that could drift from them.
    const config = getTable('team')
    for (const fieldId of ['role', 'department', 'status'] as const) {
      const options = config?.fields.find((f) => f.id === fieldId)?.options ?? []
      if (!options.some((o) => o.value === data[fieldId])) {
        return { ok: false, error: `${data[fieldId]} is not a valid ${fieldId}` }
      }
    }

    await db
      .update(t.teamMembers)
      .set({
        name: data.name,
        role: data.role as never,
        department: data.department as never,
        status: data.status as never,
        weeklyCapacityHours: data.weeklyCapacityHours,
        timezone: data.timezone,
        squad: data.squad,
        startDate: data.startDate,
        updatedAt: new Date(),
      })
      .where(eq(t.teamMembers.id, memberId))

    revalidatePath('/', 'layout')
    return { ok: true, detail: 'Profile saved' }
  } catch (error) {
    return failure('updateMyProfile', error, 'Could not save profile')
  }
}

/* ---------------------------------------------------------------- traction */

const startMeetingSchema = z.object({ id: z.string().min(1) })

/**
 * Scheduled → InProgress, stamping startedAt. Idempotent on purpose: two
 * people clicking Start in the same second must not produce an error in the
 * room — the second click just finds the meeting already running.
 */
export async function startMeeting(input: z.infer<typeof startMeetingSchema>): Promise<ActionResult> {
  try {
    await requirePermission('meetings', 'edit')
    const { id } = startMeetingSchema.parse(input)

    const meeting = await db.query.meetings.findFirst({ where: eq(t.meetings.id, id) })
    if (!meeting) return { ok: false, error: 'Unknown meeting' }
    if (meeting.status === 'Concluded') return { ok: false, error: 'This meeting has already been concluded' }
    if (meeting.status === 'InProgress') return { ok: true, detail: 'Already running' }

    await db.update(t.meetings)
      .set({ status: 'InProgress', startedAt: new Date(), updatedAt: new Date() })
      .where(eq(t.meetings.id, id))

    revalidatePath('/', 'layout')
    return { ok: true, detail: 'Meeting started' }
  } catch (error) {
    return failure('startMeeting', error, 'Could not start the meeting')
  }
}

const concludeMeetingSchema = z.object({
  id: z.string().min(1),
  rating: z.number().int().min(1).max(10),
  cascadingMessages: z.string().trim().optional(),
  headlines: z.string().trim().optional(),
})

/** Stamps the conclusion: status, concludedAt, the rating and the texts. */
export async function concludeMeeting(input: z.infer<typeof concludeMeetingSchema>): Promise<ActionResult> {
  try {
    await requirePermission('meetings', 'edit')
    const data = concludeMeetingSchema.parse(input)

    const meeting = await db.query.meetings.findFirst({ where: eq(t.meetings.id, data.id) })
    if (!meeting) return { ok: false, error: 'Unknown meeting' }
    // Refused rather than overwritten: a second conclude would silently
    // replace the rating the room agreed on.
    if (meeting.status === 'Concluded') return { ok: false, error: 'This meeting has already been concluded' }

    const openTodos = await db.query.eosTodos.findMany({
      where: eq(t.eosTodos.done, false), columns: { id: true },
    })

    await db.update(t.meetings)
      .set({
        status: 'Concluded',
        concludedAt: new Date(),
        rating: data.rating,
        cascadingMessages: data.cascadingMessages || meeting.cascadingMessages,
        headlines: data.headlines || meeting.headlines,
        updatedAt: new Date(),
      })
      .where(eq(t.meetings.id, data.id))

    revalidatePath('/', 'layout')
    return {
      ok: true,
      detail: `Rated ${data.rating}/10 — ${openTodos.length} to-do${openTodos.length === 1 ? '' : 's'} open`,
    }
  } catch (error) {
    return failure('concludeMeeting', error, 'Could not conclude the meeting')
  }
}

const resolveIssueSchema = z.object({
  issueId: z.string().min(1),
  outcome: z.enum(['Solved', 'Dropped']),
  meetingId: z.string().nullable().optional(),
})

/**
 * How an issue leaves the list. Only a solve remembers the meeting — a dropped
 * issue was noise, and noise does not deserve a foreign key.
 */
export async function resolveIssue(input: z.infer<typeof resolveIssueSchema>): Promise<ActionResult> {
  try {
    await requirePermission('issues', 'edit')
    const data = resolveIssueSchema.parse(input)

    const issue = await db.query.eosIssues.findFirst({ where: eq(t.eosIssues.id, data.issueId) })
    if (!issue) return { ok: false, error: 'Unknown issue' }

    await db.update(t.eosIssues)
      .set({
        status: data.outcome,
        solvedInMeetingId: data.outcome === 'Solved' ? (data.meetingId ?? null) : null,
        updatedAt: new Date(),
      })
      .where(eq(t.eosIssues.id, data.issueId))

    revalidatePath('/', 'layout')
    return { ok: true, detail: data.outcome === 'Solved' ? 'Solved — now make it a to-do' : 'Dropped' }
  } catch (error) {
    return failure('resolveIssue', error, 'Could not update the issue')
  }
}
