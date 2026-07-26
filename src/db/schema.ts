/**
 * Atelier — database schema. Phase 1 (sales) and Phase 2 (portfolio, delivery,
 * production, capacity).
 *
 * Three rules hold everywhere in this file:
 *   1. Money is stored as integer CENTS. Never floats, never Decimal strings.
 *   2. Percentages are stored as basis points (12.5% = 1250), for the same reason.
 *   3. Time is stored as integer MINUTES. "7.5 hours" is a display concern.
 *
 * The chain that justifies putting sales and production in one system:
 *   deal -> project -> milestone -> task -> time entry -> cost -> margin
 * and, crossing it, the portfolio spine:
 *   portfolio product -> catalogue products -> deals   (what it earns)
 *   portfolio product -> projects -> tasks -> time     (what it costs)
 *
 * See the specification document for why each table exists.
 */
import {
  pgTable, pgEnum, text, integer, boolean, timestamp, date, primaryKey, index, uniqueIndex,
  serial, jsonb,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import type { AdapterAccountType } from 'next-auth/adapters'

/* ==========================================================================
 * ENUMS
 * ========================================================================== */

export const lifecycleStage = pgEnum('lifecycle_stage', [
  'Lead', 'MQL', 'SQL', 'Opportunity', 'Customer', 'Churned', 'Disqualified',
])
export const orgType = pgEnum('org_type', ['Prospect', 'Customer', 'Partner', 'Reseller', 'Vendor'])
export const segment = pgEnum('segment', ['Micro', 'SMB', 'MidMarket', 'Enterprise'])

export const persona = pgEnum('persona', [
  'Champion', 'EconomicBuyer', 'TechnicalEvaluator', 'EndUser', 'Blocker', 'Introducer',
])
export const contactStatus = pgEnum('contact_status', [
  'Active', 'LeftCompany', 'Unresponsive', 'Bounced', 'DoNotContact',
])

export const dealStage = pgEnum('deal_stage', [
  'Qualifying', 'Discovery', 'SolutionFit', 'Proposal', 'Negotiation', 'ClosedWon', 'ClosedLost', 'Nurture',
])
export const dealMotion = pgEnum('deal_motion', [
  'NewBusiness', 'Expansion', 'Upsell', 'CrossSell', 'Renewal', 'WinBack',
])
export const dealType = pgEnum('deal_type', ['Subscription', 'Project', 'Hybrid', 'Retainer'])
export const forecastCategory = pgEnum('forecast_category', [
  'Pipeline', 'BestCase', 'Commit', 'ClosedWon', 'ClosedLost',
])
export const lossReason = pgEnum('loss_reason', [
  'Price', 'Timing', 'NoBudget', 'LostToCompetitor', 'NoDecision', 'MissingFeature', 'BadFit', 'Unresponsive',
])

export const productType = pgEnum('product_type', ['SaaSPlan', 'Service', 'AddOn', 'OneOff', 'Retainer'])
export const billingFreq = pgEnum('billing_freq', ['OneOff', 'Monthly', 'Annual', 'UsageBased'])

export const activityType = pgEnum('activity_type', [
  'Call', 'Email', 'Meeting', 'Demo', 'Note', 'CheckIn', 'QBR', 'Onboarding',
])
export const activityOutcome = pgEnum('activity_outcome', [
  'Connected', 'NoAnswer', 'Positive', 'Neutral', 'Negative', 'NextStepSet',
])

export const sourceCategory = pgEnum('source_category', [
  'Outbound', 'Inbound', 'Referral', 'Partner', 'Paid', 'Event', 'Content', 'Organic', 'AppStore',
])

export const memberRole = pgEnum('member_role', [
  'Founder', 'AE', 'SDR', 'CSM', 'PartnerManager', 'PM', 'Designer', 'Engineer', 'QA', 'Ops',
])
export const department = pgEnum('department', ['Sales', 'Delivery', 'Engineering', 'Ops'])
export const memberStatus = pgEnum('member_status', ['Active', 'OnLeave', 'Inactive'])

export const targetMetric = pgEnum('target_metric', [
  'NewBusinessTCV', 'NetNewMRR', 'ClosedWonCount', 'BillableUtilization', 'GrossMargin',
])
export const targetScope = pgEnum('target_scope', ['Company', 'Team', 'Individual'])

/* ----------------------------- Phase 2 enums ----------------------------- */

export const portfolioStatus = pgEnum('portfolio_status', [
  'Idea', 'Discovery', 'Building', 'Live', 'Maintenance', 'Sunset',
])
export const projectType = pgEnum('project_type', [
  'ClientDelivery', 'InternalProduct', 'RnD', 'SupportRetainer', 'Migration',
])
export const projectStatus = pgEnum('project_status', [
  'NotStarted', 'Kickoff', 'Discovery', 'Design', 'Build', 'UAT', 'Launch', 'Hypercare',
  'Closed', 'OnHold', 'Cancelled',
])
export const health = pgEnum('health', ['Green', 'Amber', 'Red'])
export const milestonePhase = pgEnum('milestone_phase', [
  'Kickoff', 'DiscoveryComplete', 'DesignSignOff', 'BuildPhase', 'Integration', 'UAT',
  'GoLive', 'PostLaunchReview',
])
export const milestoneStatus = pgEnum('milestone_status', [
  'NotStarted', 'InProgress', 'Blocked', 'Delivered', 'Accepted', 'Cancelled',
])
export const taskType = pgEnum('task_type', [
  'Feature', 'Bug', 'Chore', 'Spike', 'Design', 'QA', 'Content', 'Ops',
])
export const taskStatus = pgEnum('task_status', [
  'Backlog', 'Ready', 'InProgress', 'InReview', 'QA', 'Done', 'WontDo',
])
export const priority = pgEnum('priority', ['P0', 'P1', 'P2', 'P3'])
export const severity = pgEnum('severity', ['Critical', 'Major', 'Minor', 'Trivial'])
export const reportSource = pgEnum('report_source', ['InternalQA', 'Customer', 'Support', 'Monitoring'])
export const sprintStatus = pgEnum('sprint_status', ['Planned', 'Active', 'Closed'])
export const absenceType = pgEnum('absence_type', [
  'PTO', 'PublicHoliday', 'Sick', 'Training', 'Parental',
])
export const changeRequestStatus = pgEnum('change_request_status', [
  'Proposed', 'Estimated', 'SentToClient', 'Approved', 'Rejected', 'Absorbed',
])
export const riskCategory = pgEnum('risk_category', ['Risk', 'Issue', 'Dependency', 'ClientBlocker'])
export const riskLevel = pgEnum('risk_level', ['Low', 'Medium', 'High'])
export const riskStatus = pgEnum('risk_status', ['Open', 'Mitigating', 'Closed', 'Accepted'])
export const allocationConfidence = pgEnum('allocation_confidence', ['Confirmed', 'Tentative'])

/* ----------------------------- Revenue enums ----------------------------- */

/**
 * Deliberately *not* an invoice status with a Paid member. Whether an invoice is
 * settled follows from the payments recorded against it, so it is derived in
 * compute.ts rather than stored — a flag somebody has to remember to flip is how
 * an aged-debt report ends up lying. Stored here is only what a person decides:
 * has it gone out, and has it been written off.
 */
export const invoiceStatus = pgEnum('invoice_status', ['Draft', 'Sent', 'Void'])
export const paymentMethod = pgEnum('payment_method', ['Transfer', 'Card', 'DirectDebit', 'Cash', 'Other'])
export const subscriptionStatus = pgEnum('subscription_status', ['Active', 'Paused', 'Cancelled'])

/* ==========================================================================
 * AUTH (shapes required by @auth/drizzle-adapter — do not rename)
 * ========================================================================== */

export const users = pgTable('user', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
})

