/**
 * Derived values. Kept in one file so the grid, the board, the record panel
 * and the dashboard can never disagree about what "TCV" means.
 */
import { HEALTH_RULES, STAGE_DAY_LIMIT, STAGE_PROBABILITY_BPS, INACTIVE_STAGES } from '@/lib/tables'
import { daysBetween } from '@/lib/format'

export type LineItemLike = {
  quantity: number
  unitPriceCents: number
  discountBps: number
  billing: 'OneOff' | 'Monthly' | 'Annual' | 'UsageBased'
}

export function lineTotalCents(line: LineItemLike): number {
  return Math.round(line.quantity * line.unitPriceCents * (1 - line.discountBps / 10_000))
}

export type DealMoney = {
  oneOffCents: number
  mrrCents: number
  tcvCents: number
  probabilityBps: number
  weightedCents: number
}

/**
 * TCV = one-off revenue + (monthly recurring x contract length).
 * Annual lines are normalised to a monthly figure so MRR means one thing.
 * Usage-based lines are deliberately excluded — they are not contracted value.
 */
export function dealMoney(deal: {
  stage: string
  contractMonths: number
  probabilityOverrideBps: number | null
  lineItems: LineItemLike[]
}): DealMoney {
  let oneOffCents = 0
  let mrrCents = 0

  for (const line of deal.lineItems) {
    const total = lineTotalCents(line)
    if (line.billing === 'OneOff') oneOffCents += total
    else if (line.billing === 'Monthly') mrrCents += total
    else if (line.billing === 'Annual') mrrCents += Math.round(total / 12)
  }

  const tcvCents = oneOffCents + mrrCents * deal.contractMonths
  const probabilityBps = deal.probabilityOverrideBps ?? STAGE_PROBABILITY_BPS[deal.stage] ?? 0
  const weightedCents = Math.round((tcvCents * probabilityBps) / 10_000)

  return { oneOffCents, mrrCents, tcvCents, probabilityBps, weightedCents }
}

/**
 * The field that keeps the pipeline believable. Order matters: a deal with no
 * next step is a worse problem than one that has merely been sitting a while.
 */
export function hygieneFlag(deal: {
  stage: string
  nextStepDate: string | null
  expectedCloseDate: string | null
  stageEnteredAt: Date
}): string {
  if ((INACTIVE_STAGES as readonly string[]).includes(deal.stage)) return ''

  const today = new Date().toISOString().slice(0, 10)

  if (!deal.nextStepDate) return '⚠ No next step'
  if (deal.nextStepDate < today) return '⚠ Next step overdue'

  const limit = STAGE_DAY_LIMIT[deal.stage]
  if (limit && daysBetween(deal.stageEnteredAt) > limit) return '⚠ Stalled in stage'

  if (deal.expectedCloseDate && deal.expectedCloseDate < today) return '⚠ Close date passed'

  return ''
}

/** How many of the four qualification gates are satisfied, as a 0–1 fraction. */
export function qualificationScore(deal: {
  championIdentified: boolean
  economicBuyerIdentified: boolean
  painDocumented: boolean
  decisionProcessDocumented: boolean
}): number {
  const gates = [
    deal.championIdentified,
    deal.economicBuyerIdentified,
    deal.painDocumented,
    deal.decisionProcessDocumented,
  ]
  return gates.filter(Boolean).length / gates.length
}

export function isOpenStage(stage: string): boolean {
  return !(INACTIVE_STAGES as readonly string[]).includes(stage)
}

/* ==========================================================================
 * PHASE 2 — delivery, production and capacity
 * ========================================================================== */

/**
 * How "done" a milestone counts as. Deliberately coarse: half credit for work
 * in progress is honest, and anything finer invites arguing about whether
 * something is 62% or 68% complete instead of shipping it.
 *
 * Cancelled counts as complete so a descoped milestone does not park a project
 * permanently short of 100%.
 */
