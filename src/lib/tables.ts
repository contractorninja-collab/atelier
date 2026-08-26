/**
 * The view layer's single source of truth.
 *
 * Every grid, board, timeline, record panel and command-palette result is
 * generated from this config. Adding a table to the UI is a config change,
 * not a new set of components — which is the whole point of building it this
 * way rather than hand-rolling a page per table.
 */
import type { Option, TableConfig, TableId } from './types'

const C = {
  gray: '#94a3b8',
  slate: '#64748b',
  sky: '#3b93e0',
  violet: '#7c6cf0',
  amber: '#e2a63a',
  orange: '#d97757',
  green: '#1c8c5a',
  rose: '#c2415f',
  teal: '#12a5a5',
} as const

/** Build options from [enumValue, label, colour] triples. */
const opts = (...rows: [string, string, string][]): Option[] =>
  rows.map(([value, label, color]) => ({ value, label, color }))

/* ---------------------------------------------------------------- options */

export const DEAL_STAGE_OPTIONS = opts(
  ['Qualifying', 'Qualifying', C.gray],
  ['Discovery', 'Discovery', C.sky],
  ['SolutionFit', 'Solution Fit', C.violet],
  ['Proposal', 'Proposal', C.amber],
  ['Negotiation', 'Negotiation', C.orange],
  ['ClosedWon', 'Closed Won', C.green],
  ['ClosedLost', 'Closed Lost', C.slate],
  ['Nurture', 'Nurture', C.gray],
)

/**
 * Probability is a property of the stage, not of the rep's mood.
 * Rep judgement belongs in the forecast category, which is a separate field.
 * Basis points, so 7500 is 75%.
 */
export const STAGE_PROBABILITY_BPS: Record<string, number> = {
  Qualifying: 500,
  Discovery: 1500,
  SolutionFit: 3000,
  Proposal: 5000,
  Negotiation: 7500,
  ClosedWon: 10000,
  ClosedLost: 0,
  Nurture: 0,
}

/** Days a deal may sit in a stage before the hygiene flag fires. */
export const STAGE_DAY_LIMIT: Record<string, number> = {
  Qualifying: 14,
  Discovery: 21,
  SolutionFit: 21,
  Proposal: 14,
  Negotiation: 30,
}

export const CLOSED_STAGES = ['ClosedWon', 'ClosedLost'] as const
export const INACTIVE_STAGES = ['ClosedWon', 'ClosedLost', 'Nurture'] as const

const LIFECYCLE = opts(
  ['Lead', 'Lead', C.gray],
  ['MQL', 'MQL', C.sky],
  ['SQL', 'SQL', C.violet],
  ['Opportunity', 'Opportunity', C.amber],
  ['Customer', 'Customer', C.green],
  ['Churned', 'Churned', C.slate],
  ['Disqualified', 'Disqualified', C.gray],
)

const ORG_TYPE = opts(
  ['Prospect', 'Prospect', C.sky],
  ['Customer', 'Customer', C.green],
  ['Partner', 'Partner', C.violet],
  ['Reseller', 'Reseller', C.teal],
  ['Vendor', 'Vendor', C.gray],
)

const SEGMENT = opts(
  ['Micro', 'Micro', C.gray],
  ['SMB', 'SMB', C.sky],
  ['MidMarket', 'Mid-market', C.violet],
  ['Enterprise', 'Enterprise', C.amber],
)

const PERSONA = opts(
  ['Champion', 'Champion', C.green],
  ['EconomicBuyer', 'Economic Buyer', C.violet],
  ['TechnicalEvaluator', 'Technical Evaluator', C.sky],
  ['EndUser', 'End User', C.gray],
  ['Blocker', 'Blocker', C.rose],
  ['Introducer', 'Introducer', C.teal],
)

const CONTACT_STATUS = opts(
  ['Active', 'Active', C.green],
  ['LeftCompany', 'Left company', C.amber],
  ['Unresponsive', 'Unresponsive', C.gray],
  ['Bounced', 'Bounced', C.rose],
  ['DoNotContact', 'Do not contact', C.slate],
)

const DEAL_TYPE = opts(
  ['Subscription', 'Subscription', C.sky],
  ['Project', 'Project', C.violet],
  ['Hybrid', 'Hybrid', C.teal],
  ['Retainer', 'Retainer', C.slate],
)

const DEAL_MOTION = opts(
  ['NewBusiness', 'New Business', C.green],
  ['Expansion', 'Expansion', C.sky],
  ['Upsell', 'Upsell', C.violet],
  ['CrossSell', 'Cross-sell', C.teal],
  ['Renewal', 'Renewal', C.amber],
  ['WinBack', 'Win-back', C.orange],
)

const FORECAST = opts(
  ['Pipeline', 'Pipeline', C.gray],
  ['BestCase', 'Best Case', C.sky],
  ['Commit', 'Commit', C.amber],
  ['ClosedWon', 'Closed Won', C.green],
  ['ClosedLost', 'Closed Lost', C.slate],
)

export const LOSS_REASON = opts(
  ['Price', 'Price', C.amber],
  ['Timing', 'Timing', C.sky],
  ['NoBudget', 'No budget', C.gray],
  ['LostToCompetitor', 'Lost to competitor', C.rose],
  ['NoDecision', 'No decision', C.slate],
  ['MissingFeature', 'Missing feature', C.violet],
  ['BadFit', 'Bad fit', C.gray],
  ['Unresponsive', 'Unresponsive', C.slate],
)

const ACTIVITY_TYPE = opts(
  ['Call', 'Call', C.sky],
  ['Email', 'Email', C.gray],
  ['Meeting', 'Meeting', C.violet],
  ['Demo', 'Demo', C.green],
  ['Note', 'Note', C.slate],
  ['CheckIn', 'Check-in', C.teal],
  ['QBR', 'QBR', C.amber],
  ['Onboarding', 'Onboarding', C.orange],
)

const OUTCOME = opts(
  ['Connected', 'Connected', C.sky],
  ['NoAnswer', 'No answer', C.gray],
  ['Positive', 'Positive', C.green],
  ['Neutral', 'Neutral', C.slate],
  ['Negative', 'Negative', C.rose],
  ['NextStepSet', 'Next step set', C.violet],
)

const PRODUCT_TYPE = opts(
  ['SaaSPlan', 'SaaS Plan', C.green],
  ['Service', 'Service', C.violet],
  ['AddOn', 'Add-on', C.sky],
  ['OneOff', 'One-off', C.amber],
  ['Retainer', 'Retainer', C.slate],
)

const BILLING = opts(
  ['OneOff', 'One-off', C.amber],
  ['Monthly', 'Monthly', C.green],
  ['Annual', 'Annual', C.sky],
  ['UsageBased', 'Usage-based', C.violet],
)

const MEMBER_ROLE = opts(
  ['Founder', 'Founder', C.violet],
  ['AE', 'AE', C.green],
  ['SDR', 'SDR', C.teal],
  ['CSM', 'CSM', C.sky],
  ['PartnerManager', 'Partner Manager', C.amber],
  ['PM', 'PM', C.orange],
  ['Designer', 'Designer', C.rose],
  ['Engineer', 'Engineer', C.sky],
  ['QA', 'QA', C.gray],
  ['Ops', 'Ops', C.slate],
)

const DEPARTMENT = opts(
  ['Sales', 'Sales', C.green],
  ['Delivery', 'Delivery', C.orange],
  ['Engineering', 'Engineering', C.sky],
  ['Ops', 'Ops', C.gray],
)

const MEMBER_STATUS = opts(
  ['Active', 'Active', C.green],
  ['OnLeave', 'On leave', C.amber],
  ['Inactive', 'Inactive', C.gray],
)

const SOURCE_CATEGORY = opts(
  ['Outbound', 'Outbound', C.sky],
  ['Inbound', 'Inbound', C.green],
  ['Referral', 'Referral', C.violet],
  ['Partner', 'Partner', C.teal],
  ['Paid', 'Paid', C.amber],
  ['Event', 'Event', C.orange],
  ['Content', 'Content', C.rose],
  ['Organic', 'Organic', C.gray],
  ['AppStore', 'App store', C.slate],
)

const TARGET_METRIC = opts(
  ['NewBusinessTCV', 'New business TCV', C.green],
  ['NetNewMRR', 'Net new MRR', C.sky],
  ['ClosedWonCount', 'Closed-won count', C.violet],
  ['BillableUtilization', 'Billable utilization', C.amber],
  ['GrossMargin', 'Gross margin', C.teal],
)

const TARGET_SCOPE = opts(
  ['Company', 'Company', C.violet],
  ['Team', 'Team', C.sky],
  ['Individual', 'Individual', C.teal],
)

/**
 * What a target's `value` column actually holds, per metric — money in cents,
 * percentages in basis points, everything else a plain count. The same three
 * storage rules as the rest of the schema.
 *
 * One definition because three places have to agree about the unit: the create
 * form (which asks for euros or percent), the write (which converts), and the
 * grid (which formats it back). They disagreed silently before this existed.
 */
export const TARGET_METRIC_UNIT: Record<string, 'money' | 'percent' | 'count'> = {
  NewBusinessTCV: 'money',
  NetNewMRR: 'money',
  ClosedWonCount: 'count',
  BillableUtilization: 'percent',
  GrossMargin: 'percent',
}

/** Accepts a quarter ("2026-Q3") or a month ("2026-07"), matching the column's comment. */
export const TARGET_PERIOD_PATTERN = /^\d{4}-(Q[1-4]|0[1-9]|1[0-2])$/

/* --------------------------------------------------------------- revenue */

export const INVOICE_STATUS = opts(
  ['Draft', 'Draft', C.gray],
  ['Sent', 'Sent', C.sky],
  ['Void', 'Void', C.slate],
)

/** Derived states, for rendering the computed column as a pill. */
export const INVOICE_STATE = opts(
  ['Draft', 'Draft', C.gray],
  ['Sent', 'Sent', C.sky],
  ['Part paid', 'Part paid', C.amber],
  ['Paid', 'Paid', C.green],
  ['Overdue', 'Overdue', C.rose],
  ['Void', 'Void', C.slate],
)

