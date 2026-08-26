import type { TableId } from './types'

/**
 * Columns the UI is allowed to write, per table.
 *
 * An allow-list rather than a deny-list: a new column is read-only until someone
 * deliberately opens it. Computed fields (tcv, hygiene, daysInStage…) are absent
 * by design.
 *
 * It lives here rather than in actions.ts because that file is `'use server'`,
 * where every export must be an async action — so a constant cannot leave it,
 * and nothing could check this list against the table config. That gap is not
 * hypothetical: `portfolioProductId` was added to the products and deals configs
 * in Phase 2 and never added here, so the field rendered in the form and the
 * grid and the server refused every write to it with "portfolioProductId is
 * read-only". See writable.test.ts, which now fails if the two drift again.
 */
export const WRITABLE: Record<TableId, string[]> = {
  deals: [
    'name', 'type', 'motion', 'forecast', 'expectedCloseDate', 'actualCloseDate',
    'nextStep', 'nextStepDate', 'contractMonths', 'championIdentified',
    'economicBuyerIdentified', 'painDocumented', 'decisionProcessDocumented',
    'lossReason', 'lossNotes', 'notes', 'organizationId', 'primaryContactId',
    'ownerId', 'sourceId', 'portfolioProductId',
  ],
  organizations: [
    'name', 'legalName', 'domain', 'lifecycle', 'segment', 'industry', 'country',
    'city', 'employeeCount', 'website', 'vatId', 'notes', 'ownerId', 'sourceId',
  ],
  contacts: [
    'firstName', 'lastName', 'email', 'phone', 'title', 'persona', 'status',
    'marketingOptIn', 'language', 'linkedin', 'notes', 'organizationId', 'ownerId',
  ],
  activities: [
    'subject', 'type', 'outcome', 'occurredAt', 'nextStep', 'nextStepDue',
    'durationMinutes', 'notes', 'organizationId', 'dealId', 'contactId', 'ownerId',
  ],
  products: [
    'name', 'type', 'listPriceCents', 'billing', 'unit', 'costToServeCents',
    'active', 'description', 'portfolioProductId',
  ],
  sources: ['name', 'category', 'active', 'monthlyCostCents'],
  team: ['name', 'email', 'role', 'department', 'status', 'weeklyCapacityHours', 'timezone', 'startDate'],
  targets: ['period', 'metric', 'scope', 'value', 'teamMemberId'],
  portfolio: [
    'name', 'slug', 'status', 'description', 'ownerId', 'launchedAt',
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
  sprints: ['name', 'goal', 'status', 'startDate', 'endDate', 'committedMinutes', 'retroNotes'],
  // 'invoiced' is absent: it is derived from invoiceId, which createInvoice sets.
  timeEntries: ['teamMemberId', 'workedOn', 'minutes', 'taskId', 'projectId', 'billable', 'notes'],
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
  // Clients writes land on the organization row behind them — see TABLE_TO_DRIZZLE.
  clients: ['name', 'segment', 'domain', 'notes', 'ownerId'],
  subscriptions: [
    'organizationId', 'portfolioProductId', 'dealId', 'status', 'startDate', 'termMonths',
    'renewsOn', 'endedOn', 'autoRenew', 'mrrCents', 'billing', 'cancelReason', 'notes', 'ownerId',
  ],
  invoices: [
    'number', 'organizationId', 'projectId', 'subscriptionId', 'milestoneId', 'status',
    'issueDate', 'dueDate', 'amountCents', 'taxCents', 'notes', 'ownerId',
  ],
  payments: ['invoiceId', 'paidOn', 'amountCents', 'method', 'reference', 'notes'],
  /** Append-only. An audit trail you can edit is not an audit trail. */
  audit: [],
  // status is deliberately absent — see READ_ONLY_BY_DESIGN.
  meetings: ['type', 'heldOn', 'ownerId', 'durationMinutes', 'headlines', 'cascadingMessages', 'notes'],
  rocks: ['title', 'quarter', 'scope', 'status', 'ownerId', 'dueDate', 'notes'],
  measurables: ['name', 'ownerId', 'unit', 'goalValue', 'direction', 'active', 'sequence', 'notes'],
  scorecardEntries: ['measurableId', 'weekStarting', 'value', 'notes'],
  todos: ['title', 'ownerId', 'done', 'dueDate', 'meetingId', 'notes'],
  issues: ['title', 'status', 'ownerId', 'solvedInMeetingId', 'notes'],
}

/**
 * Fields the config shows but the allow-list withholds *on purpose*.
 *
 * Every entry needs a reason, because the default reading of "in the config,
 * not in WRITABLE" is now "somebody forgot". Anything absent from both is a bug
 * the test reports.
 */
export const READ_ONLY_BY_DESIGN: Partial<Record<TableId, Record<string, string>>> = {
  deals: {
    stage: 'Goes through moveDealStage, which stamps stageEnteredAt and appends to deal_stage_history. A plain write would lose both.',
  },
  meetings: {
    status: 'Goes through startMeeting/concludeMeeting, which stamp startedAt, concludedAt and the rating — a plain write would lose all three.',
  },
}