export function milestoneCompletionBps(status: string): number {
  switch (status) {
    case 'Accepted':
    case 'Delivered':
    case 'Cancelled':
      return 10_000
    case 'InProgress':
      return 5_000
    default:
      return 0
  }
}

export type ProjectRollup = {
  percentCompleteBps: number
  loggedMinutes: number
  billableMinutes: number
  remainingMinutes: number
  burnBps: number | null
  internalCostCents: number
  marginBps: number | null
  openBlockers: number
  slipDays: number | null
  nextDueDate: string | null
}

export function projectRollup(project: {
  budgetMinutes: number
  contractValueCents: number
  baselineLaunch: string | null
  targetLaunch: string | null
  actualLaunch: string | null
  milestones: { status: string; weightBps: number; dueDate: string | null }[]
  timeEntries: { minutes: number; billable: boolean; costRateCents: number }[]
  tasks: { blocked: boolean; status: string }[]
}): ProjectRollup {
  const percentCompleteBps = Math.min(
    10_000,
    Math.round(
      project.milestones.reduce(
        (sum, m) => sum + (m.weightBps * milestoneCompletionBps(m.status)) / 10_000,
        0,
      ),
    ),
  )

  const loggedMinutes = project.timeEntries.reduce((sum, e) => sum + e.minutes, 0)
  const billableMinutes = project.timeEntries.reduce((sum, e) => sum + (e.billable ? e.minutes : 0), 0)
  // Rates are per hour, in cents, snapshotted on the entry.
  const internalCostCents = project.timeEntries.reduce(
    (sum, e) => sum + Math.round((e.minutes / 60) * e.costRateCents),
    0,
  )

  const burnBps = project.budgetMinutes > 0
    ? Math.round((loggedMinutes / project.budgetMinutes) * 10_000)
    : null

  const marginBps = project.contractValueCents > 0
    ? Math.round(((project.contractValueCents - internalCostCents) / project.contractValueCents) * 10_000)
    : null

  const openBlockers = project.tasks.filter((t) => t.blocked && t.status !== 'Done' && t.status !== 'WontDo').length

  // Realised slip once launched, forecast slip before. Measured against the
  // baseline, never against a target that has already been moved.
  const slipEnd = project.actualLaunch ?? project.targetLaunch
  const slipDays = project.baselineLaunch && slipEnd
    ? daysBetween(project.baselineLaunch, slipEnd)
    : null

  const upcoming = project.milestones
    .filter((m) => m.dueDate && m.status !== 'Accepted' && m.status !== 'Delivered' && m.status !== 'Cancelled')
    .map((m) => m.dueDate as string)
    .sort()

  return {
    percentCompleteBps,
    loggedMinutes,
    billableMinutes,
    remainingMinutes: project.budgetMinutes - loggedMinutes,
    burnBps,
    internalCostCents,
    marginBps,
    openBlockers,
    slipDays,
    nextDueDate: upcoming[0] ?? null,
  }
}

/**
 * The warning that arrives early enough to be worth having: more than 80% of
 * the budget spent while less than 70% of the work is delivered.
 */
export function budgetWarning(rollup: ProjectRollup): string {
  if (rollup.burnBps === null) return ''
  if (rollup.burnBps > 10_000) return '⚠ Over budget'
  if (rollup.burnBps > 8_000 && rollup.percentCompleteBps < 7_000) return '⚠ Burning ahead of delivery'
  return ''
}

/** Probability x impact. Six or higher escalates. */
export function riskSeverity(probability: string, impact: string): number {
  const score = (v: string) => (v === 'High' ? 3 : v === 'Medium' ? 2 : 1)
  return score(probability) * score(impact)
}

/**
 * Utilisation over a period. Available time is capacity minus approved
 * absence, so somebody on leave does not read as idle.
 */
export function utilisationBps(input: {
  billableMinutes: number
  weeklyCapacityHours: number
  weeks: number
  absenceMinutes: number
}): number | null {
  const availableMinutes = input.weeklyCapacityHours * 60 * input.weeks - input.absenceMinutes
  if (availableMinutes <= 0) return null
  return Math.round((input.billableMinutes / availableMinutes) * 10_000)
}