export const AGING_BUCKET = opts(
  ['Current', 'Current', C.green],
  ['1–30', '1–30 days', C.amber],
  ['31–60', '31–60 days', C.orange],
  ['61–90', '61–90 days', C.rose],
  ['90+', '90+ days', C.rose],
)

export const PAYMENT_METHOD = opts(
  ['Transfer', 'Bank transfer', C.sky],
  ['Card', 'Card', C.violet],
  ['DirectDebit', 'Direct debit', C.teal],
  ['Cash', 'Cash', C.gray],
  ['Other', 'Other', C.slate],
)

export const SUBSCRIPTION_STATUS = opts(
  ['Active', 'Active', C.green],
  ['Paused', 'Paused', C.amber],
  ['Cancelled', 'Cancelled', C.rose],
)

export const ACCOUNT_TEMPERATURE = opts(
  ['AtRisk', 'At risk', C.rose],
  ['Hot', 'Hot', C.orange],
  ['Warm', 'Warm', C.amber],
  ['Cold', 'Cold', C.slate],
)

/**
 * The thresholds behind an account's temperature, in one place so the grid, the
 * board and the dashboard cannot come to different conclusions about the same
 * customer — the same reason every other derived number lives in compute.ts.
 *
 * These are judgement calls, not laws. They are here to be argued with and
 * changed in one edit.
 */
export const HEALTH_RULES = {
  /** Spoken to this recently and something is moving — worth your attention today. */
  hotActivityDays: 14,
  /** Beyond this with no contact at all, the relationship has gone quiet. */
  warmActivityDays: 45,
  /** A renewal this close counts as active business, not background. */
  renewalSoonDays: 60,
  /** This close with no recent contact is a churn risk, not a renewal. */
  renewalUrgentDays: 30,
  /** Debt older than this stops being an admin oversight. */
  overdueRiskDays: 30,
  /** Stages late enough that the account is genuinely in play. */
  lateStages: ['Proposal', 'Negotiation'] as readonly string[],
}

/* ------------------------------------------------------ Phase 2 options */

const PORTFOLIO_STATUS = opts(
  ['Idea', 'Idea', C.gray],
  ['Discovery', 'Discovery', C.sky],
  ['Building', 'Building', C.amber],
  ['Live', 'Live', C.green],
  ['Maintenance', 'Maintenance', C.teal],
  ['Sunset', 'Sunset', C.slate],
)

const PROJECT_TYPE = opts(
  ['ClientDelivery', 'Client delivery', C.orange],
  ['InternalProduct', 'Internal product', C.violet],
  ['RnD', 'R&D', C.sky],
  ['SupportRetainer', 'Support retainer', C.slate],
  ['Migration', 'Migration', C.teal],
)

export const PROJECT_STATUS = opts(
  ['NotStarted', 'Not started', C.gray],
  ['Kickoff', 'Kickoff', C.sky],
  ['Discovery', 'Discovery', C.violet],
  ['Design', 'Design', C.teal],
  ['Build', 'Build', C.amber],
  ['UAT', 'UAT', C.orange],
  ['Launch', 'Launch', C.green],
  ['Hypercare', 'Hypercare', C.slate],
  ['Closed', 'Closed', C.gray],
  ['OnHold', 'On hold', C.gray],
  ['Cancelled', 'Cancelled', C.gray],
)

export const HEALTH = opts(
  ['Green', 'Green', C.green],
  ['Amber', 'Amber', C.amber],
  ['Red', 'Red', C.rose],
)

const MILESTONE_PHASE = opts(
  ['Kickoff', 'Kickoff', C.sky],
  ['DiscoveryComplete', 'Discovery complete', C.violet],
  ['DesignSignOff', 'Design sign-off', C.teal],
  ['BuildPhase', 'Build phase', C.amber],
  ['Integration', 'Integration', C.orange],
  ['UAT', 'UAT', C.rose],
  ['GoLive', 'Go-live', C.green],
  ['PostLaunchReview', 'Post-launch review', C.gray],
)

export const MILESTONE_STATUS = opts(
  ['NotStarted', 'Not started', C.gray],
  ['InProgress', 'In progress', C.amber],
  ['Blocked', 'Blocked', C.rose],
  ['Delivered', 'Delivered', C.sky],
  ['Accepted', 'Accepted', C.green],
  ['Cancelled', 'Cancelled', C.slate],
)

/** The same colours, keyed for places that render a dot rather than a pill. */
export const MILESTONE_STATUS_COLOUR: Record<string, string> = Object.fromEntries(
  MILESTONE_STATUS.map((o) => [o.value, o.color]),
)

const TASK_TYPE = opts(
  ['Feature', 'Feature', C.violet],
  ['Bug', 'Bug', C.rose],
  ['Chore', 'Chore', C.gray],
  ['Spike', 'Spike', C.amber],
  ['Design', 'Design', C.teal],
  ['QA', 'QA', C.sky],
  ['Content', 'Content', C.slate],
  ['Ops', 'Ops', C.gray],
)

export const TASK_STATUS = opts(
  ['Backlog', 'Backlog', C.gray],
  ['Ready', 'Ready', C.sky],
  ['InProgress', 'In progress', C.amber],
  ['InReview', 'In review', C.violet],
  ['QA', 'QA', C.teal],
  ['Done', 'Done', C.green],
  ['WontDo', "Won't do", C.slate],
)

const PRIORITY = opts(
  ['P0', 'P0 — drop everything', C.rose],
  ['P1', 'P1 — this sprint', C.orange],
  ['P2', 'P2 — next', C.amber],
  ['P3', 'P3 — someday', C.gray],
)

const SEVERITY = opts(
  ['Critical', 'Critical', C.rose],
  ['Major', 'Major', C.orange],
  ['Minor', 'Minor', C.amber],
  ['Trivial', 'Trivial', C.gray],
)

const REPORT_SOURCE = opts(
  ['InternalQA', 'Internal QA', C.gray],
  ['Customer', 'Customer', C.rose],
  ['Support', 'Support', C.orange],
  ['Monitoring', 'Monitoring', C.sky],
)

const SPRINT_STATUS = opts(
  ['Planned', 'Planned', C.gray],
  ['Active', 'Active', C.green],
  ['Closed', 'Closed', C.slate],
)

const ABSENCE_TYPE = opts(
  ['PTO', 'PTO', C.green],
  ['PublicHoliday', 'Public holiday', C.sky],
  ['Sick', 'Sick', C.rose],
  ['Training', 'Training', C.violet],
  ['Parental', 'Parental', C.teal],
)

const CR_STATUS = opts(
  ['Proposed', 'Proposed', C.gray],
  ['Estimated', 'Estimated', C.sky],
  ['SentToClient', 'Sent to client', C.amber],
  ['Approved', 'Approved', C.green],
  ['Rejected', 'Rejected', C.slate],
  ['Absorbed', 'Absorbed (goodwill)', C.rose],
)

const RISK_CATEGORY = opts(
  ['Risk', 'Risk', C.amber],
  ['Issue', 'Issue', C.rose],
  ['Dependency', 'Dependency', C.sky],
  ['ClientBlocker', 'Client-side blocker', C.orange],
)

const RISK_LEVEL = opts(
  ['Low', 'Low', C.gray],
  ['Medium', 'Medium', C.amber],
  ['High', 'High', C.rose],
)

const RISK_STATUS = opts(
  ['Open', 'Open', C.rose],
  ['Mitigating', 'Mitigating', C.amber],
  ['Closed', 'Closed', C.green],
  ['Accepted', 'Accepted', C.slate],
)

const CONFIDENCE = opts(
  ['Confirmed', 'Confirmed', C.green],
  ['Tentative', 'Tentative', C.amber],
)

/**
 * The milestone set generated when a deal closes won. Weights are basis points
 * and must total 10000 — the handoff asserts this before inserting, because a
 * project whose weights sum to 92% can never reach 100% complete and nobody
 * ever notices why.
 *
 * `offsetDays` is measured from the project start.
 */
export const MILESTONE_TEMPLATE: {
  name: string
  phase: string
  weightBps: number
  offsetDays: number
  paymentTrigger: boolean
  clientSignOffRequired: boolean
  acceptanceCriteria: string
}[] = [
  { name: 'Kickoff', phase: 'Kickoff', weightBps: 500, offsetDays: 10, paymentTrigger: true, clientSignOffRequired: false, acceptanceCriteria: 'Kickoff held, stakeholders identified, environments requested.' },
  { name: 'Discovery complete', phase: 'DiscoveryComplete', weightBps: 1000, offsetDays: 28, paymentTrigger: false, clientSignOffRequired: true, acceptanceCriteria: 'Requirements documented and agreed in writing. Out-of-scope list signed.' },
  { name: 'Design sign-off', phase: 'DesignSignOff', weightBps: 1000, offsetDays: 45, paymentTrigger: false, clientSignOffRequired: true, acceptanceCriteria: 'Flows and screens approved by the client. No open design questions.' },
  { name: 'Build — phase one', phase: 'BuildPhase', weightBps: 2000, offsetDays: 75, paymentTrigger: true, clientSignOffRequired: false, acceptanceCriteria: 'Core flows working end to end in staging.' },
  { name: 'Build — phase two', phase: 'BuildPhase', weightBps: 2000, offsetDays: 100, paymentTrigger: false, clientSignOffRequired: false, acceptanceCriteria: 'Remaining scope complete in staging.' },
  { name: 'Integration', phase: 'Integration', weightBps: 1000, offsetDays: 115, paymentTrigger: false, clientSignOffRequired: false, acceptanceCriteria: 'Third-party systems connected and reconciling in staging.' },
  { name: 'UAT', phase: 'UAT', weightBps: 1000, offsetDays: 130, paymentTrigger: false, clientSignOffRequired: true, acceptanceCriteria: 'Client testing complete. All critical and major defects closed.' },
  { name: 'Go-live', phase: 'GoLive', weightBps: 1000, offsetDays: 140, paymentTrigger: true, clientSignOffRequired: true, acceptanceCriteria: 'Live in production, monitored, client trained.' },
  { name: 'Post-launch review', phase: 'PostLaunchReview', weightBps: 500, offsetDays: 170, paymentTrigger: false, clientSignOffRequired: false, acceptanceCriteria: 'Hypercare closed, retro held, handover to support complete.' },
]