export const accounts = pgTable('account', {
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').$type<AdapterAccountType>().notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })])

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
})

export const verificationTokens = pgTable('verificationToken', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (t) => [primaryKey({ columns: [t.identifier, t.token] })])

/* ==========================================================================
 * GROUP A — FOUNDATION
 * ========================================================================== */

export const teamMembers = pgTable('team_member', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  seq: serial('seq').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: memberRole('role').notNull(),
  department: department('department').notNull(),
  status: memberStatus('status').notNull().default('Active'),
  /** Drives every utilisation calculation. 40 for full time, the real number otherwise. */
  weeklyCapacityHours: integer('weekly_capacity_hours').notNull().default(40),
  /** Sensitive — see spec section 10 before exposing to the whole team. */
  costRateCents: integer('cost_rate_cents'),
  billRateCents: integer('bill_rate_cents'),
  timezone: text('timezone').default('Europe/Warsaw'),
  /** Placeholder for a future squads table. Free text until the team is big
   *  enough for squads to mean something. */
  squad: text('squad'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  managerId: text('manager_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [index('team_member_department_idx').on(t.department)])

export const sources = pgTable('source', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  category: sourceCategory('category').notNull(),
  active: boolean('active').notNull().default(true),
  monthlyCostCents: integer('monthly_cost_cents'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const organizations = pgTable('organization', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  seq: serial('seq').notNull(),
  name: text('name').notNull(),
  legalName: text('legal_name'),
  /** Bare, lowercased, no protocol and no www. The dedupe key — see spec section 14. */
  domain: text('domain').notNull(),
  types: orgType('types').array().notNull().default(['Prospect']),
  lifecycle: lifecycleStage('lifecycle').notNull().default('Lead'),
  segment: segment('segment'),
  industry: text('industry'),
  country: text('country'),
  city: text('city'),
  employeeCount: integer('employee_count'),
  website: text('website'),
  linkedin: text('linkedin'),
  vatId: text('vat_id'),
  notes: text('notes'),
  ownerId: text('owner_id').references(() => teamMembers.id, { onDelete: 'set null' }),
  sourceId: text('source_id').references(() => sources.id, { onDelete: 'set null' }),
  parentId: text('parent_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('organization_domain_key').on(t.domain),
  index('organization_lifecycle_idx').on(t.lifecycle),
  index('organization_owner_idx').on(t.ownerId),
])

export const contacts = pgTable('contact', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  seq: serial('seq').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  title: text('title'),
  persona: persona('persona'),
  status: contactStatus('status').notNull().default('Active'),
  marketingOptIn: boolean('marketing_opt_in').notNull().default(false),
  language: text('language'),
  linkedin: text('linkedin'),
  notes: text('notes'),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id').references(() => teamMembers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [index('contact_organization_idx').on(t.organizationId)])

/* ==========================================================================
 * GROUP B — SALES
 * ========================================================================== */

export const products = pgTable('product', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  seq: serial('seq').notNull(),
  name: text('name').notNull().unique(),
  type: productType('type').notNull(),
  listPriceCents: integer('list_price_cents').notNull(),
  billing: billingFreq('billing').notNull(),
  unit: text('unit'),
  costToServeCents: integer('cost_to_serve_cents'),
  entitlements: text('entitlements').array().notNull().default([]),
  description: text('description'),
  active: boolean('active').notNull().default(true),
  /** The product this plan belongs to. Blank for generic services such as
   *  Implementation, which are sold alongside anything. */
  portfolioProductId: text('portfolio_product_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const deals = pgTable('deal', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  seq: serial('seq').notNull(),
  name: text('name').notNull(),
  stage: dealStage('stage').notNull().default('Qualifying'),
  /** Stamped by moveDealStage. Never edit by hand — "days in stage" depends on it. */
  stageEnteredAt: timestamp('stage_entered_at').notNull().defaultNow(),
  motion: dealMotion('motion').notNull().default('NewBusiness'),
  type: dealType('type').notNull().default('Subscription'),
  forecast: forecastCategory('forecast').notNull().default('Pipeline'),
  /**
   * No currency column. Every money figure in this system is EUR cents, and
   * `deal.currency` used to say otherwise while `dealMoney` and the € formatter
   * ignored it entirely — so a PLN deal would have been summed straight into
   * the EUR pipeline, coverage and margin totals with nothing to flag it.
   * Removed rather than half-supported; add real FX handling before adding it back.
   */
  contractMonths: integer('contract_months').notNull().default(12),
  /** Basis points. Null means "use the stage default" — see STAGE_PROBABILITY_BPS. */
  probabilityOverrideBps: integer('probability_override_bps'),
  expectedCloseDate: date('expected_close_date'),
  actualCloseDate: date('actual_close_date'),
  nextStep: text('next_step'),
  nextStepDate: date('next_step_date'),
  championIdentified: boolean('champion_identified').notNull().default(false),
  economicBuyerIdentified: boolean('economic_buyer_identified').notNull().default(false),
  painDocumented: boolean('pain_documented').notNull().default(false),
  decisionProcessDocumented: boolean('decision_process_documented').notNull().default(false),
  lossReason: lossReason('loss_reason'),
  lossNotes: text('loss_notes'),
  competitors: text('competitors').array().notNull().default([]),
  proposalUrl: text('proposal_url'),
  contractUrl: text('contract_url'),
  notes: text('notes'),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  primaryContactId: text('primary_contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  ownerId: text('owner_id').references(() => teamMembers.id, { onDelete: 'set null' }),
  sourceId: text('source_id').references(() => sources.id, { onDelete: 'set null' }),
  /** Which of our own products this deal is for. Blank for pure services work. */
  portfolioProductId: text('portfolio_product_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('deal_stage_idx').on(t.stage),
  index('deal_portfolio_idx').on(t.portfolioProductId),
  index('deal_owner_idx').on(t.ownerId),
  index('deal_close_idx').on(t.expectedCloseDate),
])

/** Many-to-many: everyone involved in the buying decision. */
export const dealContacts = pgTable('deal_contact', {
  dealId: text('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
  contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.dealId, t.contactId] })])

export const dealLineItems = pgTable('deal_line_item', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  dealId: text('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => products.id),
  quantity: integer('quantity').notNull().default(1),
  unitPriceCents: integer('unit_price_cents').notNull(),
  /** Basis points — 12.5% is 1250. Integers only, no rounding drift. */
  discountBps: integer('discount_bps').notNull().default(0),
  billing: billingFreq('billing').notNull(),
  estimatedDeliveryHours: integer('estimated_delivery_hours'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [index('line_item_deal_idx').on(t.dealId)])

/**
 * Append-only. Written by moveDealStage, never by hand.
 * Stage-conversion analysis cannot be reconstructed after the fact, which is
 * exactly why this table exists from week one rather than week four.
 */
export const dealStageHistory = pgTable('deal_stage_history', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  dealId: text('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
  fromStage: dealStage('from_stage'),
  toStage: dealStage('to_stage').notNull(),
  changedAt: timestamp('changed_at').notNull().defaultNow(),
  daysInPreviousStage: integer('days_in_previous_stage'),
  changedById: text('changed_by_id').references(() => teamMembers.id, { onDelete: 'set null' }),
}, (t) => [
  index('stage_history_deal_idx').on(t.dealId),
  index('stage_history_changed_idx').on(t.changedAt),
])

export const activities = pgTable('activity', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  seq: serial('seq').notNull(),
  subject: text('subject').notNull(),
  type: activityType('type').notNull(),
  occurredAt: timestamp('occurred_at').notNull().defaultNow(),
  direction: text('direction'),
  durationMinutes: integer('duration_minutes'),
  outcome: activityOutcome('outcome'),
  nextStep: text('next_step'),
  nextStepDue: date('next_step_due'),
  notes: text('notes'),
  ownerId: text('owner_id').references(() => teamMembers.id, { onDelete: 'set null' }),
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  contactId: text('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  dealId: text('deal_id').references(() => deals.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('activity_occurred_idx').on(t.occurredAt),
  index('activity_deal_idx').on(t.dealId),
])

/** Denominators. Every coverage and attainment metric needs one. */
export const targets = pgTable('target', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  /** "2026-Q3" or "2026-07" */
  period: text('period').notNull(),
  metric: targetMetric('metric').notNull(),
  scope: targetScope('scope').notNull().default('Company'),
  /** Cents for money, basis points for percentages, plain count otherwise. */
  value: integer('value').notNull(),
  teamMemberId: text('team_member_id').references(() => teamMembers.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('target_unique').on(t.period, t.metric, t.scope, t.teamMemberId)])

/* ==========================================================================
 * GROUP H — PORTFOLIO
 *
 * The spine that was missing in Phase 1. A software house sells plans and
 * services (the `product` catalogue) but *builds and owns* products. Those are
 * different things and conflating them makes "is PagaPRO actually profitable?"
 * unanswerable — you can see what you sold but not what it cost to build.
 *
 * Catalogue products, deals, projects and tasks all point here, which is what
 * lets revenue on one side and delivery cost on the other meet in one row.
 * ========================================================================== */

export const portfolioProducts = pgTable('portfolio_product', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  seq: serial('seq').notNull(),
  name: text('name').notNull().unique(),
  /** URL-safe short name, e.g. "pagapro". */
  slug: text('slug').notNull().unique(),
  status: portfolioStatus('status').notNull().default('Idea'),
  description: text('description'),
  /** Accent colour used in the UI so each product is recognisable at a glance. */
  color: text('color').notNull().default('#1c8c5a'),
  ownerId: text('owner_id').references(() => teamMembers.id, { onDelete: 'set null' }),
  launchedAt: date('launched_at'),
  repoUrl: text('repo_url'),
  productionUrl: text('production_url'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

/* ==========================================================================
 * GROUP E — DELIVERY
 * ========================================================================== */

export const projects = pgTable('project', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  seq: serial('seq').notNull(),
  name: text('name').notNull(),
  type: projectType('type').notNull().default('ClientDelivery'),
  status: projectStatus('status').notNull().default('NotStarted'),
  health: health('health').notNull().default('Green'),
  /** Required whenever health is not Green. One sentence, refreshed weekly. */
  healthNote: text('health_note'),

  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  dealId: text('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  portfolioProductId: text('portfolio_product_id').references(() => portfolioProducts.id, { onDelete: 'set null' }),
  pmId: text('pm_id').references(() => teamMembers.id, { onDelete: 'set null' }),

  startDate: date('start_date'),
  targetLaunch: date('target_launch'),
  /** Frozen at kickoff. Slip is measured against this, never against the date
   *  someone moved last week — otherwise a project that slipped four times
   *  reports as on time. */
  baselineLaunch: date('baseline_launch'),
  actualLaunch: date('actual_launch'),

  budgetMinutes: integer('budget_minutes').notNull().default(0),
  contractValueCents: integer('contract_value_cents').notNull().default(0),

  scopeSummary: text('scope_summary'),
  repoUrl: text('repo_url'),
  stagingUrl: text('staging_url'),
  notes: text('notes'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('project_status_idx').on(t.status),
  index('project_health_idx').on(t.health),
  index('project_deal_idx').on(t.dealId),
  index('project_portfolio_idx').on(t.portfolioProductId),
])

export const milestones = pgTable('milestone', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  seq: serial('seq').notNull(),
  name: text('name').notNull(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  sequence: integer('sequence').notNull().default(0),
  phase: milestonePhase('phase').notNull().default('BuildPhase'),
  status: milestoneStatus('status').notNull().default('NotStarted'),
  ownerId: text('owner_id').references(() => teamMembers.id, { onDelete: 'set null' }),

  startDate: date('start_date'),
  dueDate: date('due_date'),
  baselineDue: date('baseline_due'),
  completedDate: date('completed_date'),

  /** Basis points. Must total 10000 across a project. */
  weightBps: integer('weight_bps').notNull().default(0),
  /** If it is not written here, it is not the deliverable. */
  acceptanceCriteria: text('acceptance_criteria'),
  clientSignOffRequired: boolean('client_sign_off_required').notNull().default(false),
  signedOffById: text('signed_off_by_id').references(() => contacts.id, { onDelete: 'set null' }),
  signedOffDate: date('signed_off_date'),
  paymentTrigger: boolean('payment_trigger').notNull().default(false),
  invoiceAmountCents: integer('invoice_amount_cents').notNull().default(0),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [index('milestone_project_idx').on(t.projectId)])

export const changeRequests = pgTable('change_request', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  seq: serial('seq').notNull(),
  title: text('title').notNull(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  requestedById: text('requested_by_id').references(() => contacts.id, { onDelete: 'set null' }),
  raisedDate: date('raised_date'),
  description: text('description'),
  impactMinutes: integer('impact_minutes').notNull().default(0),
  impactCostCents: integer('impact_cost_cents').notNull().default(0),
  impactDays: integer('impact_days').notNull().default(0),
  status: changeRequestStatus('status').notNull().default('Proposed'),
  approvedDate: date('approved_date'),
  /** If it becomes chargeable it is a deal, not a favour. */
  upsellDealId: text('upsell_deal_id').references(() => deals.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [index('change_request_project_idx').on(t.projectId)])

export const risks = pgTable('risk', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  seq: serial('seq').notNull(),
  title: text('title').notNull(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  category: riskCategory('category').notNull().default('Risk'),
  probability: riskLevel('probability').notNull().default('Medium'),
  impact: riskLevel('impact').notNull().default('Medium'),
  ownerId: text('owner_id').references(() => teamMembers.id, { onDelete: 'set null' }),
  status: riskStatus('status').notNull().default('Open'),
  mitigation: text('mitigation'),
  raisedDate: date('raised_date'),
  targetDate: date('target_date'),
  resolvedDate: date('resolved_date'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [index('risk_project_idx').on(t.projectId)])

/* ==========================================================================
 * GROUP F — PRODUCTION
 * ========================================================================== */

export const sprints = pgTable('sprint', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  seq: serial('seq').notNull(),
  /** ISO week is the least ambiguous naming: "2026-W31". */
  name: text('name').notNull().unique(),
  goal: text('goal'),
  status: sprintStatus('status').notNull().default('Planned'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  /**
   * Snapshotted once when the sprint starts. Deliberately not a rollup: a live
   * sum silently rewrites history every time scope is added mid-sprint, which
   * makes every velocity chart a lie.
   */
  committedMinutes: integer('committed_minutes').notNull().default(0),
  retroNotes: text('retro_notes'),
  /** Placeholder for a future squads table — see the team-shape decision. */
  squad: text('squad'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const tasks = pgTable('task', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  seq: serial('seq').notNull(),
  title: text('title').notNull(),
  type: taskType('type').notNull().default('Feature'),
  status: taskStatus('status').notNull().default('Backlog'),
  /**
   * Blocked is a flag, not a status. A blocked task must not lose the memory of
   * whether it was in development or in review, or cycle time becomes fiction.
   */
  blocked: boolean('blocked').notNull().default(false),
  blockedReason: text('blocked_reason'),
  priority: priority('priority').notNull().default('P2'),
  severity: severity('severity'),
  reportSource: reportSource('report_source'),

  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  milestoneId: text('milestone_id').references(() => milestones.id, { onDelete: 'set null' }),
  sprintId: text('sprint_id').references(() => sprints.id, { onDelete: 'set null' }),
  portfolioProductId: text('portfolio_product_id').references(() => portfolioProducts.id, { onDelete: 'set null' }),
  assigneeId: text('assignee_id').references(() => teamMembers.id, { onDelete: 'set null' }),
  reviewerId: text('reviewer_id').references(() => teamMembers.id, { onDelete: 'set null' }),

  /** Hours, stored as minutes. One unit for client and product work alike. */
  estimateMinutes: integer('estimate_minutes').notNull().default(0),
  startDate: date('start_date'),
  dueDate: date('due_date'),
  inProgressAt: timestamp('in_progress_at'),
  completedAt: timestamp('completed_at'),

  acceptanceCriteria: text('acceptance_criteria'),
  reproSteps: text('repro_steps'),
  prUrl: text('pr_url'),
  labels: text('labels').array().notNull().default([]),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('task_status_idx').on(t.status),
  index('task_assignee_idx').on(t.assigneeId),
  index('task_project_idx').on(t.projectId),
  index('task_sprint_idx').on(t.sprintId),
])

/* ==========================================================================
 * GROUP G — CAPACITY
 * ========================================================================== */

export const timeEntries = pgTable('time_entry', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  teamMemberId: text('team_member_id').notNull().references(() => teamMembers.id, { onDelete: 'cascade' }),
  workedOn: date('worked_on').notNull(),
  minutes: integer('minutes').notNull(),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  billable: boolean('billable').notNull().default(true),
  /**
   * Rates are snapshotted at entry time. Looking them up live would silently
   * restate last year's margin the day somebody gets a raise.
   */
  costRateCents: integer('cost_rate_cents').notNull().default(0),
  billRateCents: integer('bill_rate_cents').notNull().default(0),
  /**
   * Which invoice billed these hours — not a boolean saying that some invoice
   * did, once, probably.
   *
   * `invoiced` used to be a flag nothing ever set. Storing the link instead means
   * you can see which invoice covered which hours, and voiding that invoice
   * releases them back to billable without anything having to remember to. The
   * derived "is this billed" lives in compute.ts, because a void invoice bills
   * nothing.
   */
  invoiceId: text('invoice_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('time_entry_member_idx').on(t.teamMemberId),
  index('time_entry_project_idx').on(t.projectId),
  index('time_entry_date_idx').on(t.workedOn),
  index('time_entry_invoice_idx').on(t.invoiceId),
])

export const allocations = pgTable('allocation', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  teamMemberId: text('team_member_id').notNull().references(() => teamMembers.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  portfolioProductId: text('portfolio_product_id').references(() => portfolioProducts.id, { onDelete: 'cascade' }),
  /** Always a Monday. Weekly is the sweet spot — daily is unmaintainable,
   *  monthly tells you nothing you can act on. */
  weekStarting: date('week_starting').notNull(),
  plannedMinutes: integer('planned_minutes').notNull().default(0),
  roleOnEngagement: text('role_on_engagement'),
  billable: boolean('billable').notNull().default(true),
  confidence: allocationConfidence('confidence').notNull().default('Confirmed'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('allocation_member_idx').on(t.teamMemberId),
  index('allocation_week_idx').on(t.weekStarting),
])

export const absences = pgTable('absence', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  teamMemberId: text('team_member_id').notNull().references(() => teamMembers.id, { onDelete: 'cascade' }),
  type: absenceType('type').notNull().default('PTO'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  workingDays: integer('working_days').notNull().default(0),
  approved: boolean('approved').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [index('absence_member_idx').on(t.teamMemberId)])

/* ==========================================================================
 * RELATIONS (for the query builder)
 * ========================================================================== */

export const organizationRelations = relations(organizations, ({ one, many }) => ({
  owner: one(teamMembers, { fields: [organizations.ownerId], references: [teamMembers.id] }),
  source: one(sources, { fields: [organizations.sourceId], references: [sources.id] }),
  contacts: many(contacts),
  deals: many(deals),
  activities: many(activities),
  projects: many(projects),
  subscriptions: many(subscriptions),
  invoices: many(invoices),
}))

export const sourceRelations = relations(sources, ({ many }) => ({
  organizations: many(organizations),
  deals: many(deals),
}))

export const productRelations = relations(products, ({ one, many }) => ({
  lineItems: many(dealLineItems),
  portfolioProduct: one(portfolioProducts, {
    fields: [products.portfolioProductId], references: [portfolioProducts.id],
  }),
}))

export const contactRelations = relations(contacts, ({ one, many }) => ({
  organization: one(organizations, { fields: [contacts.organizationId], references: [organizations.id] }),
  owner: one(teamMembers, { fields: [contacts.ownerId], references: [teamMembers.id] }),
  activities: many(activities),
  dealLinks: many(dealContacts),
}))

export const dealRelations = relations(deals, ({ one, many }) => ({
  organization: one(organizations, { fields: [deals.organizationId], references: [organizations.id] }),
  primaryContact: one(contacts, { fields: [deals.primaryContactId], references: [contacts.id] }),
  owner: one(teamMembers, { fields: [deals.ownerId], references: [teamMembers.id] }),
  source: one(sources, { fields: [deals.sourceId], references: [sources.id] }),
  portfolioProduct: one(portfolioProducts, {
    fields: [deals.portfolioProductId], references: [portfolioProducts.id],
  }),
  lineItems: many(dealLineItems),
  stageHistory: many(dealStageHistory),
  activities: many(activities),
  buyingGroup: many(dealContacts),
  projects: many(projects),
}))

export const dealContactRelations = relations(dealContacts, ({ one }) => ({
  deal: one(deals, { fields: [dealContacts.dealId], references: [deals.id] }),
  contact: one(contacts, { fields: [dealContacts.contactId], references: [contacts.id] }),
}))

export const lineItemRelations = relations(dealLineItems, ({ one }) => ({
  deal: one(deals, { fields: [dealLineItems.dealId], references: [deals.id] }),
  product: one(products, { fields: [dealLineItems.productId], references: [products.id] }),
}))

export const stageHistoryRelations = relations(dealStageHistory, ({ one }) => ({
  deal: one(deals, { fields: [dealStageHistory.dealId], references: [deals.id] }),
  changedBy: one(teamMembers, { fields: [dealStageHistory.changedById], references: [teamMembers.id] }),
}))

export const activityRelations = relations(activities, ({ one }) => ({
  owner: one(teamMembers, { fields: [activities.ownerId], references: [teamMembers.id] }),
  organization: one(organizations, { fields: [activities.organizationId], references: [organizations.id] }),
  contact: one(contacts, { fields: [activities.contactId], references: [contacts.id] }),
  deal: one(deals, { fields: [activities.dealId], references: [deals.id] }),
}))

export const teamMemberRelations = relations(teamMembers, ({ one, many }) => ({
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
  ownedOrgs: many(organizations),
  ownedContacts: many(contacts),
  ownedDeals: many(deals),
  activities: many(activities),
  targets: many(targets),
  managedProjects: many(projects),
  assignedTasks: many(tasks),
  timeEntries: many(timeEntries),
  allocations: many(allocations),
  absences: many(absences),
}))

export const targetRelations = relations(targets, ({ one }) => ({
  teamMember: one(teamMembers, { fields: [targets.teamMemberId], references: [teamMembers.id] }),
}))

/* --------------------------- Phase 2 relations --------------------------- */

export const portfolioProductRelations = relations(portfolioProducts, ({ one, many }) => ({
  owner: one(teamMembers, { fields: [portfolioProducts.ownerId], references: [teamMembers.id] }),
  projects: many(projects),
  tasks: many(tasks),
  allocations: many(allocations),
}))

export const projectRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, { fields: [projects.organizationId], references: [organizations.id] }),
  deal: one(deals, { fields: [projects.dealId], references: [deals.id] }),
  portfolioProduct: one(portfolioProducts, {
    fields: [projects.portfolioProductId], references: [portfolioProducts.id],
  }),
  pm: one(teamMembers, { fields: [projects.pmId], references: [teamMembers.id] }),
  milestones: many(milestones),
  tasks: many(tasks),
  timeEntries: many(timeEntries),
  allocations: many(allocations),
  changeRequests: many(changeRequests),
  risks: many(risks),
  invoices: many(invoices),
}))

export const milestoneRelations = relations(milestones, ({ one, many }) => ({
  project: one(projects, { fields: [milestones.projectId], references: [projects.id] }),
  owner: one(teamMembers, { fields: [milestones.ownerId], references: [teamMembers.id] }),
  signedOffBy: one(contacts, { fields: [milestones.signedOffById], references: [contacts.id] }),
  tasks: many(tasks),
}))

export const taskRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  milestone: one(milestones, { fields: [tasks.milestoneId], references: [milestones.id] }),
  sprint: one(sprints, { fields: [tasks.sprintId], references: [sprints.id] }),
  portfolioProduct: one(portfolioProducts, {
    fields: [tasks.portfolioProductId], references: [portfolioProducts.id],
  }),
  assignee: one(teamMembers, { fields: [tasks.assigneeId], references: [teamMembers.id] }),
  reviewer: one(teamMembers, { fields: [tasks.reviewerId], references: [teamMembers.id] }),
  timeEntries: many(timeEntries),
}))

export const sprintRelations = relations(sprints, ({ many }) => ({
  tasks: many(tasks),
}))

export const timeEntryRelations = relations(timeEntries, ({ one }) => ({
  teamMember: one(teamMembers, { fields: [timeEntries.teamMemberId], references: [teamMembers.id] }),
  task: one(tasks, { fields: [timeEntries.taskId], references: [tasks.id] }),
  project: one(projects, { fields: [timeEntries.projectId], references: [projects.id] }),
  invoice: one(invoices, { fields: [timeEntries.invoiceId], references: [invoices.id] }),
}))

export const allocationRelations = relations(allocations, ({ one }) => ({
  teamMember: one(teamMembers, { fields: [allocations.teamMemberId], references: [teamMembers.id] }),
  project: one(projects, { fields: [allocations.projectId], references: [projects.id] }),
  portfolioProduct: one(portfolioProducts, {
    fields: [allocations.portfolioProductId], references: [portfolioProducts.id],
  }),
}))

export const absenceRelations = relations(absences, ({ one }) => ({
  teamMember: one(teamMembers, { fields: [absences.teamMemberId], references: [teamMembers.id] }),
}))

/* ==========================================================================
 * GROUP I — REVENUE
 *
 * The layer that was missing between "what we sold" and "what it cost to
 * build": what we actually billed, what came back, and what is still running.
 *
 * Without it the system could compute TCV and delivery cost but could not
 * answer "who owes us money" — and `milestone.invoice_amount_cents` and
 * `time_entry.invoiced` were both pointing at a record that did not exist.
 * ========================================================================== */

export const subscriptions = pgTable('subscription', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  seq: serial('seq').notNull(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  /** Which of our products they are actually on. */
  portfolioProductId: text('portfolio_product_id').references(() => portfolioProducts.id, { onDelete: 'set null' }),
  /** The deal that created it, so won revenue and running revenue reconcile. */
  dealId: text('deal_id').references(() => deals.id, { onDelete: 'set null' }),

  status: subscriptionStatus('status').notNull().default('Active'),
  startDate: date('start_date').notNull(),
  termMonths: integer('term_months').notNull().default(12),
  /**
   * Stored rather than derived from start + term, because it moves forward on
   * every renewal. Deriving it would make a five-year-old customer look
   * permanently overdue for their first renewal.
   */
  renewsOn: date('renews_on').notNull(),
  endedOn: date('ended_on'),
  autoRenew: boolean('auto_renew').notNull().default(true),

  mrrCents: integer('mrr_cents').notNull().default(0),
  billing: billingFreq('billing').notNull().default('Monthly'),

  cancelReason: text('cancel_reason'),
  notes: text('notes'),
  ownerId: text('owner_id').references(() => teamMembers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('subscription_org_idx').on(t.organizationId),
  index('subscription_status_idx').on(t.status),
  index('subscription_renews_idx').on(t.renewsOn),
])

export const invoices = pgTable('invoice', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  seq: serial('seq').notNull(),
  /** Human reference — what the client quotes back at you. */
  number: text('number').notNull().unique(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  subscriptionId: text('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
  /** Set when this invoice is the one a payment-trigger milestone called for. */
  milestoneId: text('milestone_id').references(() => milestones.id, { onDelete: 'set null' }),

  status: invoiceStatus('status').notNull().default('Draft'),
  issueDate: date('issue_date').notNull(),
  /** Everything about aged debt hangs off this one column. */
  dueDate: date('due_date').notNull(),

  /** Net. Tax is separate so the outstanding figure is gross and unambiguous. */
  amountCents: integer('amount_cents').notNull().default(0),
  taxCents: integer('tax_cents').notNull().default(0),

  notes: text('notes'),
  ownerId: text('owner_id').references(() => teamMembers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('invoice_org_idx').on(t.organizationId),
  index('invoice_due_idx').on(t.dueDate),
  index('invoice_status_idx').on(t.status),
])

export const payments = pgTable('payment', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  seq: serial('seq').notNull(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  paidOn: date('paid_on').notNull(),
  amountCents: integer('amount_cents').notNull(),
  method: paymentMethod('method').notNull().default('Transfer'),
  reference: text('reference'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [index('payment_invoice_idx').on(t.invoiceId)])

/**
 * What was changed, by whom, and what it looked like before.
 *
 * Deletion here is a hard DELETE — there is no `deleted_at` on twenty-two tables
 * and no undo stack. This is the recovery path: `before` holds the complete row
 * as JSON, so a mistaken delete can be reconstructed, and "who removed the
 * Nordwind invoice" has an answer that is not "nobody knows".
 *
 * Append-only. Nothing in the app updates or deletes a row here.
 */
export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  seq: serial('seq').notNull(),
  at: timestamp('at').notNull().defaultNow(),
  /** Null only if the actor's Team row was itself removed afterwards. */
  actorMemberId: text('actor_member_id').references(() => teamMembers.id, { onDelete: 'set null' }),
  actorEmail: text('actor_email'),
  action: text('action').notNull(),
  /** The UI's table id — 'invoices', 'deals' — not the Postgres table name. */
  tableId: text('table_id').notNull(),
  rowId: text('row_id').notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
}, (t) => [
  index('audit_log_at_idx').on(t.at),
  index('audit_log_row_idx').on(t.tableId, t.rowId),
])

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(teamMembers, { fields: [auditLog.actorMemberId], references: [teamMembers.id] }),
}))

export const subscriptionRelations = relations(subscriptions, ({ one, many }) => ({
  organization: one(organizations, { fields: [subscriptions.organizationId], references: [organizations.id] }),
  portfolioProduct: one(portfolioProducts, {
    fields: [subscriptions.portfolioProductId], references: [portfolioProducts.id],
  }),
  deal: one(deals, { fields: [subscriptions.dealId], references: [deals.id] }),
  owner: one(teamMembers, { fields: [subscriptions.ownerId], references: [teamMembers.id] }),
  invoices: many(invoices),
}))

export const invoiceRelations = relations(invoices, ({ one, many }) => ({
  organization: one(organizations, { fields: [invoices.organizationId], references: [organizations.id] }),
  project: one(projects, { fields: [invoices.projectId], references: [projects.id] }),
  subscription: one(subscriptions, { fields: [invoices.subscriptionId], references: [subscriptions.id] }),
  milestone: one(milestones, { fields: [invoices.milestoneId], references: [milestones.id] }),
  owner: one(teamMembers, { fields: [invoices.ownerId], references: [teamMembers.id] }),
  payments: many(payments),
}))

export const paymentRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
}))

export const changeRequestRelations = relations(changeRequests, ({ one }) => ({
  project: one(projects, { fields: [changeRequests.projectId], references: [projects.id] }),
  requestedBy: one(contacts, { fields: [changeRequests.requestedById], references: [contacts.id] }),
  upsellDeal: one(deals, { fields: [changeRequests.upsellDealId], references: [deals.id] }),
}))

export const riskRelations = relations(risks, ({ one }) => ({
  project: one(projects, { fields: [risks.projectId], references: [projects.id] }),
  owner: one(teamMembers, { fields: [risks.ownerId], references: [teamMembers.id] }),
}))

export type Organization = typeof organizations.$inferSelect
export type Contact = typeof contacts.$inferSelect
export type Deal = typeof deals.$inferSelect
export type TeamMember = typeof teamMembers.$inferSelect
export type Product = typeof products.$inferSelect
export type Activity = typeof activities.$inferSelect
export type DealStageValue = (typeof dealStage.enumValues)[number]
export type PortfolioProduct = typeof portfolioProducts.$inferSelect
export type Project = typeof projects.$inferSelect
export type Milestone = typeof milestones.$inferSelect
export type Task = typeof tasks.$inferSelect
export type Sprint = typeof sprints.$inferSelect
export type TimeEntry = typeof timeEntries.$inferSelect
export type Subscription = typeof subscriptions.$inferSelect
export type Invoice = typeof invoices.$inferSelect
export type Payment = typeof payments.$inferSelect