/** Cycle time in days from first moving to In progress to reaching Done. */
export function cycleTimeDays(inProgressAt: Date | null, completedAt: Date | null): number | null {
  if (!inProgressAt || !completedAt) return null
  return Math.max(0, daysBetween(inProgressAt, completedAt))
}

export const OPEN_TASK_STATUSES = ['Backlog', 'Ready', 'InProgress', 'InReview', 'QA'] as const

export function isOpenTask(status: string): boolean {
  return (OPEN_TASK_STATUSES as readonly string[]).includes(status)
}

/* ==========================================================================
 * REVENUE — receivables, subscriptions and account health
 * ========================================================================== */

export type InvoiceState = {
  totalCents: number
  paidCents: number
  outstandingCents: number
  /** Draft | Sent | Part paid | Paid | Overdue | Void — derived, never stored. */
  state: string
  /** Positive only once past the due date and still owing. */
  daysOverdue: number
  /** Current | 1–30 | 31–60 | 61–90 | 90+ — blank once settled. */
  agingBucket: string
}

export const AGING_BUCKETS = ['Current', '1–30', '31–60', '61–90', '90+'] as const

/**
 * What an invoice is actually worth to you today.
 *
 * "Paid" is not a column. It is the sum of the payment rows against this
 * invoice, compared to what was billed. Storing it as a flag means the day
 * someone forgets to tick it, the aged-debt report quietly under-reports and
 * nobody finds out until a client is chased for money they already sent.
 *
 * Void invoices are worth nothing and are never overdue — a written-off debt
 * that keeps ageing would inflate receivables forever.
 */
export function invoiceState(
  invoice: { status: string; dueDate: string; amountCents: number; taxCents: number },
  payments: { amountCents: number }[],
  today = new Date().toISOString().slice(0, 10),
): InvoiceState {
  const totalCents = invoice.amountCents + invoice.taxCents
  const paidCents = payments.reduce((sum, p) => sum + p.amountCents, 0)
  const outstandingCents = Math.max(0, totalCents - paidCents)

  if (invoice.status === 'Void') {
    return { totalCents, paidCents, outstandingCents: 0, state: 'Void', daysOverdue: 0, agingBucket: '' }
  }
  if (outstandingCents === 0 && totalCents > 0) {
    return { totalCents, paidCents, outstandingCents: 0, state: 'Paid', daysOverdue: 0, agingBucket: '' }
  }
  if (invoice.status === 'Draft') {
    return { totalCents, paidCents, outstandingCents, state: 'Draft', daysOverdue: 0, agingBucket: '' }
  }

  // Only a sent invoice can be late; a draft nobody posted is our failing, not theirs.
  const daysOverdue = invoice.dueDate < today ? daysBetween(invoice.dueDate, today) : 0
  const partPaid = paidCents > 0

  return {
    totalCents,
    paidCents,
    outstandingCents,
    state: daysOverdue > 0 ? 'Overdue' : partPaid ? 'Part paid' : 'Sent',
    daysOverdue,
    agingBucket: agingBucket(daysOverdue),
  }
}

export function agingBucket(daysOverdue: number): string {
  if (daysOverdue <= 0) return 'Current'
  if (daysOverdue <= 30) return '1–30'
  if (daysOverdue <= 60) return '31–60'
  if (daysOverdue <= 90) return '61–90'
  return '90+'
}

/** Days until a subscription renews. Negative once the date has passed. */
export function daysUntilRenewal(renewsOn: string, today = new Date().toISOString().slice(0, 10)): number {
  return daysBetween(today, renewsOn)
}

/**
 * Add whole months to an ISO date, clamping to the end of the target month.
 *
 * Written by hand rather than with `Date.setMonth`, which overflows: 31 January
 * plus one month gives 3 March, so a subscription that renews on the 31st would
 * walk forward a few days every year until it drifted into the next month.
 * The 31st plus one month is the 28th (or 29th) here.
 */
