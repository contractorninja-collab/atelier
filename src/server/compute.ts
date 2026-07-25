/**
 * Derived values. Kept in one file so the grid, the board, the record panel
 * and the dashboard can never disagree about what "TCV" means.
 */
import { STAGE_DAY_LIMIT, STAGE_PROBABILITY_BPS, INACTIVE_STAGES } from '@/lib/tables'
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