/* ----------------------------------------------------------------- spaces */

/**
 * `icon` is what the sidebar renders; `abbr` stays as the fallback for anywhere
 * that has no icon to reach for, and for the breadcrumb on narrow layouts.
 */
export const SPACES = [
  { id: 'sales', name: 'Sales', color: '#1c8c5a', abbr: 'S', icon: 'target', tables: ['deals', 'organizations', 'contacts', 'activities'] },
  { id: 'revenue', name: 'Revenue', color: '#0f9b8e', abbr: 'R', icon: 'euro', tables: ['clients', 'subscriptions', 'invoices', 'payments'] },
  { id: 'portfolio', name: 'Portfolio', color: '#8b5cf6', abbr: 'P', icon: 'bolt', tables: ['portfolio', 'tasks', 'sprints'] },
  { id: 'delivery', name: 'Delivery', color: '#d97757', abbr: 'D', icon: 'board', tables: ['projects', 'milestones', 'changeRequests', 'risks'] },
  { id: 'capacity', name: 'Capacity', color: '#3b93e0', abbr: 'C', icon: 'clock', tables: ['timeEntries', 'allocations', 'absences'] },
  { id: 'catalogue', name: 'Catalogue', color: '#e0a020', abbr: 'K', icon: 'grid', tables: ['products', 'sources'] },
  { id: 'people', name: 'People & Targets', color: '#12a5a5', abbr: 'T', icon: 'users', tables: ['team', 'targets', 'audit'] },
  // scorecardEntries is deliberately absent: corrections happen via its URL or
  // a measurable's Related panel, and the sidebar stays the weekly ritual.
  { id: 'traction', name: 'Traction', color: '#c2415f', abbr: 'E', icon: 'compass', tables: ['meetings', 'rocks', 'measurables', 'todos', 'issues'] },
] as const

/* ----------------------------------------------------------------- tables */

const PHASE_1: Partial<Record<TableId, TableConfig>> = {
  deals: {
    id: 'deals',
    name: 'Deals',
    singular: 'deal',
    icon: 'euro',
    color: '#1c8c5a',
    space: 'sales',
    views: [
      { id: 'board', name: 'Pipeline', type: 'board', icon: 'board', groupBy: 'stage', sumBy: 'tcv' },
      { id: 'grid', name: 'All deals', type: 'grid', icon: 'grid' },
      {
        id: 'timeline', name: 'Close forecast', type: 'timeline', icon: 'timeline',
        startField: 'createdAt', endField: 'expectedCloseDate', colorField: 'stage', labelField: 'stage',
      },
    ],
    fields: [
      { id: 'name', label: 'Deal', type: 'text', width: 250, primary: true },
      { id: 'stage', label: 'Stage', type: 'select', width: 128, options: DEAL_STAGE_OPTIONS },
      { id: 'organizationId', label: 'Company', type: 'link', width: 170, linkTo: 'organizations' },
      { id: 'ownerId', label: 'Owner', type: 'user', width: 150, linkTo: 'team' },
      { id: 'tcv', label: 'TCV', type: 'currency', width: 110, computed: true },
      { id: 'mrr', label: 'MRR', type: 'currency', width: 100, computed: true },
      { id: 'oneOff', label: 'One-off', type: 'currency', width: 105, computed: true },
      { id: 'probability', label: 'Prob.', type: 'percent', width: 80, computed: true },
      { id: 'weighted', label: 'Weighted', type: 'currency', width: 112, computed: true },
      { id: 'expectedCloseDate', label: 'Expected close', type: 'date', width: 126 },
      { id: 'type', label: 'Deal type', type: 'select', width: 116, options: DEAL_TYPE },
      { id: 'hygiene', label: 'Hygiene', type: 'flag', width: 156, computed: true },
      { id: 'nextStep', label: 'Next step', type: 'text', width: 230 },
      { id: 'nextStepDate', label: 'Next step due', type: 'date', width: 124 },
      { id: 'daysInStage', label: 'Days in stage', type: 'number', width: 118, computed: true },
      { id: 'forecast', label: 'Forecast', type: 'select', width: 118, options: FORECAST },
      { id: 'motion', label: 'Motion', type: 'select', width: 128, options: DEAL_MOTION, secondary: true },
      { id: 'primaryContactId', label: 'Primary contact', type: 'link', width: 170, linkTo: 'contacts', secondary: true },
      { id: 'sourceId', label: 'Source', type: 'link', width: 150, linkTo: 'sources', secondary: true },
      { id: 'contractMonths', label: 'Contract months', type: 'number', width: 138, secondary: true },
      { id: 'qualification', label: 'Qualification', type: 'progress', width: 130, computed: true, secondary: true },
      { id: 'championIdentified', label: 'Champion identified', type: 'check', width: 156, secondary: true },
      { id: 'economicBuyerIdentified', label: 'Economic buyer identified', type: 'check', width: 190, secondary: true },
      { id: 'painDocumented', label: 'Pain documented', type: 'check', width: 150, secondary: true },
      { id: 'decisionProcessDocumented', label: 'Decision process documented', type: 'check', width: 200, secondary: true },
      { id: 'lossReason', label: 'Loss reason', type: 'select', width: 160, options: LOSS_REASON, secondary: true },
      { id: 'lossNotes', label: 'Loss notes', type: 'longtext', width: 240, secondary: true },
      { id: 'actualCloseDate', label: 'Actual close', type: 'date', width: 118, secondary: true },
      { id: 'createdAt', label: 'Created', type: 'date', width: 110, computed: true, secondary: true },
      { id: 'notes', label: 'Notes', type: 'longtext', width: 260, secondary: true },
    ],
  },

  organizations: {
    id: 'organizations',
    name: 'Organizations',
    singular: 'company',
    icon: 'users',
    color: '#3b93e0',
    space: 'sales',
    views: [
      { id: 'grid', name: 'All companies', type: 'grid', icon: 'grid' },
      { id: 'board', name: 'By lifecycle', type: 'board', icon: 'board', groupBy: 'lifecycle', sumBy: 'openPipeline' },
    ],
    fields: [
      { id: 'name', label: 'Company', type: 'text', width: 215, primary: true },
      { id: 'lifecycle', label: 'Lifecycle', type: 'select', width: 124, options: LIFECYCLE },
      { id: 'types', label: 'Type', type: 'multi', width: 172, options: ORG_TYPE },
      { id: 'segment', label: 'Segment', type: 'select', width: 118, options: SEGMENT },
      { id: 'country', label: 'Country', type: 'text', width: 108 },
      { id: 'ownerId', label: 'Owner', type: 'user', width: 150, linkTo: 'team' },
      { id: 'openPipeline', label: 'Open pipeline', type: 'currency', width: 128, computed: true },
      { id: 'dealCount', label: 'Deals', type: 'number', width: 84, computed: true },
      { id: 'lastActivity', label: 'Last activity', type: 'date', width: 118, computed: true },
      { id: 'daysSinceContact', label: 'Days since contact', type: 'number', width: 146, computed: true },
      { id: 'domain', label: 'Domain', type: 'text', width: 160 },
      { id: 'sourceId', label: 'Source', type: 'link', width: 150, linkTo: 'sources', secondary: true },
      { id: 'legalName', label: 'Legal name', type: 'text', width: 190, secondary: true },
      { id: 'city', label: 'City', type: 'text', width: 130, secondary: true },
      { id: 'industry', label: 'Industry', type: 'text', width: 150, secondary: true },
      { id: 'employeeCount', label: 'Employees', type: 'number', width: 110, secondary: true },
      { id: 'website', label: 'Website', type: 'text', width: 180, secondary: true },
      { id: 'vatId', label: 'VAT ID', type: 'text', width: 150, secondary: true },
      { id: 'notes', label: 'Notes', type: 'longtext', width: 260, secondary: true },
    ],
  },

  contacts: {
    id: 'contacts',
    name: 'Contacts',
    singular: 'contact',
    icon: 'user',
    color: '#12a5a5',
    space: 'sales',
    views: [{ id: 'grid', name: 'All contacts', type: 'grid', icon: 'grid' }],
    fields: [
      { id: 'name', label: 'Name', type: 'text', width: 185, primary: true, computed: true },
      { id: 'organizationId', label: 'Company', type: 'link', width: 180, linkTo: 'organizations' },
      { id: 'title', label: 'Title', type: 'text', width: 180 },
      { id: 'persona', label: 'Persona', type: 'select', width: 158, options: PERSONA },
      { id: 'email', label: 'Email', type: 'text', width: 215 },
      { id: 'status', label: 'Status', type: 'select', width: 130, options: CONTACT_STATUS },
      { id: 'ownerId', label: 'Owner', type: 'user', width: 150, linkTo: 'team' },
      { id: 'lastContacted', label: 'Last contacted', type: 'date', width: 130, computed: true },
      { id: 'firstName', label: 'First name', type: 'text', width: 140, secondary: true },
      { id: 'lastName', label: 'Last name', type: 'text', width: 140, secondary: true },
      { id: 'phone', label: 'Phone', type: 'text', width: 150, secondary: true },
      { id: 'marketingOptIn', label: 'Marketing opt-in', type: 'check', width: 140, secondary: true },
      { id: 'language', label: 'Language', type: 'text', width: 120, secondary: true },
      { id: 'linkedin', label: 'LinkedIn', type: 'text', width: 180, secondary: true },
      { id: 'notes', label: 'Notes', type: 'longtext', width: 260, secondary: true },
    ],
  },

  activities: {
    id: 'activities',
    name: 'Activities',
    singular: 'activity',
    icon: 'bell',
    color: '#64748b',
    space: 'sales',
    views: [{ id: 'grid', name: 'Recent', type: 'grid', icon: 'grid' }],
    fields: [
      { id: 'subject', label: 'Subject', type: 'text', width: 290, primary: true },
      { id: 'type', label: 'Type', type: 'select', width: 124, options: ACTIVITY_TYPE },
      { id: 'organizationId', label: 'Company', type: 'link', width: 180, linkTo: 'organizations' },
      { id: 'dealId', label: 'Deal', type: 'link', width: 230, linkTo: 'deals' },
      { id: 'contactId', label: 'Contact', type: 'link', width: 170, linkTo: 'contacts' },
      { id: 'ownerId', label: 'Owner', type: 'user', width: 150, linkTo: 'team' },
      { id: 'occurredAt', label: 'Date', type: 'date', width: 116 },
      { id: 'outcome', label: 'Outcome', type: 'select', width: 138, options: OUTCOME },
      { id: 'nextStep', label: 'Next step', type: 'text', width: 220, secondary: true },
      { id: 'nextStepDue', label: 'Next step due', type: 'date', width: 128, secondary: true },
      { id: 'durationMinutes', label: 'Duration (min)', type: 'number', width: 126, secondary: true },
      { id: 'notes', label: 'Notes', type: 'longtext', width: 280, secondary: true },
    ],
  },

  products: {
    id: 'products',
    name: 'Products & Plans',
    singular: 'product',
    icon: 'target',
    color: '#e0a020',
    space: 'catalogue',
    views: [
      { id: 'grid', name: 'Catalogue', type: 'grid', icon: 'grid' },
      { id: 'board', name: 'By type', type: 'board', icon: 'board', groupBy: 'type' },
    ],
    fields: [
      { id: 'name', label: 'Product', type: 'text', width: 230, primary: true },
      { id: 'type', label: 'Type', type: 'select', width: 130, options: PRODUCT_TYPE },
      { id: 'listPriceCents', label: 'List price', type: 'currency', width: 118 },
      { id: 'billing', label: 'Billing', type: 'select', width: 130, options: BILLING },
      { id: 'unit', label: 'Unit', type: 'text', width: 130 },
      { id: 'costToServeCents', label: 'Cost to serve', type: 'currency', width: 130 },
      { id: 'grossMargin', label: 'Gross margin', type: 'percent', width: 126, computed: true },
      { id: 'active', label: 'Active', type: 'check', width: 90 },
      { id: 'description', label: 'Description', type: 'longtext', width: 280, secondary: true },
    ],
  },

  sources: {
    id: 'sources',
    name: 'Sources',
    singular: 'source',
    icon: 'link',
    color: '#7c6cf0',
    space: 'catalogue',
    views: [{ id: 'grid', name: 'All sources', type: 'grid', icon: 'grid' }],
    fields: [
      { id: 'name', label: 'Source', type: 'text', width: 220, primary: true },
      { id: 'category', label: 'Category', type: 'select', width: 140, options: SOURCE_CATEGORY },
      { id: 'active', label: 'Active', type: 'check', width: 90 },
      { id: 'monthlyCostCents', label: 'Monthly cost', type: 'currency', width: 130 },
      { id: 'orgCount', label: 'Companies', type: 'number', width: 112, computed: true },
      { id: 'dealCount', label: 'Deals', type: 'number', width: 92, computed: true },
    ],
  },

  team: {
    id: 'team',
    name: 'Team',
    singular: 'member',
    icon: 'users',
    color: '#12a5a5',
    space: 'people',
    views: [{ id: 'grid', name: 'All members', type: 'grid', icon: 'grid' }],
    fields: [
      { id: 'name', label: 'Name', type: 'text', width: 190, primary: true },
      { id: 'role', label: 'Role', type: 'select', width: 152, options: MEMBER_ROLE },
      { id: 'department', label: 'Department', type: 'select', width: 136, options: DEPARTMENT },
      { id: 'status', label: 'Status', type: 'select', width: 116, options: MEMBER_STATUS },
      { id: 'email', label: 'Email', type: 'text', width: 220 },
      { id: 'weeklyCapacityHours', label: 'Capacity (h/wk)', type: 'number', width: 136 },
      { id: 'openDeals', label: 'Open deals', type: 'number', width: 116, computed: true },
      { id: 'openPipeline', label: 'Open pipeline', type: 'currency', width: 130, computed: true },
      { id: 'timezone', label: 'Timezone', type: 'text', width: 150, secondary: true },
      { id: 'startDate', label: 'Start date', type: 'date', width: 116, secondary: true },
    ],
  },

  targets: {
    id: 'targets',
    name: 'Targets',
    singular: 'target',
    icon: 'target',
    color: '#e2597a',
    space: 'people',
    views: [{ id: 'grid', name: 'All targets', type: 'grid', icon: 'grid' }],
    fields: [
      { id: 'period', label: 'Period', type: 'text', width: 130, primary: true },
      { id: 'metric', label: 'Metric', type: 'select', width: 180, options: TARGET_METRIC },
      { id: 'scope', label: 'Scope', type: 'select', width: 130, options: TARGET_SCOPE },
      { id: 'teamMemberId', label: 'Team member', type: 'user', width: 170, linkTo: 'team' },
      { id: 'displayValue', label: 'Target', type: 'text', width: 150, computed: true },
      { id: 'value', label: 'Raw value', type: 'number', width: 130, secondary: true },
    ],
  },
}

