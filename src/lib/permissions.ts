/**
 * Who may do what.
 *
 * Deliberately small. Atelier is an internal tool for one house where everybody
 * in the Team table is a colleague, so this is not a general-purpose ACL — it
 * exists to stop two specific things:
 *
 *   1. Everyone being able to read what everyone else costs per hour. That is
 *      salary-derivable, and "we all trust each other" is not a reason to put it
 *      on a grid that any signed-in member can sort by.
 *   2. Any member permanently deleting the financial record. Deletion here is a
 *      hard DELETE — see the audit log for what recovery looks like.
 *
 * Roles come from the Team row and are already on the session
 * (`session.user.role`, set in auth.ts). A null role means the sign-in is not
 * linked to a Team member: treated as the least privileged case.
 */
import type { TableId } from './types'

export type Role = string | null

/** The people who run the house. Everything else is scoped below them. */
const ADMIN_ROLES = ['Founder', 'Ops']

/** Delivery leadership — may write the delivery and production tables. */
const DELIVERY_ROLES = ['PM']

/** Client-facing roles — may write the sales tables. */
const SALES_ROLES = ['AE', 'SDR', 'CSM', 'PartnerManager']

/**
 * Tables holding money owed, money received or what people are paid. Restricted
 * to admins for both writing and deleting.
 */
const FINANCIAL_TABLES: TableId[] = ['invoices', 'payments', 'subscriptions', 'targets', 'team']

const DELIVERY_TABLES: TableId[] = [
  'projects', 'milestones', 'tasks', 'sprints', 'timeEntries',
  'allocations', 'absences', 'changeRequests', 'risks', 'portfolio',
]

const SALES_TABLES: TableId[] = [
  'deals', 'organizations', 'clients', 'contacts', 'activities', 'products', 'sources',
]

/**
 * Tables nobody but an admin may even read. The audit log holds complete copies
 * of deleted rows, so it inherits the sensitivity of everything it has ever
 * recorded — including the cost figures redacted everywhere else.
 */
const ADMIN_ONLY_TABLES: TableId[] = ['audit']

/**
 * The EOS cadence artifacts. Every active member runs the meeting, owns rocks,
 * records numbers and ticks to-dos — gating any of it on role would make the
 * weekly ritual somebody's bottleneck.
 */
const EOS_TABLES: TableId[] = ['meetings', 'rocks', 'measurables', 'scorecardEntries', 'todos', 'issues']

export function isAdmin(role: Role): boolean {
  return role !== null && ADMIN_ROLES.includes(role)
}

export function canRead(role: Role, table: TableId): boolean {
  return !ADMIN_ONLY_TABLES.includes(table) || isAdmin(role)
}

/**
 * May this person see internal cost and bill rates, and the margins derived from
 * them? Enforced in the query layer — hiding the column client-side would still
 * ship the numbers in the payload.
 */
export function canSeeCost(role: Role): boolean {
  return isAdmin(role)
}

/** May this person edit rows in this table? */
export function canWrite(role: Role, table: TableId): boolean {
  if (isAdmin(role)) return true
  if (role === null) return false
  if (FINANCIAL_TABLES.includes(table)) return false
  if (DELIVERY_TABLES.includes(table)) {
    // Everyone logs their own hours; the rest of delivery is the PM's.
    if (table === 'timeEntries' || table === 'tasks') return true
    return DELIVERY_ROLES.includes(role)
  }
  if (SALES_TABLES.includes(table)) return SALES_ROLES.includes(role) || DELIVERY_ROLES.includes(role)
  if (EOS_TABLES.includes(table)) return true
  return false
}

/**
 * May this person delete rows in this table?
 *
 * Stricter than writing on purpose: an edit is visible and reversible, a delete
 * is neither. Financial records are admin-only whatever the write rule says.
 */
export function canDelete(role: Role, table: TableId): boolean {
  if (isAdmin(role)) return true
  if (FINANCIAL_TABLES.includes(table)) return false
  return canWrite(role, table)
}

/** Human-readable refusal, so the toast says something useful. */
export function refusal(action: 'edit' | 'delete', table: TableId): string {
  return FINANCIAL_TABLES.includes(table)
    ? `Only a founder or ops can ${action} ${table}`
    : `Your role cannot ${action} ${table}`
}