export function addMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const index = month - 1 + months
  const targetYear = year + Math.floor(index / 12)
  const targetMonth = ((index % 12) + 12) % 12

  // Day 0 of the following month is the last day of this one.
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const targetDay = Math.min(day, lastDay)

  const pad = (n: number) => String(n).padStart(2, '0')
  return `${targetYear}-${pad(targetMonth + 1)}-${pad(targetDay)}`
}

/**
 * The next renewal date after this one.
 *
 * Counted from the existing renewal date, never from today. Renewing a month
 * late must not move the anniversary a month later — do that a few years running
 * and a January contract renews in April.
 */
export function nextRenewalDate(renewsOn: string, termMonths: number): string {
  return addMonths(renewsOn, Math.max(1, termMonths))
}

export type AccountHealth = {
  /** AtRisk | Hot | Warm | Cold */
  temperature: string
  /** Why, in the order that matters. First entry is the headline. */
  reasons: string[]
  daysSinceActivity: number | null
}

/**
 * How warm an account is.
 *
 * Deliberately explainable rather than a black-box score: it returns the reasons
 * alongside the verdict, because "Cold" without "nobody has spoken to them since
 * March" is not an insight, it is a colour.
 *
 * At risk is checked first and wins outright. A customer who owes you money for
 * two months, or whose delivery is red, is not "warm" just because you happened
 * to email them on Tuesday — and that is exactly the case where a naive recency
 * score reads healthiest right before the relationship ends.
 */
export function accountHealth(input: {
  lastActivityAt: string | null
  openDeals: { stage: string }[]
  maxDaysOverdue: number
  overdueCents: number
  daysToRenewal: number | null
  hasRedProject: boolean
  hasActiveSubscription: boolean
  today?: string
}): AccountHealth {
  const today = input.today ?? new Date().toISOString().slice(0, 10)
  const daysSinceActivity = input.lastActivityAt ? daysBetween(input.lastActivityAt, today) : null
  const quiet = daysSinceActivity === null || daysSinceActivity > HEALTH_RULES.warmActivityDays

  const reasons: string[] = []

  if (input.maxDaysOverdue > HEALTH_RULES.overdueRiskDays) {
    reasons.push(`${input.maxDaysOverdue} days overdue`)
  }
  if (input.hasRedProject) reasons.push('Delivery is red')
  if (
    input.hasActiveSubscription &&
    input.daysToRenewal !== null &&
    input.daysToRenewal <= HEALTH_RULES.renewalUrgentDays &&
    quiet
  ) {
    reasons.push(
      input.daysToRenewal < 0
        ? `Renewal ${Math.abs(input.daysToRenewal)} days past due`
        : `Renews in ${input.daysToRenewal} days, no recent contact`,
    )
  }
  if (reasons.length > 0) return { temperature: 'AtRisk', reasons, daysSinceActivity }

  const inPlay = input.openDeals.some((d) => HEALTH_RULES.lateStages.includes(d.stage))
  const renewalSoon =
    input.hasActiveSubscription &&
    input.daysToRenewal !== null &&
    input.daysToRenewal <= HEALTH_RULES.renewalSoonDays

  if (daysSinceActivity !== null && daysSinceActivity <= HEALTH_RULES.hotActivityDays && (inPlay || renewalSoon)) {
    reasons.push(inPlay ? 'Live deal in a late stage' : 'Renewal approaching')
    reasons.push(`Spoke ${daysSinceActivity} days ago`)
    return { temperature: 'Hot', reasons, daysSinceActivity }
  }

  if (!quiet) {
    reasons.push(`Spoke ${daysSinceActivity} days ago`)
    return { temperature: 'Warm', reasons, daysSinceActivity }
  }

  reasons.push(
    daysSinceActivity === null
      ? 'No activity ever logged'
      : `No contact for ${daysSinceActivity} days`,
  )
  return { temperature: 'Cold', reasons, daysSinceActivity }
}