/* ------------------------------------------------------- Phase 2 tables */

const PHASE_2: Partial<Record<TableId, TableConfig>> = {
  portfolio: {
    id: 'portfolio',
    name: 'Portfolio',
    singular: 'product',
    icon: 'bolt',
    color: '#8b5cf6',
    space: 'portfolio',
    views: [
      { id: 'board', name: 'By status', type: 'board', icon: 'board', groupBy: 'status', sumBy: 'wonValue' },
      { id: 'grid', name: 'All products', type: 'grid', icon: 'grid' },
    ],
    fields: [
      { id: 'name', label: 'Product', type: 'text', width: 200, primary: true },
      { id: 'status', label: 'Status', type: 'select', width: 130, options: PORTFOLIO_STATUS },
      { id: 'ownerId', label: 'Owner', type: 'user', width: 150, linkTo: 'team' },
      { id: 'wonValue', label: 'Won TCV', type: 'currency', width: 118, computed: true },
      { id: 'pipelineValue', label: 'Open pipeline', type: 'currency', width: 130, computed: true },
      { id: 'buildCost', label: 'Build cost', type: 'currency', width: 118, computed: true },
      { id: 'contribution', label: 'Contribution', type: 'currency', width: 128, computed: true },
      { id: 'loggedTime', label: 'Time logged', type: 'duration', width: 120, computed: true },
      { id: 'openTasks', label: 'Open tasks', type: 'number', width: 110, computed: true },
      { id: 'activeProjects', label: 'Projects', type: 'number', width: 96, computed: true },
      { id: 'launchedAt', label: 'Launched', type: 'date', width: 112 },
      { id: 'slug', label: 'Slug', type: 'text', width: 120, secondary: true },
      { id: 'description', label: 'Description', type: 'longtext', width: 300, secondary: true },
      { id: 'repoUrl', label: 'Repository', type: 'text', width: 200, secondary: true },
      { id: 'productionUrl', label: 'Production URL', type: 'text', width: 200, secondary: true },
      { id: 'active', label: 'Active', type: 'check', width: 90, secondary: true },
    ],
  },

  projects: {
    id: 'projects',
    name: 'Projects',
    singular: 'project',
    icon: 'board',
    color: '#d97757',
    space: 'delivery',
    views: [
      { id: 'board', name: 'Delivery board', type: 'board', icon: 'board', groupBy: 'status', sumBy: 'contractValueCents' },
      { id: 'grid', name: 'All projects', type: 'grid', icon: 'grid' },
      {
        id: 'timeline', name: 'Delivery timeline', type: 'timeline', icon: 'timeline',
        startField: 'startDate', endField: 'targetLaunch', colorField: 'health', labelField: 'status',
      },
    ],
    fields: [
      { id: 'name', label: 'Project', type: 'text', width: 270, primary: true },
      { id: 'status', label: 'Status', type: 'select', width: 124, options: PROJECT_STATUS },
      { id: 'health', label: 'Health', type: 'select', width: 104, options: HEALTH },
      { id: 'organizationId', label: 'Client', type: 'link', width: 170, linkTo: 'organizations' },
      { id: 'portfolioProductId', label: 'Product', type: 'link', width: 150, linkTo: 'portfolio' },
      { id: 'pmId', label: 'PM', type: 'user', width: 150, linkTo: 'team' },
      { id: 'percentComplete', label: '% Complete', type: 'progress', width: 132, computed: true },
      { id: 'burn', label: 'Budget burn', type: 'progress', width: 132, computed: true },
      { id: 'budgetWarning', label: 'Budget', type: 'flag', width: 172, computed: true },
      { id: 'contractValueCents', label: 'Contract value', type: 'currency', width: 132 },
      { id: 'marginBps', label: 'Margin', type: 'percent', width: 96, computed: true },
      { id: 'targetLaunch', label: 'Target launch', type: 'date', width: 124 },
      { id: 'slipDays', label: 'Slip (days)', type: 'number', width: 108, computed: true },
      { id: 'openBlockers', label: 'Blockers', type: 'number', width: 100, computed: true },
      { id: 'healthNote', label: 'Health note', type: 'text', width: 300 },
      { id: 'type', label: 'Type', type: 'select', width: 148, options: PROJECT_TYPE },
      { id: 'dealId', label: 'Deal', type: 'link', width: 230, linkTo: 'deals', secondary: true },
      { id: 'startDate', label: 'Start', type: 'date', width: 110, secondary: true },
      { id: 'baselineLaunch', label: 'Baseline launch', type: 'date', width: 136, secondary: true },
      { id: 'actualLaunch', label: 'Actual launch', type: 'date', width: 126, secondary: true },
      { id: 'budgetMinutes', label: 'Budget', type: 'duration', width: 110, secondary: true },
      { id: 'loggedMinutes', label: 'Logged', type: 'duration', width: 110, computed: true, secondary: true },
      { id: 'remainingMinutes', label: 'Remaining', type: 'duration', width: 116, computed: true, secondary: true },
      { id: 'internalCostCents', label: 'Internal cost', type: 'currency', width: 128, computed: true, secondary: true },
      { id: 'scopeSummary', label: 'Scope summary', type: 'longtext', width: 320, secondary: true },
      { id: 'repoUrl', label: 'Repository', type: 'text', width: 200, secondary: true },
      { id: 'stagingUrl', label: 'Staging URL', type: 'text', width: 200, secondary: true },
      { id: 'notes', label: 'Notes', type: 'longtext', width: 280, secondary: true },
    ],
  },

  milestones: {
    id: 'milestones',
    name: 'Milestones',
    singular: 'milestone',
    icon: 'target',
    color: '#e0a020',
    space: 'delivery',
    views: [
      {
        id: 'timeline', name: 'Milestone timeline', type: 'timeline', icon: 'timeline',
        startField: 'startDate', endField: 'dueDate', colorField: 'status', labelField: 'status',
      },
      { id: 'grid', name: 'All milestones', type: 'grid', icon: 'grid' },
      { id: 'board', name: 'By status', type: 'board', icon: 'board', groupBy: 'status', sumBy: 'invoiceAmountCents' },
    ],
    fields: [
      { id: 'name', label: 'Milestone', type: 'text', width: 240, primary: true },
      { id: 'projectId', label: 'Project', type: 'link', width: 240, linkTo: 'projects' },
      { id: 'status', label: 'Status', type: 'select', width: 128, options: MILESTONE_STATUS },
      { id: 'phase', label: 'Phase', type: 'select', width: 160, options: MILESTONE_PHASE },
      { id: 'ownerId', label: 'Owner', type: 'user', width: 150, linkTo: 'team' },
      { id: 'dueDate', label: 'Due', type: 'date', width: 110 },
      { id: 'slipDays', label: 'Slip (days)', type: 'number', width: 110, computed: true },
      { id: 'weightBps', label: 'Weight', type: 'percent', width: 96 },
      { id: 'paymentTrigger', label: 'Invoices', type: 'check', width: 96 },
      { id: 'invoiceAmountCents', label: 'Invoice amount', type: 'currency', width: 138 },
      { id: 'clientSignOffRequired', label: 'Sign-off needed', type: 'check', width: 138 },
      { id: 'startDate', label: 'Start', type: 'date', width: 110, secondary: true },
      { id: 'baselineDue', label: 'Baseline due', type: 'date', width: 124, secondary: true },
      { id: 'completedDate', label: 'Completed', type: 'date', width: 118, secondary: true },
      { id: 'sequence', label: 'Sequence', type: 'number', width: 104, secondary: true },
      { id: 'signedOffById', label: 'Signed off by', type: 'link', width: 170, linkTo: 'contacts', secondary: true },
      { id: 'signedOffDate', label: 'Sign-off date', type: 'date', width: 124, secondary: true },
      { id: 'acceptanceCriteria', label: 'Acceptance criteria', type: 'longtext', width: 340, secondary: true },
    ],
  },

  tasks: {
    id: 'tasks',
    name: 'Tasks',
    singular: 'task',
    icon: 'check',
    color: '#7c6cf0',
    space: 'portfolio',
    views: [
      { id: 'board', name: 'Board', type: 'board', icon: 'board', groupBy: 'status', sumBy: 'estimateMinutes' },
      { id: 'grid', name: 'All tasks', type: 'grid', icon: 'grid' },
    ],
    fields: [
      { id: 'title', label: 'Task', type: 'text', width: 300, primary: true },
      { id: 'status', label: 'Status', type: 'select', width: 124, options: TASK_STATUS },
      { id: 'priority', label: 'Priority', type: 'select', width: 168, options: PRIORITY },
      { id: 'type', label: 'Type', type: 'select', width: 110, options: TASK_TYPE },
      { id: 'assigneeId', label: 'Assignee', type: 'user', width: 150, linkTo: 'team' },
      { id: 'blocked', label: 'Blocked', type: 'check', width: 92 },
      { id: 'blockedReason', label: 'Blocked reason', type: 'text', width: 220 },
      { id: 'portfolioProductId', label: 'Product', type: 'link', width: 150, linkTo: 'portfolio' },
      { id: 'projectId', label: 'Project', type: 'link', width: 210, linkTo: 'projects' },
      { id: 'sprintId', label: 'Sprint', type: 'link', width: 120, linkTo: 'sprints' },
      { id: 'estimateMinutes', label: 'Estimate', type: 'duration', width: 110 },
      { id: 'loggedMinutes', label: 'Logged', type: 'duration', width: 106, computed: true },
      { id: 'dueDate', label: 'Due', type: 'date', width: 108 },
      { id: 'cycleTimeDays', label: 'Cycle time', type: 'number', width: 112, computed: true },
      { id: 'milestoneId', label: 'Milestone', type: 'link', width: 200, linkTo: 'milestones', secondary: true },
      { id: 'reviewerId', label: 'Reviewer', type: 'user', width: 150, linkTo: 'team', secondary: true },
      { id: 'severity', label: 'Severity', type: 'select', width: 118, options: SEVERITY, secondary: true },
      { id: 'reportSource', label: 'Reported by', type: 'select', width: 138, options: REPORT_SOURCE, secondary: true },
      { id: 'startDate', label: 'Start', type: 'date', width: 108, secondary: true },
      { id: 'acceptanceCriteria', label: 'Acceptance criteria', type: 'longtext', width: 320, secondary: true },
      { id: 'reproSteps', label: 'Repro steps', type: 'longtext', width: 320, secondary: true },
      { id: 'prUrl', label: 'Pull request', type: 'text', width: 200, secondary: true },
    ],
  },

  sprints: {
    id: 'sprints',
    name: 'Sprints',
    singular: 'sprint',
    icon: 'clock',
    color: '#12a5a5',
    space: 'portfolio',
    views: [{ id: 'grid', name: 'All sprints', type: 'grid', icon: 'grid' }],
    fields: [
      { id: 'name', label: 'Sprint', type: 'text', width: 130, primary: true },
      { id: 'status', label: 'Status', type: 'select', width: 116, options: SPRINT_STATUS },
      { id: 'goal', label: 'Goal', type: 'text', width: 360 },
      { id: 'startDate', label: 'Start', type: 'date', width: 110 },
      { id: 'endDate', label: 'End', type: 'date', width: 110 },
      { id: 'committedMinutes', label: 'Committed', type: 'duration', width: 118 },
      { id: 'completedMinutes', label: 'Completed', type: 'duration', width: 118, computed: true },
      { id: 'carryOverMinutes', label: 'Carry-over', type: 'duration', width: 118, computed: true },
      { id: 'taskCount', label: 'Tasks', type: 'number', width: 90, computed: true },
      { id: 'retroNotes', label: 'Retro notes', type: 'longtext', width: 320, secondary: true },
    ],
  },

  timeEntries: {
    id: 'timeEntries',
    name: 'Time',
    singular: 'time entry',
    icon: 'clock',
    color: '#3b93e0',
    space: 'capacity',
    views: [{ id: 'grid', name: 'Recent', type: 'grid', icon: 'grid' }],
    fields: [
      { id: 'label', label: 'Entry', type: 'text', width: 260, primary: true, computed: true },
      { id: 'teamMemberId', label: 'Member', type: 'user', width: 160, linkTo: 'team' },
      { id: 'workedOn', label: 'Date', type: 'date', width: 112 },
      { id: 'minutes', label: 'Time', type: 'duration', width: 100 },
      { id: 'projectId', label: 'Project', type: 'link', width: 240, linkTo: 'projects' },
      { id: 'taskId', label: 'Task', type: 'link', width: 260, linkTo: 'tasks' },
      { id: 'billable', label: 'Billable', type: 'check', width: 96 },
      { id: 'revenueCents', label: 'Value', type: 'currency', width: 110, computed: true },
      { id: 'costCents', label: 'Cost', type: 'currency', width: 110, computed: true },
      { id: 'invoiced', label: 'Invoiced', type: 'check', width: 100, computed: true },
      { id: 'invoiceId', label: 'Invoice', type: 'link', width: 150, linkTo: 'invoices', computed: true },
      { id: 'notes', label: 'Notes', type: 'text', width: 260, secondary: true },
    ],
  },

  allocations: {
    id: 'allocations',
    name: 'Allocations',
    singular: 'allocation',
    icon: 'users',
    color: '#3b93e0',
    space: 'capacity',
    views: [{ id: 'grid', name: 'This quarter', type: 'grid', icon: 'grid' }],
    fields: [
      { id: 'label', label: 'Allocation', type: 'text', width: 260, primary: true, computed: true },
      { id: 'teamMemberId', label: 'Member', type: 'user', width: 160, linkTo: 'team' },
      { id: 'weekStarting', label: 'Week of', type: 'date', width: 116 },
      { id: 'plannedMinutes', label: 'Planned', type: 'duration', width: 110 },
      { id: 'projectId', label: 'Project', type: 'link', width: 240, linkTo: 'projects' },
      { id: 'portfolioProductId', label: 'Product', type: 'link', width: 150, linkTo: 'portfolio' },
      { id: 'billable', label: 'Billable', type: 'check', width: 96 },
      { id: 'confidence', label: 'Confidence', type: 'select', width: 126, options: CONFIDENCE },
      { id: 'roleOnEngagement', label: 'Role', type: 'text', width: 180, secondary: true },
    ],
  },

  absences: {
    id: 'absences',
    name: 'Absences',
    singular: 'absence',
    icon: 'date',
    color: '#12a5a5',
    space: 'capacity',
    views: [{ id: 'grid', name: 'All absences', type: 'grid', icon: 'grid' }],
    fields: [
      { id: 'label', label: 'Absence', type: 'text', width: 240, primary: true, computed: true },
      { id: 'teamMemberId', label: 'Member', type: 'user', width: 160, linkTo: 'team' },
      { id: 'type', label: 'Type', type: 'select', width: 140, options: ABSENCE_TYPE },
      { id: 'startDate', label: 'From', type: 'date', width: 110 },
      { id: 'endDate', label: 'To', type: 'date', width: 110 },
      { id: 'workingDays', label: 'Working days', type: 'number', width: 130 },
      { id: 'approved', label: 'Approved', type: 'check', width: 106 },
    ],
  },

  changeRequests: {
    id: 'changeRequests',
    name: 'Change requests',
    singular: 'change request',
    icon: 'arrow',
    color: '#d97757',
    space: 'delivery',
    views: [
      { id: 'board', name: 'By status', type: 'board', icon: 'board', groupBy: 'status', sumBy: 'impactCostCents' },
      { id: 'grid', name: 'All requests', type: 'grid', icon: 'grid' },
    ],
    fields: [
      { id: 'title', label: 'Change request', type: 'text', width: 280, primary: true },
      { id: 'status', label: 'Status', type: 'select', width: 160, options: CR_STATUS },
      { id: 'projectId', label: 'Project', type: 'link', width: 240, linkTo: 'projects' },
      { id: 'requestedById', label: 'Requested by', type: 'link', width: 170, linkTo: 'contacts' },
      { id: 'impactMinutes', label: 'Effort', type: 'duration', width: 106 },
      { id: 'impactCostCents', label: 'Cost impact', type: 'currency', width: 124 },
      { id: 'impactDays', label: 'Timeline (days)', type: 'number', width: 132 },
      { id: 'raisedDate', label: 'Raised', type: 'date', width: 110 },
      { id: 'upsellDealId', label: 'Upsell deal', type: 'link', width: 230, linkTo: 'deals' },
      { id: 'approvedDate', label: 'Approved', type: 'date', width: 118, secondary: true },
      { id: 'description', label: 'Description', type: 'longtext', width: 340, secondary: true },
    ],
  },

  risks: {
    id: 'risks',
    name: 'Risks & issues',
    singular: 'risk',
    icon: 'warn',
    color: '#e2597a',
    space: 'delivery',
    views: [
      { id: 'grid', name: 'Open register', type: 'grid', icon: 'grid' },
      { id: 'board', name: 'By status', type: 'board', icon: 'board', groupBy: 'status' },
    ],
    fields: [
      { id: 'title', label: 'Risk or issue', type: 'text', width: 300, primary: true },
      { id: 'category', label: 'Category', type: 'select', width: 156, options: RISK_CATEGORY },
      { id: 'status', label: 'Status', type: 'select', width: 124, options: RISK_STATUS },
      { id: 'projectId', label: 'Project', type: 'link', width: 240, linkTo: 'projects' },
      { id: 'severity', label: 'Severity', type: 'number', width: 104, computed: true },
      { id: 'probability', label: 'Probability', type: 'select', width: 122, options: RISK_LEVEL },
      { id: 'impact', label: 'Impact', type: 'select', width: 112, options: RISK_LEVEL },
      { id: 'ownerId', label: 'Owner', type: 'user', width: 150, linkTo: 'team' },
      { id: 'targetDate', label: 'Target', type: 'date', width: 110 },
      { id: 'mitigation', label: 'Mitigation', type: 'longtext', width: 320 },
      { id: 'raisedDate', label: 'Raised', type: 'date', width: 110, secondary: true },
      { id: 'resolvedDate', label: 'Resolved', type: 'date', width: 114, secondary: true },
    ],
  },
}

