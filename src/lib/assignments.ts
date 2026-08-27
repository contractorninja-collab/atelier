import type { TableId } from './types'

/**
 * The (table, field) pairs that mean "this is now your work" — the ones worth
 * an email. Each carries the phrase the subject line uses, because "assigned
 * to you" is right for a task and wrong for a project you have been given to
 * run.
 *
 * Deliberately absent: measurables and meetings (owning a scorecard number or
 * running the weekly meeting is a standing role, not new work landing on your
 * desk), organizations and contacts (account ownership shuffles are admin, not
 * assignment), time entries and allocations (you log your own time; planning
 * is read in the capacity grid, not pushed by mail), and milestone sign-off
 * (signedOffById records who signed, after the fact). The CSV importer also
 * sends nothing on purpose: importing fifty historical deals is data
 * migration, and blasting their owners fifty emails would teach everyone to
 * ignore the real ones.
 *
 * The schema-agreement test checks every entry names a real user-type field
 * the UI can actually write — an entry here that drifts from the config would
 * otherwise just silently never fire.
 */
export const ASSIGNMENT_FIELDS: Partial<Record<TableId, Record<string, string>>> = {
  tasks: { assigneeId: 'assigned to you', reviewerId: 'yours to review' },
  todos: { ownerId: 'yours to do' },
  rocks: { ownerId: 'now your rock' },
  milestones: { ownerId: 'yours to deliver' },
  projects: { pmId: 'yours to run' },
  deals: { ownerId: 'now your deal' },
  issues: { ownerId: 'yours to solve' },
  risks: { ownerId: 'yours to mitigate' },
}

export function assignmentPhrase(table: TableId, field: string): string | null {
  return ASSIGNMENT_FIELDS[table]?.[field] ?? null
}