export type ProjectFinancials = {
  contractValueCents: number
  /** Everything billed that has not been written off. */
  invoicedCents: number
  collectedCents: number
  outstandingCents: number
  overdueCents: number
  /** Contract value not yet billed. Negative means the project is over-billed. */
  uninvoicedCents: number
  internalCostCents: number
  /** Margin on what was sold. The number the deal promised. */
  contractedMarginBps: number | null
  /** Margin on what actually arrived. The number the bank agrees with. */
  collectedMarginBps: number | null
}

/**
 * The money on one project, from both ends.
 *
 * Two margins because they answer different questions and a project can look
 * healthy on one while failing the other. Contracted margin is what the deal
 * promised; collected margin is what the bank agrees with. A project sold at 40%
 * whose client has not paid is not a 40% project yet, and reporting only the
 * first is how a studio runs out of cash while its dashboard stays green.
 *
 * Void invoices are excluded throughout — a written-off bill was never revenue.
 */
export function projectFinancials(input: {
  contractValueCents: number
  internalCostCents: number
  invoices: {
    status: string
    dueDate: string
    amountCents: number
    taxCents: number
    payments: { amountCents: number }[]
  }[]
  today?: string
}): ProjectFinancials {
  const today = input.today ?? new Date().toISOString().slice(0, 10)
  const states = input.invoices.map((i) => ({ invoice: i, state: invoiceState(i, i.payments, today) }))
  const live = states.filter((s) => s.state.state !== 'Void')

  const invoicedCents = live.reduce((sum, s) => sum + s.state.totalCents, 0)
  const collectedCents = live.reduce((sum, s) => sum + s.state.paidCents, 0)
  const outstandingCents = live.reduce((sum, s) => sum + s.state.outstandingCents, 0)
  const overdueCents = live.reduce(
    (sum, s) => sum + (s.state.state === 'Overdue' ? s.state.outstandingCents : 0),
    0,
  )

  const bps = (numerator: number, denominator: number) =>
    denominator > 0 ? Math.round((numerator / denominator) * 10_000) : null

  return {
    contractValueCents: input.contractValueCents,
    invoicedCents,
    collectedCents,
    outstandingCents,
    overdueCents,
    uninvoicedCents: input.contractValueCents - invoicedCents,
    internalCostCents: input.internalCostCents,
    contractedMarginBps: bps(input.contractValueCents - input.internalCostCents, input.contractValueCents),
    collectedMarginBps: bps(collectedCents - input.internalCostCents, collectedCents),
  }
}

/* -------------------------------------------------------- invoice numbers */

const INVOICE_NUMBER_PATTERN = /^INV-(\d{4})-(\d+)$/

export function formatInvoiceNumber(year: number, sequence: number): string {
  return `INV-${year}-${String(sequence).padStart(3, '0')}`
}

/**
 * The next invoice number for a year, given the ones already issued.
 *
 * Numbering restarts each year and only ever counts up, including over gaps: a
 * voided INV-2026-042 does not free the number for reuse. Two invoices sharing a
 * reference is the kind of thing an accountant finds a year later.
 *
 * Anything not matching `INV-YYYY-NNN` is ignored rather than guessed at, so a
 * hand-typed reference cannot drag the sequence somewhere strange.
 */
export function nextInvoiceNumber(existing: string[], year: number): string {
  const highest = existing.reduce((max, number) => {
    const match = INVOICE_NUMBER_PATTERN.exec(number)
    if (!match || Number(match[1]) !== year) return max
    return Math.max(max, Number(match[2]))
  }, 0)
  return formatInvoiceNumber(year, highest + 1)
}

/**
 * Have these hours actually been billed?
 *
 * The link alone is not enough: an invoice that was voided billed nothing, so its
 * hours must return to billable. Deriving this rather than storing a flag is what
 * makes voiding an invoice self-correcting — there is nothing to remember to undo.
 */