/* ------------------------------------------------------- Revenue tables */

const REVENUE: Partial<Record<TableId, TableConfig>> = {
  /**
   * Clients is a view of organizations, not a table of its own — a customer is
   * an organization that reached the Customer lifecycle. Giving it a separate
   * table would mean two rows for the same company, drifting apart the first
   * time somebody corrects a name in one of them.
   */
  clients: {
    id: 'clients',
    name: 'Clients',
    singular: 'client',
    icon: 'users',
    color: '#0f9b8e',
    space: 'revenue',
    views: [
      { id: 'grid', name: 'All clients', type: 'grid', icon: 'grid' },
      { id: 'board', name: 'By temperature', type: 'board', icon: 'board', groupBy: 'temperature', sumBy: 'mrr' },
    ],
    fields: [
      { id: 'name', label: 'Client', type: 'text', width: 200, primary: true },
      { id: 'temperature', label: 'Temperature', type: 'select', width: 128, options: ACCOUNT_TEMPERATURE, computed: true },
      { id: 'healthNote', label: 'Why', type: 'text', width: 230, computed: true },
      { id: 'mrr', label: 'MRR', type: 'currency', width: 110, computed: true },
      { id: 'subscriptionStatus', label: 'Subscription', type: 'select', width: 128, options: SUBSCRIPTION_STATUS, computed: true },
      { id: 'renewsOn', label: 'Renews', type: 'date', width: 116, computed: true },
      { id: 'outstanding', label: 'Outstanding', type: 'currency', width: 124, computed: true },
      { id: 'overdue', label: 'Overdue', type: 'currency', width: 116, computed: true },
      { id: 'oldestOverdueDays', label: 'Oldest debt', type: 'number', width: 118, computed: true },
      { id: 'lastActivity', label: 'Last contact', type: 'date', width: 122, computed: true },
      { id: 'openPipeline', label: 'Open pipeline', type: 'currency', width: 128, computed: true },
      { id: 'ownerId', label: 'Owner', type: 'user', width: 150, linkTo: 'team' },
      { id: 'segment', label: 'Segment', type: 'select', width: 124, options: SEGMENT, secondary: true },
      { id: 'domain', label: 'Domain', type: 'text', width: 170, secondary: true },
      { id: 'notes', label: 'Notes', type: 'longtext', width: 240, secondary: true },
    ],
  },

  subscriptions: {
    id: 'subscriptions',
    name: 'Subscriptions',
    singular: 'subscription',
    icon: 'clock',
    color: '#12a5a5',
    space: 'revenue',
    views: [
      { id: 'grid', name: 'All subscriptions', type: 'grid', icon: 'grid' },
      { id: 'board', name: 'By status', type: 'board', icon: 'board', groupBy: 'status', sumBy: 'mrrCents' },
      {
        id: 'timeline', name: 'Renewals', type: 'timeline', icon: 'timeline',
        startField: 'startDate', endField: 'renewsOn', colorField: 'status', labelField: 'status',
      },
    ],
    fields: [
      { id: 'organizationId', label: 'Client', type: 'link', width: 200, linkTo: 'organizations', primary: true },
      { id: 'status', label: 'Status', type: 'select', width: 118, options: SUBSCRIPTION_STATUS },
      { id: 'portfolioProductId', label: 'Product', type: 'link', width: 150, linkTo: 'portfolio' },
      { id: 'mrrCents', label: 'MRR', type: 'currency', width: 110 },
      { id: 'renewsOn', label: 'Renews', type: 'date', width: 116 },
      { id: 'daysToRenewal', label: 'In days', type: 'number', width: 100, computed: true },
      { id: 'arrCents', label: 'ARR', type: 'currency', width: 116, computed: true },
      { id: 'termMonths', label: 'Term', type: 'number', width: 96 },
      { id: 'autoRenew', label: 'Auto-renew', type: 'check', width: 118 },
      { id: 'startDate', label: 'Started', type: 'date', width: 112 },
      { id: 'billing', label: 'Billing', type: 'select', width: 116, options: BILLING, secondary: true },
      { id: 'dealId', label: 'Source deal', type: 'link', width: 220, linkTo: 'deals', secondary: true },
      { id: 'ownerId', label: 'Owner', type: 'user', width: 150, linkTo: 'team', secondary: true },
      { id: 'endedOn', label: 'Ended', type: 'date', width: 112, secondary: true },
      { id: 'cancelReason', label: 'Cancel reason', type: 'text', width: 200, secondary: true },
      { id: 'notes', label: 'Notes', type: 'longtext', width: 240, secondary: true },
    ],
  },

  invoices: {
    id: 'invoices',
    name: 'Invoices',
    singular: 'invoice',
    icon: 'euro',
    color: '#e0a020',
    space: 'revenue',
    views: [
      { id: 'grid', name: 'All invoices', type: 'grid', icon: 'grid' },
      { id: 'board', name: 'By state', type: 'board', icon: 'board', groupBy: 'state', sumBy: 'outstandingCents' },
      {
        id: 'timeline', name: 'Due dates', type: 'timeline', icon: 'timeline',
        startField: 'issueDate', endField: 'dueDate', colorField: 'state', labelField: 'state',
      },
    ],
    fields: [
      { id: 'number', label: 'Invoice', type: 'text', width: 140, primary: true },
      { id: 'organizationId', label: 'Client', type: 'link', width: 190, linkTo: 'organizations' },
      { id: 'state', label: 'State', type: 'select', width: 118, options: INVOICE_STATE, computed: true },
      { id: 'totalCents', label: 'Total', type: 'currency', width: 116, computed: true },
      { id: 'paidCents', label: 'Paid', type: 'currency', width: 110, computed: true },
      { id: 'outstandingCents', label: 'Outstanding', type: 'currency', width: 124, computed: true },
      { id: 'dueDate', label: 'Due', type: 'date', width: 112 },
      { id: 'daysOverdue', label: 'Days late', type: 'number', width: 108, computed: true },
      { id: 'agingBucket', label: 'Aging', type: 'select', width: 116, options: AGING_BUCKET, computed: true },
      { id: 'status', label: 'Posted', type: 'select', width: 110, options: INVOICE_STATUS },
      { id: 'issueDate', label: 'Issued', type: 'date', width: 112, secondary: true },
      { id: 'amountCents', label: 'Net', type: 'currency', width: 110, secondary: true },
      { id: 'taxCents', label: 'Tax', type: 'currency', width: 104, secondary: true },
      { id: 'projectId', label: 'Project', type: 'link', width: 220, linkTo: 'projects', secondary: true },
      { id: 'subscriptionId', label: 'Subscription', type: 'link', width: 200, linkTo: 'subscriptions', secondary: true },
      { id: 'milestoneId', label: 'Milestone', type: 'link', width: 220, linkTo: 'milestones', secondary: true },
      { id: 'ownerId', label: 'Owner', type: 'user', width: 150, linkTo: 'team', secondary: true },
      { id: 'notes', label: 'Notes', type: 'longtext', width: 240, secondary: true },
    ],
  },

  payments: {
    id: 'payments',
    name: 'Payments',
    singular: 'payment',
    icon: 'check',
    color: '#1c8c5a',
    space: 'revenue',
    views: [
      { id: 'grid', name: 'All payments', type: 'grid', icon: 'grid' },
      {
        id: 'timeline', name: 'Received', type: 'timeline', icon: 'timeline',
        startField: 'paidOn', endField: 'paidOn', colorField: 'method', labelField: 'method',
      },
    ],
    fields: [
      { id: 'invoiceId', label: 'Invoice', type: 'link', width: 160, linkTo: 'invoices', primary: true },
      { id: 'client', label: 'Client', type: 'text', width: 190, computed: true },
      { id: 'amountCents', label: 'Amount', type: 'currency', width: 120 },
      { id: 'paidOn', label: 'Received', type: 'date', width: 116 },
      { id: 'method', label: 'Method', type: 'select', width: 140, options: PAYMENT_METHOD },
      { id: 'reference', label: 'Reference', type: 'text', width: 180 },
      { id: 'notes', label: 'Notes', type: 'longtext', width: 240, secondary: true },
    ],
  },
}

