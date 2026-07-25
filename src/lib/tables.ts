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
  amber: '#e0a020',
  orange: '#d97757',
  green: '#0e9f6e',
  rose: '#e2597a',
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

const MILESTONE_STATUS = opts(
  ['NotStarted', 'Not started', C.gray],
  ['InProgress', 'In progress', C.amber],
  ['Blocked', 'Blocked', C.rose],
  ['Delivered', 'Delivered', C.sky],
  ['Accepted', 'Accepted', C.green],
  ['Cancelled', 'Cancelled', C.slate],
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

export const SPACES = [
  { id: 'sales', name: 'Sales', color: '#0e9f6e', abbr: 'S', tables: ['deals', 'organizations', 'contacts', 'activities'] },
  { id: 'portfolio', name: 'Portfolio', color: '#8b5cf6', abbr: 'P', tables: ['portfolio', 'tasks', 'sprints'] },
  { id: 'delivery', name: 'Delivery', color: '#d97757', abbr: 'D', tables: ['projects', 'milestones', 'changeRequests', 'risks'] },
  { id: 'capacity', name: 'Capacity', color: '#3b93e0', abbr: 'C', tables: ['timeEntries', 'allocations', 'absences'] },
  { id: 'catalogue', name: 'Catalogue', color: '#e0a020', abbr: 'K', tables: ['products', 'sources'] },
  { id: 'people', name: 'People & Targets', color: '#12a5a5', abbr: 'T', tables: ['team', 'targets'] },
] as const

/* ----------------------------------------------------------------- tables */

const PHASE_1: Partial<Record<TableId, TableConfig>> = {
  deals: {
    id: 'deals',
    name: 'Deals',
    singular: 'deal',
    icon: 'euro',
    color: '#0e9f6e',
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
      { id: 'invoiced', label: 'Invoiced', type: 'check', width: 100 },
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

export const TABLES = { ...PHASE_1, ...PHASE_2 } as Record<TableId, TableConfig>

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