export function timeIsInvoiced(link: { invoiceId: string | null; invoiceStatus?: string | null }): boolean {
  if (!link.invoiceId) return false
  return link.invoiceStatus !== 'Void'
}

/* ==========================================================================
 * TRACTION — the operating cadence
 * ========================================================================== */

/** '2026-08-26' → '2026-Q3'. */
export function quarterOf(isoDate: string): string {
  const [year, month] = isoDate.split('-').map(Number)
  return `${year}-Q${Math.ceil(month / 3)}`
}

/** '2026-Q3' → '2026-09-30'. Throws on a malformed quarter — callers validate first. */
export function quarterEndDate(quarter: string): string {
  const match = quarter.match(/^(\d{4})-Q([1-4])$/)
  if (!match) throw new Error(`Not a quarter: ${quarter}`)
  const year = Number(match[1])
  const endMonth = Number(match[2]) * 3
  // Day 0 of the following month is the last day of this one.
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate()
  return `${year}-${String(endMonth).padStart(2, '0')}-${lastDay}`
}

/** Any ISO date → that ISO week's Monday. UTC arithmetic, no local-time traps. */
export function mondayOf(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  // getUTCDay: Sunday 0 … Saturday 6. Distance back to Monday, with Sunday as 6.
  const back = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - back)
  return date.toISOString().slice(0, 10)
}

/** The `weeks` Mondays ending at (and including) the anchor's week, ascending. */
export function scorecardWeeks(anchor: string, weeks = 13): string[] {
  const monday = mondayOf(anchor)
  const [year, month, day] = monday.split('-').map(Number)
  const end = Date.UTC(year, month - 1, day)
  const out: string[] = []
  for (let i = weeks - 1; i >= 0; i -= 1) {
    out.push(new Date(end - i * 7 * 86_400_000).toISOString().slice(0, 10))
  }
  return out
}

/** Is this week's number on the right side of the goal? */
export function measurableOnTrack(
  value: number,
  goalValue: number,
  direction: 'AtLeast' | 'AtMost',
): boolean {
  return direction === 'AtLeast' ? value >= goalValue : value <= goalValue
}

/**
 * Share of recorded weeks on goal, in basis points. Null when nothing was
 * recorded — no data is not the same thing as 0%.
 */
export function scorecardHitRateBps(
  values: number[],
  goalValue: number,
  direction: 'AtLeast' | 'AtMost',
): number | null {
  if (values.length === 0) return null
  const hits = values.filter((v) => measurableOnTrack(v, goalValue, direction)).length
  return Math.round((hits / values.length) * 10_000)
}

/** The book's bar for to-do completion: 90%. */
export const TODO_COMPLETION_BAR_BPS = 9_000

/**
 * Done ÷ due, in basis points. Only to-dos whose due date has arrived count as
 * due — punishing someone for not having done Friday's to-do on Wednesday would
 * make the number lie. Null when nothing was due yet.
 */
export function todoCompletionBps(
  todos: { done: boolean; dueDate: string }[],
  today = new Date().toISOString().slice(0, 10),
): number | null {
  const due = todos.filter((t) => t.dueDate <= today)
  if (due.length === 0) return null
  const done = due.filter((t) => t.done).length
  return Math.round((done / due.length) * 10_000)
}

/**
 * Done ÷ everything except Dropped, in basis points. A dropped rock was
 * descoped, not failed — the Cancelled-milestone logic. Null with no rocks.
 */
export function rockCompletionBps(rocks: { status: string }[]): number | null {
  const counted = rocks.filter((r) => r.status !== 'Dropped')
  if (counted.length === 0) return null
  const done = counted.filter((r) => r.status === 'Done').length
  return Math.round((done / counted.length) * 10_000)
}

/** Mean of the ratings that exist, to one decimal. Null when none do. */
export function averageRating(ratings: (number | null)[]): number | null {
  const real = ratings.filter((r): r is number => typeof r === 'number')
  if (real.length === 0) return null
  return Math.round((real.reduce((a, b) => a + b, 0) / real.length) * 10) / 10
}