/**
 * The audit log, read-only and admin-only. Every field is computed so the grid
 * refuses to edit any of it — an audit trail you can edit is not one.
 */
const AUDIT: Partial<Record<TableId, TableConfig>> = {
  audit: {
    id: 'audit',
    name: 'Audit log',
    singular: 'entry',
    icon: 'clock',
    color: '#64748b',
    space: 'people',
    views: [{ id: 'grid', name: 'Recent changes', type: 'grid', icon: 'grid' }],
    fields: [
      { id: 'at', label: 'When', type: 'date', width: 120, primary: true, computed: true },
      { id: 'actor', label: 'Who', type: 'text', width: 190, computed: true },
      { id: 'action', label: 'Action', type: 'text', width: 100, computed: true },
      { id: 'tableId', label: 'Table', type: 'text', width: 140, computed: true },
      { id: 'summary', label: 'Record', type: 'text', width: 300, computed: true },
      { id: 'rowId', label: 'Row id', type: 'text', width: 280, computed: true, secondary: true },
      { id: 'payload', label: 'Full row', type: 'longtext', width: 400, computed: true, secondary: true },
    ],
  },
}

/* ------------------------------------------------------------- traction */

const MEETING_TYPE = opts(
  ['L10', 'Level 10', C.sky],
  ['Quarterly', 'Quarterly', C.violet],
  ['Annual', 'Annual', C.amber],
)

export const MEETING_STATUS = opts(
  ['Scheduled', 'Scheduled', C.gray],
  ['InProgress', 'In progress', C.amber],
  ['Concluded', 'Concluded', C.green],
)

const ROCK_SCOPE = opts(
  ['Company', 'Company', C.violet],
  ['Individual', 'Individual', C.sky],
)

export const ROCK_STATUS = opts(
  ['OnTrack', 'On track', C.green],
  ['OffTrack', 'Off track', C.rose],
  ['Done', 'Done', C.teal],
  ['Dropped', 'Dropped', C.gray],
)

export const MEASURABLE_UNIT = opts(
  ['Money', 'Money (€)', C.green],
  ['Percent', 'Percent', C.sky],
  ['Count', 'Count', C.gray],
)

export const MEASURABLE_DIRECTION = opts(
  ['AtLeast', 'At least', C.green],
  ['AtMost', 'At most', C.amber],
)

export const EOS_ISSUE_STATUS = opts(
  ['Open', 'Open', C.amber],
  ['Solved', 'Solved', C.green],
  ['Dropped', 'Dropped', C.gray],
)

/** Rocks are quarterly by definition — stricter than TARGET_PERIOD_PATTERN (no months). */
export const ROCK_QUARTER_PATTERN = /^\d{4}-Q[1-4]$/

/**
 * The agenda each meeting type runs, in order. Segment ids key the run page's
 * interactive panels — an id it does not recognise renders the hint as an
 * instruction card, which is how the Quarterly and Annual agendas mostly work.
 */
export const MEETING_AGENDA: Record<string, { id: string; name: string; minutes: number; hint: string }[]> = {
  L10: [
    { id: 'segue', name: 'Segue', minutes: 5, hint: 'Good news, personal and business. 90 seconds each.' },
    { id: 'scorecard', name: 'Scorecard review', minutes: 5, hint: 'On track or off track. Off-track drops to the issues list — no discussion here.' },
    { id: 'rocks', name: 'Rock review', minutes: 5, hint: 'On track or off track, nothing else. Off-track drops down.' },
    { id: 'headlines', name: 'Customer & employee headlines', minutes: 5, hint: 'One-sentence headlines. Anything bigger becomes an issue.' },
    { id: 'todos', name: 'To-do list', minutes: 5, hint: 'Done or not done. The bar is 90%.' },
    { id: 'ids', name: 'IDS', minutes: 60, hint: 'Pick the three most important. Identify, Discuss, Solve — solved means a to-do.' },
    { id: 'conclude', name: 'Conclude', minutes: 5, hint: 'Recap to-dos, agree cascading messages, rate the meeting 1–10.' },
  ],
  Quarterly: [
    { id: 'segue', name: 'Segue', minutes: 30, hint: 'Best business and personal highlights of the quarter.' },
    { id: 'review', name: 'Review the prior quarter', minutes: 60, hint: 'Numbers first, then each rock: done or not done. No partial credit.' },
    { id: 'rocks', name: 'Rock review', minutes: 30, hint: 'Close out the quarter’s rocks before setting new ones.' },
    { id: 'vto', name: 'V/TO review', minutes: 60, hint: 'Re-read the vision. Argue with it now or live with it for ninety days.' },
    { id: 'setrocks', name: 'Set next quarter’s rocks', minutes: 120, hint: 'Three to seven per person, one owner each. Create them in Rocks as you go.' },
    { id: 'ids', name: 'IDS', minutes: 180, hint: 'The quarter’s big issues, worked with the whole day’s context.' },
    { id: 'conclude', name: 'Next steps and conclude', minutes: 30, hint: 'Who says what to whom. Rate the day 1–10.' },
  ],
  Annual: [
    { id: 'segue', name: 'Segue', minutes: 30, hint: 'The year’s highlights, personal and business.' },
    { id: 'review', name: 'Review the year', minutes: 90, hint: 'Numbers, rocks, and what the scorecard says about the year.' },
    { id: 'team', name: 'Team health', minutes: 120, hint: 'One conversation, everybody honest. This is the point of the day.' },
    { id: 'vto', name: 'V/TO — the full pass', minutes: 180, hint: 'Core values, focus, ten-year target, marketing strategy, three-year picture.' },
    { id: 'plan', name: 'One-year plan', minutes: 120, hint: 'Revenue, profit, and the measurables for next year.' },
    { id: 'setrocks', name: 'Set Q1 rocks', minutes: 90, hint: 'The first quarter of the new plan, owned and dated.' },
    { id: 'ids', name: 'IDS', minutes: 120, hint: 'Whatever the day surfaced.' },
    { id: 'conclude', name: 'Conclude', minutes: 30, hint: 'Cascading messages and a rating for the day.' },
  ],
}

/**
 * The operating cadence. These configs are deliberately thin: a meeting is run
 * from its own page, not from the grid, and everything else is a light list.
 */
const TRACTION: Partial<Record<TableId, TableConfig>> = {
  meetings: {
    id: 'meetings',
    name: 'Meetings',
    singular: 'meeting',
    icon: 'date',
    color: '#c2415f',
    space: 'traction',
    views: [
      { id: 'grid', name: 'All meetings', type: 'grid', icon: 'grid' },
      {
        id: 'timeline', name: 'Calendar', type: 'timeline', icon: 'timeline',
        startField: 'heldOn', endField: 'heldOn', colorField: 'type', labelField: 'status',
      },
    ],
    fields: [
      { id: 'label', label: 'Meeting', type: 'text', width: 220, primary: true, computed: true },
      { id: 'type', label: 'Type', type: 'select', width: 116, options: MEETING_TYPE },
      { id: 'heldOn', label: 'Held on', type: 'date', width: 118 },
      { id: 'status', label: 'Status', type: 'select', width: 130, options: MEETING_STATUS },
      { id: 'ownerId', label: 'Runs it', type: 'user', width: 150, linkTo: 'team' },
      { id: 'rating', label: 'Rating', type: 'number', width: 92, computed: true },
      { id: 'durationMinutes', label: 'Length', type: 'duration', width: 100 },
      { id: 'headlines', label: 'Headlines', type: 'longtext', width: 320, secondary: true },
      { id: 'cascadingMessages', label: 'Cascading messages', type: 'longtext', width: 320, secondary: true },
      { id: 'notes', label: 'Notes', type: 'longtext', width: 320, secondary: true },
    ],
  },

  rocks: {
    id: 'rocks',
    name: 'Rocks',
    singular: 'rock',
    icon: 'target',
    color: '#c2415f',
    space: 'traction',
    views: [
      { id: 'board', name: 'By status', type: 'board', icon: 'board', groupBy: 'status' },
      { id: 'grid', name: 'All rocks', type: 'grid', icon: 'grid' },
    ],
    fields: [
      { id: 'title', label: 'Rock', type: 'text', width: 300, primary: true },
      { id: 'quarter', label: 'Quarter', type: 'text', width: 104 },
      { id: 'status', label: 'Status', type: 'select', width: 118, options: ROCK_STATUS },
      { id: 'scope', label: 'Scope', type: 'select', width: 118, options: ROCK_SCOPE },
      { id: 'ownerId', label: 'Owner', type: 'user', width: 150, linkTo: 'team' },
      { id: 'dueDate', label: 'Due', type: 'date', width: 110 },
      { id: 'daysLeft', label: 'Days left', type: 'number', width: 100, computed: true },
      { id: 'notes', label: 'Notes', type: 'longtext', width: 320, secondary: true },
    ],
  },

  measurables: {
    id: 'measurables',
    name: 'Scorecard',
    singular: 'measurable',
    icon: 'num',
    color: '#c2415f',
    space: 'traction',
    views: [{ id: 'grid', name: 'Measurables', type: 'grid', icon: 'grid' }],
    fields: [
      { id: 'name', label: 'Measurable', type: 'text', width: 240, primary: true },
      { id: 'ownerId', label: 'Owner', type: 'user', width: 150, linkTo: 'team' },
      { id: 'unit', label: 'Unit', type: 'select', width: 110, options: MEASURABLE_UNIT },
      { id: 'direction', label: 'Direction', type: 'select', width: 106, options: MEASURABLE_DIRECTION },
      { id: 'goal', label: 'Goal', type: 'text', width: 110, computed: true },
      { id: 'latest', label: 'Latest week', type: 'text', width: 120, computed: true },
      { id: 'hitRate13', label: 'Hit rate (13w)', type: 'percent', width: 122, computed: true },
      { id: 'active', label: 'Active', type: 'check', width: 86 },
      { id: 'sequence', label: 'Order', type: 'number', width: 88, secondary: true },
      /** Cents / bps / count — same tri-unit convention as a target's Raw value. */
      { id: 'goalValue', label: 'Goal (raw)', type: 'number', width: 110, secondary: true },
      { id: 'notes', label: 'Where the number comes from', type: 'longtext', width: 320, secondary: true },
    ],
  },

  scorecardEntries: {
    id: 'scorecardEntries',
    name: 'Scorecard entries',
    singular: 'entry',
    icon: 'grid',
    color: '#c2415f',
    space: 'traction',
    views: [{ id: 'grid', name: 'All entries', type: 'grid', icon: 'grid' }],
    fields: [
      { id: 'display', label: 'Entry', type: 'text', width: 260, primary: true, computed: true },
      { id: 'measurableId', label: 'Measurable', type: 'link', width: 220, linkTo: 'measurables' },
      { id: 'weekStarting', label: 'Week of', type: 'date', width: 118 },
      /** Raw units — cents/bps/count, like a target's Raw value. displayValue is the readable one. */
      { id: 'value', label: 'Value (raw)', type: 'number', width: 110 },
      { id: 'displayValue', label: 'Value', type: 'text', width: 110, computed: true },
      { id: 'notes', label: 'Notes', type: 'longtext', width: 300, secondary: true },
    ],
  },

  todos: {
    id: 'todos',
    name: 'To-dos',
    singular: 'to-do',
    icon: 'check',
    color: '#c2415f',
    space: 'traction',
    views: [{ id: 'grid', name: 'All to-dos', type: 'grid', icon: 'grid' }],
    fields: [
      { id: 'title', label: 'To-do', type: 'text', width: 320, primary: true },
      { id: 'ownerId', label: 'Owner', type: 'user', width: 150, linkTo: 'team' },
      { id: 'done', label: 'Done', type: 'check', width: 84 },
      { id: 'dueDate', label: 'Due', type: 'date', width: 110 },
      { id: 'late', label: 'Late', type: 'flag', width: 120, computed: true },
      { id: 'meetingId', label: 'Raised in', type: 'link', width: 180, linkTo: 'meetings' },
      { id: 'notes', label: 'Notes', type: 'longtext', width: 300, secondary: true },
    ],
  },

  issues: {
    id: 'issues',
    name: 'Issues',
    singular: 'issue',
    icon: 'warn',
    color: '#c2415f',
    space: 'traction',
    views: [
      { id: 'board', name: 'IDS board', type: 'board', icon: 'board', groupBy: 'status' },
      { id: 'grid', name: 'All issues', type: 'grid', icon: 'grid' },
    ],
    fields: [
      { id: 'title', label: 'Issue', type: 'text', width: 340, primary: true },
      { id: 'status', label: 'Status', type: 'select', width: 112, options: EOS_ISSUE_STATUS },
      { id: 'ownerId', label: 'Owner', type: 'user', width: 150, linkTo: 'team' },
      { id: 'ageDays', label: 'Age (days)', type: 'number', width: 104, computed: true },
      { id: 'solvedInMeetingId', label: 'Solved in', type: 'link', width: 180, linkTo: 'meetings' },
      { id: 'notes', label: 'Notes', type: 'longtext', width: 300, secondary: true },
    ],
  },
}

export const TABLES = { ...PHASE_1, ...PHASE_2, ...REVENUE, ...AUDIT, ...TRACTION } as Record<TableId, TableConfig>

/**
 * What the New-record form asks for, per table.
 *
 * `required` mirrors the notNull columns that have no database default — get one
 * wrong and the insert fails with a constraint error instead of a sentence. Any
 * other writable, non-computed field is offered as optional; `hide` drops the
 * ones a person should not be setting by hand at creation time.
 *
 * Some tables need more than a field list. Those invariants live server-side in
 * createRecord, because a form cannot be trusted to hold them: time entries must
 * snapshot the member's rates, a subscription's renewal date follows from its
 * term, and milestone weights have to total 10000 basis points across a project.
 */
export type CreateSpec = {
  required: string[]
  hide?: string[]
  /** Shown under the title, for tables where the rules are not obvious. */
  note?: string
}

export const CREATE_SPEC: Partial<Record<TableId, CreateSpec>> = {
  clients: {
    required: ['name', 'domain'],
    note: 'Creates an organization already marked as a customer, so it appears here immediately.',
  },
  subscriptions: {
    required: ['organizationId', 'startDate', 'termMonths', 'mrrCents'],
    hide: ['renewsOn', 'endedOn', 'cancelReason'],
    note: 'The renewal date is calculated from the start date and term.',
  },
  contacts: { required: ['firstName', 'lastName', 'email', 'organizationId'] },
  activities: {
    required: ['subject', 'type', 'occurredAt'],
    note: 'Logged activity is what keeps a client from drifting to Cold.',
  },
  products: { required: ['name', 'type', 'listPriceCents', 'billing'] },
  sources: { required: ['name', 'category'] },
  portfolio: {
    required: ['name', 'slug'],
    note: 'A product the house owns and builds. Slug must be unique.',
  },
  projects: {
    required: ['name'],
    hide: ['actualLaunch'],
    note: 'Winning a Project, Hybrid or Retainer deal creates one of these automatically, with milestones.',
  },
  milestones: {
    required: ['name', 'projectId', 'weightBps'],
    hide: ['completedDate', 'signedOffById', 'signedOffDate'],
    note: 'Weights must total 100% across a project or percent-complete can never reach 100.',
  },
  tasks: { required: ['title'], hide: ['blockedReason'] },
  sprints: { required: ['name', 'startDate', 'endDate'], hide: ['retroNotes'] },
  timeEntries: {
    required: ['teamMemberId', 'workedOn', 'minutes'],
    hide: ['invoiced', 'invoiceId'],
    note: 'Cost and bill rates are copied from the member as they are today, and frozen on the entry.',
  },
  allocations: { required: ['teamMemberId', 'weekStarting', 'plannedMinutes'] },
  absences: { required: ['teamMemberId', 'type', 'startDate', 'endDate', 'workingDays'] },
  changeRequests: { required: ['title', 'projectId', 'raisedDate'], hide: ['approvedDate'] },
  risks: { required: ['title', 'projectId', 'category', 'probability', 'impact'], hide: ['resolvedDate'] },
  meetings: {
    required: ['type', 'heldOn'],
    // status moves only through startMeeting/concludeMeeting; the texts are written in the room.
    hide: ['status', 'headlines', 'cascadingMessages'],
    note: 'Create it, then run it from its own page — open the meeting from its record panel.',
  },
  rocks: {
    required: ['title', 'quarter', 'ownerId'],
    note: 'Quarter looks like 2026-Q3. Due date defaults to the end of it.',
  },
  scorecardEntries: {
    required: ['measurableId', 'weekStarting', 'value'],
    note: 'Enter money in euros and percent as a percentage — converted to raw units on save. The week snaps to its Monday.',
  },
  todos: {
    required: ['title', 'ownerId'],
    hide: ['done'],
    note: 'Due in 7 days unless you say otherwise — that is the cadence.',
  },
  issues: { required: ['title'], hide: ['solvedInMeetingId'] },
}

/** Deals gained a portfolio link in Phase 2. */
TABLES.deals.fields.splice(
  TABLES.deals.fields.findIndex((f) => f.id === 'type') + 1,
  0,
  { id: 'portfolioProductId', label: 'Product', type: 'link', width: 150, linkTo: 'portfolio' },
)
TABLES.products.fields.splice(
  TABLES.products.fields.findIndex((f) => f.id === 'type') + 1,
  0,
  { id: 'portfolioProductId', label: 'Product line', type: 'link', width: 150, linkTo: 'portfolio' },
)

export const TABLE_IDS = Object.keys(TABLES) as TableId[]

export function getTable(id: string): TableConfig | undefined {
  return TABLES[id as TableId]
}

export function optionFor(field: { options?: Option[] }, value: unknown): Option | undefined {
  if (typeof value !== 'string') return undefined
  return field.options?.find((o) => o.value === value)
}
