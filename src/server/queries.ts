import 'server-only'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db, rowsOf } from '@/db'
import * as t from '@/db/schema'
import type { LinkRef, Row, TableId } from '@/lib/types'
import {
  accountHealth, budgetWarning, cycleTimeDays, daysUntilRenewal, dealMoney, hygieneFlag,
  invoiceState, isOpenStage, isOpenTask, projectFinancials, projectRollup, qualificationScore,
  riskSeverity, timeIsInvoiced,
} from './compute'
import { daysBetween, toISODate } from '@/lib/format'
import { TARGET_METRIC_UNIT } from '@/lib/tables'
import { canRead, canSeeCost } from '@/lib/permissions'
import { auth } from '@/auth'

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)
const ref = (table: TableId, id: string | null | undefined, label: string | null | undefined): LinkRef | null =>
  id && label ? { id, label, table } : null

/* ------------------------------------------------------------------ deals */

async function dealRows(): Promise<Row[]> {
  const rows = await db.query.deals.findMany({
    with: {
      organization: { columns: { id: true, name: true } },
      owner: { columns: { id: true, name: true } },
      primaryContact: { columns: { id: true, firstName: true, lastName: true } },
      source: { columns: { id: true, name: true } },
      portfolioProduct: { columns: { id: true, name: true } },
      lineItems: { columns: { quantity: true, unitPriceCents: true, discountBps: true, billing: true } },
    },
    orderBy: [desc(t.deals.updatedAt)],
  })

  return rows.map((d): Row => {
    const money = dealMoney(d)
    return {
      id: d.id,
      name: d.name,
      stage: d.stage,
      type: d.type,
      motion: d.motion,
      forecast: d.forecast,
      organizationId: ref('organizations', d.organization?.id, d.organization?.name),
      ownerId: ref('team', d.owner?.id, d.owner?.name),
      primaryContactId: ref(
        'contacts',
        d.primaryContact?.id,
        d.primaryContact ? `${d.primaryContact.firstName} ${d.primaryContact.lastName}` : null,
      ),
      sourceId: ref('sources', d.source?.id, d.source?.name),
      portfolioProductId: ref('portfolio', d.portfolioProduct?.id, d.portfolioProduct?.name),
      tcv: money.tcvCents,
      mrr: money.mrrCents,
      oneOff: money.oneOffCents,
      probability: money.probabilityBps,
      weighted: money.weightedCents,
      expectedCloseDate: d.expectedCloseDate,
      actualCloseDate: d.actualCloseDate,
      nextStep: d.nextStep,
      nextStepDate: d.nextStepDate,
      daysInStage: daysBetween(d.stageEnteredAt),
      hygiene: hygieneFlag(d),
      contractMonths: d.contractMonths,
      qualification: qualificationScore(d),
      championIdentified: d.championIdentified,
      economicBuyerIdentified: d.economicBuyerIdentified,
      painDocumented: d.painDocumented,
      decisionProcessDocumented: d.decisionProcessDocumented,
      lossReason: d.lossReason,
      lossNotes: d.lossNotes,
      notes: d.notes,
      createdAt: iso(d.createdAt),
    }
  })
}

/* ---------------------------------------------------------- organizations */

async function organizationRows(): Promise<Row[]> {
  const rows = await db.query.organizations.findMany({
    with: {
      owner: { columns: { id: true, name: true } },
      source: { columns: { id: true, name: true } },
      deals: {
        columns: { stage: true, contractMonths: true, probabilityOverrideBps: true },
        with: { lineItems: { columns: { quantity: true, unitPriceCents: true, discountBps: true, billing: true } } },
      },
      activities: { columns: { occurredAt: true } },
    },
    orderBy: [desc(t.organizations.updatedAt)],
  })

  return rows.map((o): Row => {
    const open = o.deals.filter((d) => isOpenStage(d.stage))
    const openPipeline = open.reduce((sum, d) => sum + dealMoney(d).tcvCents, 0)
    const last = o.activities.reduce<Date | null>(
      (acc, a) => (!acc || a.occurredAt > acc ? a.occurredAt : acc),
      null,
    )
    return {
      id: o.id,
      name: o.name,
      legalName: o.legalName,
      domain: o.domain,
      types: o.types,
      lifecycle: o.lifecycle,
      segment: o.segment,
      industry: o.industry,
      country: o.country,
      city: o.city,
      employeeCount: o.employeeCount,
      website: o.website,
      vatId: o.vatId,
      notes: o.notes,
      ownerId: ref('team', o.owner?.id, o.owner?.name),
      sourceId: ref('sources', o.source?.id, o.source?.name),
      openPipeline,
      dealCount: open.length,
      lastActivity: iso(last),
      daysSinceContact: last ? daysBetween(last) : null,
    }
  })
}

/* --------------------------------------------------------------- contacts */

async function contactRows(): Promise<Row[]> {
  const rows = await db.query.contacts.findMany({
    with: {
      organization: { columns: { id: true, name: true } },
      owner: { columns: { id: true, name: true } },
      activities: { columns: { occurredAt: true } },
    },
    orderBy: [desc(t.contacts.updatedAt)],
  })

  return rows.map((c): Row => {
    const last = c.activities.reduce<Date | null>(
      (acc, a) => (!acc || a.occurredAt > acc ? a.occurredAt : acc),
      null,
    )
    return {
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      title: c.title,
      persona: c.persona,
      status: c.status,
      marketingOptIn: c.marketingOptIn,
      language: c.language,
      linkedin: c.linkedin,
      notes: c.notes,
      organizationId: ref('organizations', c.organization?.id, c.organization?.name),
      ownerId: ref('team', c.owner?.id, c.owner?.name),
      lastContacted: iso(last),
    }
  })
}

/* ------------------------------------------------------------- activities */

async function activityRows(): Promise<Row[]> {
  const rows = await db.query.activities.findMany({
    with: {
      organization: { columns: { id: true, name: true } },
      deal: { columns: { id: true, name: true } },
      contact: { columns: { id: true, firstName: true, lastName: true } },
      owner: { columns: { id: true, name: true } },
    },
    orderBy: [desc(t.activities.occurredAt)],
    limit: 500,
  })

  return rows.map((a): Row => ({
    id: a.id,
    subject: a.subject,
    type: a.type,
    outcome: a.outcome,
    occurredAt: iso(a.occurredAt),
    nextStep: a.nextStep,
    nextStepDue: a.nextStepDue,
    durationMinutes: a.durationMinutes,
    notes: a.notes,
    organizationId: ref('organizations', a.organization?.id, a.organization?.name),
    dealId: ref('deals', a.deal?.id, a.deal?.name),
    contactId: ref('contacts', a.contact?.id, a.contact ? `${a.contact.firstName} ${a.contact.lastName}` : null),
    ownerId: ref('team', a.owner?.id, a.owner?.name),
  }))
}

/* ------------------------------------------------- products, sources, team */

async function productRows(): Promise<Row[]> {
  const rows = await db.query.products.findMany({
    with: { portfolioProduct: { columns: { id: true, name: true } } },
    orderBy: [t.products.name],
  })
  return rows.map((p): Row => ({
    id: p.id,
    name: p.name,
    type: p.type,
    listPriceCents: p.listPriceCents,
    billing: p.billing,
    unit: p.unit,
    costToServeCents: p.costToServeCents,
    grossMargin:
      p.costToServeCents !== null && p.listPriceCents > 0
        ? Math.round(((p.listPriceCents - p.costToServeCents) / p.listPriceCents) * 10_000)
        : null,
    active: p.active,
    description: p.description,
    portfolioProductId: ref('portfolio', p.portfolioProduct?.id, p.portfolioProduct?.name),
  }))
}

async function sourceRows(): Promise<Row[]> {
  const rows = await db.query.sources.findMany({
    with: { organizations: { columns: { id: true } }, deals: { columns: { id: true } } },
    orderBy: [t.sources.name],
  })
  return rows.map((s): Row => ({
    id: s.id,
    name: s.name,
    category: s.category,
    active: s.active,
    monthlyCostCents: s.monthlyCostCents,
    orgCount: s.organizations.length,
    dealCount: s.deals.length,
  }))
}

async function teamRows(): Promise<Row[]> {
  const rows = await db.query.teamMembers.findMany({
    with: {
      ownedDeals: {
        columns: { stage: true, contractMonths: true, probabilityOverrideBps: true },
        with: { lineItems: { columns: { quantity: true, unitPriceCents: true, discountBps: true, billing: true } } },
      },
    },
    orderBy: [t.teamMembers.name],
  })
  return rows.map((m): Row => {
    const open = m.ownedDeals.filter((d) => isOpenStage(d.stage))
    return {
      id: m.id,
      name: m.name,
      role: m.role,
      department: m.department,
      status: m.status,
      email: m.email,
      weeklyCapacityHours: m.weeklyCapacityHours,
      timezone: m.timezone,
      startDate: m.startDate,
      openDeals: open.length,
      openPipeline: open.reduce((sum, d) => sum + dealMoney(d).tcvCents, 0),
    }
  })
}

async function targetRows(): Promise<Row[]> {
  const rows = await db.query.targets.findMany({
    with: { teamMember: { columns: { id: true, name: true } } },
    orderBy: [desc(t.targets.period)],
  })
  return rows.map((x): Row => {
    // The unit lives in tables.ts so the create form, the write and this
    // formatter cannot disagree about what `value` means.
    const unit = TARGET_METRIC_UNIT[x.metric] ?? 'count'
    return {
      id: x.id,
      period: x.period,
      metric: x.metric,
      scope: x.scope,
      value: x.value,
      teamMemberId: ref('team', x.teamMember?.id, x.teamMember?.name),
      displayValue:
        unit === 'money'
          ? `€${Math.round(x.value / 100).toLocaleString('en-IE')}`
          : unit === 'percent'
            ? `${x.value / 100}%`
            : String(x.value),
    }
  })
}

/* ==========================================================================
 * PHASE 2 LOADERS
 * ========================================================================== */

const MINUTE_FIELDS = { minutes: true, billable: true, costRateCents: true, billRateCents: true } as const

async function portfolioRows(): Promise<Row[]> {
  const [items, dealList, projectList, taskList, timeList] = await Promise.all([
    db.query.portfolioProducts.findMany({
      with: { owner: { columns: { id: true, name: true } } },
      orderBy: [t.portfolioProducts.name],
    }),
    db.query.deals.findMany({
      columns: { stage: true, contractMonths: true, probabilityOverrideBps: true, portfolioProductId: true },
      with: { lineItems: { columns: { quantity: true, unitPriceCents: true, discountBps: true, billing: true } } },
    }),
    db.select({ id: t.projects.id, portfolioProductId: t.projects.portfolioProductId, status: t.projects.status })
      .from(t.projects),
    db.select({ id: t.tasks.id, portfolioProductId: t.tasks.portfolioProductId, status: t.tasks.status, projectId: t.tasks.projectId })
      .from(t.tasks),
    db.select({ minutes: t.timeEntries.minutes, costRateCents: t.timeEntries.costRateCents, projectId: t.timeEntries.projectId })
      .from(t.timeEntries),
  ])

  // Time is logged against projects, so cost reaches a product through its projects.
  const projectToProduct = new Map(projectList.map((p) => [p.id, p.portfolioProductId]))

  return items.map((product): Row => {
    const productDeals = dealList.filter((d) => d.portfolioProductId === product.id)
    const wonValue = productDeals
      .filter((d) => d.stage === 'ClosedWon')
      .reduce((sum, d) => sum + dealMoney(d).tcvCents, 0)
    const pipelineValue = productDeals
      .filter((d) => isOpenStage(d.stage))
      .reduce((sum, d) => sum + dealMoney(d).tcvCents, 0)

    const productTime = timeList.filter((e) => e.projectId && projectToProduct.get(e.projectId) === product.id)
    const loggedTime = productTime.reduce((sum, e) => sum + e.minutes, 0)
    const buildCost = productTime.reduce((sum, e) => sum + Math.round((e.minutes / 60) * e.costRateCents), 0)

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      status: product.status,
      description: product.description,
      ownerId: ref('team', product.owner?.id, product.owner?.name),
      launchedAt: product.launchedAt,
      repoUrl: product.repoUrl,
      productionUrl: product.productionUrl,
      active: product.active,
      wonValue,
      pipelineValue,
      buildCost,
      // What the product has earned, less what it cost us to build. The single
      // number the portfolio dimension exists to produce.
      contribution: wonValue - buildCost,
      loggedTime,
      openTasks: taskList.filter(
        (task) =>
          isOpenTask(task.status) &&
          (task.portfolioProductId === product.id ||
            (task.projectId && projectToProduct.get(task.projectId) === product.id)),
      ).length,
      activeProjects: projectList.filter(
        (p) => p.portfolioProductId === product.id && p.status !== 'Closed' && p.status !== 'Cancelled',
      ).length,
    }
  })
}

async function projectRows(): Promise<Row[]> {
  const rows = await db.query.projects.findMany({
    with: {
      organization: { columns: { id: true, name: true } },
      portfolioProduct: { columns: { id: true, name: true } },
      deal: { columns: { id: true, name: true } },
      pm: { columns: { id: true, name: true } },
      milestones: { columns: { status: true, weightBps: true, dueDate: true } },
      timeEntries: { columns: MINUTE_FIELDS },
      tasks: { columns: { blocked: true, status: true } },
    },
    orderBy: [desc(t.projects.updatedAt)],
  })

  return rows.map((p): Row => {
    const roll = projectRollup(p)
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      status: p.status,
      health: p.health,
      healthNote: p.healthNote,
      organizationId: ref('organizations', p.organization?.id, p.organization?.name),
      portfolioProductId: ref('portfolio', p.portfolioProduct?.id, p.portfolioProduct?.name),
      dealId: ref('deals', p.deal?.id, p.deal?.name),
      pmId: ref('team', p.pm?.id, p.pm?.name),
      startDate: p.startDate,
      targetLaunch: p.targetLaunch,
      baselineLaunch: p.baselineLaunch,
      actualLaunch: p.actualLaunch,
      budgetMinutes: p.budgetMinutes,
      contractValueCents: p.contractValueCents,
      scopeSummary: p.scopeSummary,
      repoUrl: p.repoUrl,
      stagingUrl: p.stagingUrl,
      notes: p.notes,
      percentComplete: roll.percentCompleteBps / 10_000,
      burn: roll.burnBps === null ? null : roll.burnBps / 10_000,
      budgetWarning: budgetWarning(roll),
      marginBps: roll.marginBps,
      loggedMinutes: roll.loggedMinutes,
      remainingMinutes: roll.remainingMinutes,
      internalCostCents: roll.internalCostCents,
      openBlockers: roll.openBlockers,
      slipDays: roll.slipDays,
    }
  })
}

async function milestoneRows(): Promise<Row[]> {
  const rows = await db.query.milestones.findMany({
    with: {
      project: { columns: { id: true, name: true } },
      owner: { columns: { id: true, name: true } },
      signedOffBy: { columns: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [t.milestones.projectId, t.milestones.sequence],
  })

  return rows.map((m): Row => ({
    id: m.id,
    name: m.name,
    projectId: ref('projects', m.project?.id, m.project?.name),
    phase: m.phase,
    status: m.status,
    ownerId: ref('team', m.owner?.id, m.owner?.name),
    sequence: m.sequence,
    startDate: m.startDate,
    dueDate: m.dueDate,
    baselineDue: m.baselineDue,
    completedDate: m.completedDate,
    // Slip is measured against the frozen baseline, not the current due date.
    slipDays: m.baselineDue && (m.completedDate ?? m.dueDate)
      ? daysBetween(m.baselineDue, (m.completedDate ?? m.dueDate) as string)
      : null,
    weightBps: m.weightBps,
    acceptanceCriteria: m.acceptanceCriteria,
    clientSignOffRequired: m.clientSignOffRequired,
    signedOffById: ref(
      'contacts', m.signedOffBy?.id,
      m.signedOffBy ? `${m.signedOffBy.firstName} ${m.signedOffBy.lastName}` : null,
    ),
    signedOffDate: m.signedOffDate,
    paymentTrigger: m.paymentTrigger,
    invoiceAmountCents: m.invoiceAmountCents,
  }))
}

async function taskRows(): Promise<Row[]> {
  const rows = await db.query.tasks.findMany({
    with: {
      project: { columns: { id: true, name: true } },
      milestone: { columns: { id: true, name: true } },
      sprint: { columns: { id: true, name: true } },
      portfolioProduct: { columns: { id: true, name: true } },
      assignee: { columns: { id: true, name: true } },
      reviewer: { columns: { id: true, name: true } },
      timeEntries: { columns: { minutes: true } },
    },
    orderBy: [desc(t.tasks.updatedAt)],
  })

  return rows.map((task): Row => ({
    id: task.id,
    title: task.title,
    type: task.type,
    status: task.status,
    blocked: task.blocked,
    blockedReason: task.blockedReason,
    priority: task.priority,
    severity: task.severity,
    reportSource: task.reportSource,
    projectId: ref('projects', task.project?.id, task.project?.name),
    milestoneId: ref('milestones', task.milestone?.id, task.milestone?.name),
    sprintId: ref('sprints', task.sprint?.id, task.sprint?.name),
    portfolioProductId: ref('portfolio', task.portfolioProduct?.id, task.portfolioProduct?.name),
    assigneeId: ref('team', task.assignee?.id, task.assignee?.name),
    reviewerId: ref('team', task.reviewer?.id, task.reviewer?.name),
    estimateMinutes: task.estimateMinutes,
    loggedMinutes: task.timeEntries.reduce((sum, e) => sum + e.minutes, 0),
    startDate: task.startDate,
    dueDate: task.dueDate,
    cycleTimeDays: cycleTimeDays(task.inProgressAt, task.completedAt),
    acceptanceCriteria: task.acceptanceCriteria,
    reproSteps: task.reproSteps,
    prUrl: task.prUrl,
  }))
}

async function sprintRows(): Promise<Row[]> {
  const rows = await db.query.sprints.findMany({
    with: { tasks: { columns: { status: true, estimateMinutes: true } } },
    orderBy: [desc(t.sprints.startDate)],
  })

  return rows.map((s): Row => {
    const completed = s.tasks
      .filter((task) => task.status === 'Done')
      .reduce((sum, task) => sum + task.estimateMinutes, 0)
    return {
      id: s.id,
      name: s.name,
      goal: s.goal,
      status: s.status,
      startDate: s.startDate,
      endDate: s.endDate,
      committedMinutes: s.committedMinutes,
      completedMinutes: completed,
      carryOverMinutes: Math.max(0, s.committedMinutes - completed),
      taskCount: s.tasks.length,
      retroNotes: s.retroNotes,
    }
  })
}

async function timeEntryRows(): Promise<Row[]> {
  const rows = await db.query.timeEntries.findMany({
    with: {
      teamMember: { columns: { id: true, name: true } },
      project: { columns: { id: true, name: true } },
      task: { columns: { id: true, title: true } },
      invoice: { columns: { id: true, number: true, status: true } },
    },
    orderBy: [desc(t.timeEntries.workedOn)],
    limit: 500,
  })

  return rows.map((e): Row => ({
    id: e.id,
    label: `${e.teamMember?.name ?? '—'} · ${e.task?.title ?? e.project?.name ?? 'Unassigned'}`,
    teamMemberId: ref('team', e.teamMember?.id, e.teamMember?.name),
    workedOn: e.workedOn,
    minutes: e.minutes,
    projectId: ref('projects', e.project?.id, e.project?.name),
    taskId: ref('tasks', e.task?.id, e.task?.title),
    billable: e.billable,
    costCents: Math.round((e.minutes / 60) * e.costRateCents),
    revenueCents: e.billable ? Math.round((e.minutes / 60) * e.billRateCents) : 0,
    invoiced: timeIsInvoiced({ invoiceId: e.invoiceId, invoiceStatus: e.invoice?.status }),
    invoiceId: ref('invoices', e.invoice?.id, e.invoice?.number),
    notes: e.notes,
  }))
}

async function allocationRows(): Promise<Row[]> {
  const rows = await db.query.allocations.findMany({
    with: {
      teamMember: { columns: { id: true, name: true } },
      project: { columns: { id: true, name: true } },
      portfolioProduct: { columns: { id: true, name: true } },
    },
    orderBy: [desc(t.allocations.weekStarting)],
    limit: 400,
  })

  return rows.map((a): Row => ({
    id: a.id,
    label: `${a.teamMember?.name ?? '—'} · week of ${a.weekStarting}`,
    teamMemberId: ref('team', a.teamMember?.id, a.teamMember?.name),
    weekStarting: a.weekStarting,
    plannedMinutes: a.plannedMinutes,
    projectId: ref('projects', a.project?.id, a.project?.name),
    portfolioProductId: ref('portfolio', a.portfolioProduct?.id, a.portfolioProduct?.name),
    billable: a.billable,
    confidence: a.confidence,
    roleOnEngagement: a.roleOnEngagement,
  }))
}

async function absenceRows(): Promise<Row[]> {
  const rows = await db.query.absences.findMany({
    with: { teamMember: { columns: { id: true, name: true } } },
    orderBy: [desc(t.absences.startDate)],
  })

  return rows.map((a): Row => ({
    id: a.id,
    label: `${a.teamMember?.name ?? '—'} · ${a.type}`,
    teamMemberId: ref('team', a.teamMember?.id, a.teamMember?.name),
    type: a.type,
    startDate: a.startDate,
    endDate: a.endDate,
    workingDays: a.workingDays,
    approved: a.approved,
  }))
}

async function changeRequestRows(): Promise<Row[]> {
  const rows = await db.query.changeRequests.findMany({
    with: {
      project: { columns: { id: true, name: true } },
      requestedBy: { columns: { id: true, firstName: true, lastName: true } },
      upsellDeal: { columns: { id: true, name: true } },
    },
    orderBy: [desc(t.changeRequests.raisedDate)],
  })

  return rows.map((cr): Row => ({
    id: cr.id,
    title: cr.title,
    status: cr.status,
    projectId: ref('projects', cr.project?.id, cr.project?.name),
    requestedById: ref(
      'contacts', cr.requestedBy?.id,
      cr.requestedBy ? `${cr.requestedBy.firstName} ${cr.requestedBy.lastName}` : null,
    ),
    raisedDate: cr.raisedDate,
    description: cr.description,
    impactMinutes: cr.impactMinutes,
    impactCostCents: cr.impactCostCents,
    impactDays: cr.impactDays,
    approvedDate: cr.approvedDate,
    upsellDealId: ref('deals', cr.upsellDeal?.id, cr.upsellDeal?.name),
  }))
}

async function riskRows(): Promise<Row[]> {
  const rows = await db.query.risks.findMany({
    with: {
      project: { columns: { id: true, name: true } },
      owner: { columns: { id: true, name: true } },
    },
    orderBy: [desc(t.risks.raisedDate)],
  })

  return rows.map((r): Row => ({
    id: r.id,
    title: r.title,
    category: r.category,
    status: r.status,
    projectId: ref('projects', r.project?.id, r.project?.name),
    probability: r.probability,
    impact: r.impact,
    severity: riskSeverity(r.probability, r.impact),
    ownerId: ref('team', r.owner?.id, r.owner?.name),
    mitigation: r.mitigation,
    raisedDate: r.raisedDate,
    targetDate: r.targetDate,
    resolvedDate: r.resolvedDate,
  }))
}

/* ------------------------------------------------------------------ entry */

const LOADERS: Record<TableId, () => Promise<Row[]>> = {
  deals: dealRows,
  organizations: organizationRows,
  contacts: contactRows,
  activities: activityRows,
  products: productRows,
  sources: sourceRows,
  team: teamRows,
  targets: targetRows,
  portfolio: portfolioRows,
  projects: projectRows,
  milestones: milestoneRows,
  tasks: taskRows,
  sprints: sprintRows,
  timeEntries: timeEntryRows,
  allocations: allocationRows,
  absences: absenceRows,
  changeRequests: changeRequestRows,
  risks: riskRows,
  clients: clientRows,
  subscriptions: subscriptionRows,
  invoices: invoiceRows,
  payments: paymentRows,
  audit: auditRows,
}

/**
 * Fields that expose what people cost, per table.
 *
 * Some are direct (`costCents`), others are arithmetic away from it: margin is
 * (contract − cost) / contract and contract is on the same row, so publishing
 * the margin publishes the cost. Contribution is the same trick with won value.
 */
const COST_FIELDS: Partial<Record<TableId, string[]>> = {
  timeEntries: ['costCents', 'revenueCents'],
  projects: ['internalCostCents', 'marginBps'],
  portfolio: ['buildCost', 'contribution'],
}

/**
 * The one door every grid comes through.
 *
 * Redaction happens here rather than in each loader so a loader added later
 * cannot forget, and server-side rather than in the components because hiding a
 * column in the config still ships the numbers in the payload.
 */
export async function getRows(table: TableId): Promise<Row[]> {
  const session = await auth()
  const role = session?.user?.role ?? null

  // Refuse before loading, not after: the cheapest query is the one not run.
  if (!canRead(role, table)) return []

  const rows = await LOADERS[table]()
  if (canSeeCost(role)) return rows

  const hidden = COST_FIELDS[table]
  if (!hidden) return rows
  return rows.map((row) => {
    const copy = { ...row }
    for (const field of hidden) delete copy[field]
    return copy
  })
}

const EMPTY_LOOKUPS = (): Record<string, { id: string; label: string }[]> => ({
  organizations: [], contacts: [], team: [], sources: [], deals: [], portfolio: [],
  projects: [], milestones: [], sprints: [], tasks: [], invoices: [], subscriptions: [],
})

/**
 * Options for every link and user picker. One query, not twelve.
 *
 * This used to fire a dozen parallel full-table selects on every navigation,
 * each holding a pooler connection, to fill dropdowns that are only read when
 * somebody actually opens a picker. On Vercel that was enough to wedge the
 * layout: the queries queued, the page never rendered, and the function sat
 * there until it hit its timeout — taking every authenticated route with it.
 *
 * A UNION ALL fetches the same data down one connection. Labels are built in
 * SQL so every row has the same shape; grouping and sorting happen here, where
 * they cost nothing.
 */
export async function getLookups(): Promise<Record<string, { id: string; label: string }[]>> {
  try {
    const rows = await db.execute<{ kind: string; id: string; label: string | null }>(sql`
                select 'organizations'  as kind, id,   name                           as label from ${t.organizations}
      union all select 'contacts',            id,   first_name || ' ' || last_name  from ${t.contacts}
      union all select 'team',                id,   name                            from ${t.teamMembers}
      union all select 'sources',             id,   name                            from ${t.sources}
      union all select 'deals',               id,   name                            from ${t.deals}
      union all select 'portfolio',           id,   name                            from ${t.portfolioProducts}
      union all select 'projects',            id,   name                            from ${t.projects}
      union all select 'milestones',          id,   name                            from ${t.milestones}
      union all select 'sprints',             id,   name                            from ${t.sprints}
      union all select 'tasks',               id,   title                           from ${t.tasks}
      union all select 'invoices',            id,   number                          from ${t.invoices}
      union all select 'subscriptions',     s.id,   o.name
                  from ${t.subscriptions} s
                  join ${t.organizations} o on o.id = s.organization_id
    `)

    const grouped = EMPTY_LOOKUPS()
    for (const row of rowsOf<{ kind: string; id: string; label: string | null }>(rows)) {
      grouped[row.kind]?.push({ id: row.id, label: row.label ?? '' })
    }
    for (const bucket of Object.values(grouped)) bucket.sort((a, b) => a.label.localeCompare(b.label))
    return grouped
  } catch (error) {
    // Pickers degrade to empty rather than taking the page down with them.
    console.error('getLookups failed; rendering without picker options', error)
    return EMPTY_LOOKUPS()
  }
}

/* -------------------------------------------------------------- dashboard */

export async function getDashboard() {
  const [dealsAll, orgs, acts, targetRowsRaw] = await Promise.all([
    db.query.deals.findMany({
      with: {
        owner: { columns: { id: true, name: true } },
        organization: { columns: { id: true, name: true } },
        lineItems: { columns: { quantity: true, unitPriceCents: true, discountBps: true, billing: true } },
      },
    }),
    db.select({ id: t.organizations.id, lifecycle: t.organizations.lifecycle }).from(t.organizations),
    db.query.activities.findMany({
      with: { owner: { columns: { name: true } }, organization: { columns: { name: true } } },
      orderBy: [desc(t.activities.occurredAt)],
      limit: 6,
    }),
    db.select().from(t.targets).where(eq(t.targets.scope, 'Company')),
  ])

  const enriched = dealsAll.map((d) => ({ ...d, money: dealMoney(d), flag: hygieneFlag(d) }))
  const open = enriched.filter((d) => isOpenStage(d.stage))
  const won = enriched.filter((d) => d.stage === 'ClosedWon')
  const lost = enriched.filter((d) => d.stage === 'ClosedLost')

  const quarterTarget =
    targetRowsRaw.find((x) => x.metric === 'NewBusinessTCV')?.value ?? 0
  const weighted = open.reduce((s, d) => s + d.money.weightedCents, 0)

  const byStage = ['Qualifying', 'Discovery', 'SolutionFit', 'Proposal', 'Negotiation'].map((stage) => {
    const items = enriched.filter((d) => d.stage === stage)
    return { stage, count: items.length, valueCents: items.reduce((s, d) => s + d.money.tcvCents, 0) }
  })

  const attention = enriched
    .filter((d) => d.flag)
    .sort((a, b) => b.money.tcvCents - a.money.tcvCents)
    .slice(0, 8)
    .map((d) => ({ id: d.id, name: d.name, flag: d.flag, valueCents: d.money.tcvCents }))

  // Receivables and renewals: the two questions the pipeline half of this
  // dashboard could never answer.
  const [invoiceList, subscriptionList] = await Promise.all([
    db.query.invoices.findMany({
      with: {
        organization: { columns: { name: true } },
        payments: { columns: { amountCents: true } },
      },
    }),
    db.query.subscriptions.findMany({
      where: eq(t.subscriptions.status, 'Active'),
      with: { organization: { columns: { name: true } } },
    }),
  ])

  const invoiceStates = invoiceList.map((i) => ({ invoice: i, state: invoiceState(i, i.payments) }))
  const overdueList = invoiceStates
    .filter((x) => x.state.state === 'Overdue')
    .sort((a, b) => b.state.daysOverdue - a.state.daysOverdue)

  const renewals = subscriptionList
    .map((s) => ({
      id: s.id,
      org: s.organization?.name ?? '',
      renewsOn: s.renewsOn,
      days: daysUntilRenewal(s.renewsOn),
      mrrCents: s.mrrCents,
    }))
    .filter((r) => r.days <= 90)
    .sort((a, b) => a.days - b.days)

  return {
    openPipelineCents: open.reduce((s, d) => s + d.money.tcvCents, 0),
    weightedCents: weighted,
    openCount: open.length,
    mrrCents: won.reduce((s, d) => s + d.money.mrrCents, 0),
    winRate: won.length + lost.length > 0 ? won.length / (won.length + lost.length) : null,
    wonCount: won.length,
    lostCount: lost.length,
    customerCount: orgs.filter((o) => o.lifecycle === 'Customer').length,
    quarterTargetCents: quarterTarget,
    coverage: quarterTarget > 0 ? weighted / quarterTarget : null,
    byStage,
    attention,
    /** Live subscription revenue, as opposed to MRR inferred from won deals. */
    activeMrrCents: subscriptionList.reduce((s, x) => s + x.mrrCents, 0),
    outstandingCents: invoiceStates.reduce((s, x) => s + x.state.outstandingCents, 0),
    overdueCents: overdueList.reduce((s, x) => s + x.state.outstandingCents, 0),
    overdueCount: overdueList.length,
    oldestOverdueDays: overdueList[0]?.state.daysOverdue ?? 0,
    overdue: overdueList.slice(0, 5).map((x) => ({
      id: x.invoice.id,
      number: x.invoice.number,
      org: x.invoice.organization?.name ?? '',
      outstandingCents: x.state.outstandingCents,
      daysOverdue: x.state.daysOverdue,
      bucket: x.state.agingBucket,
    })),
    renewals: renewals.slice(0, 5),
    renewalCount: renewals.length,
    recent: acts.map((a) => ({
      id: a.id,
      subject: a.subject,
      owner: a.owner?.name ?? '—',
      org: a.organization?.name ?? '',
      date: iso(a.occurredAt),
    })),
  }
}

/**
 * The Phase 2 half of the dashboard: is delivery on track, where is capacity
 * going, and is each product earning more than it costs to build.
 */
export async function getDelivery() {
  const session = await auth()
  const showCost = canSeeCost(session?.user?.role ?? null)

  const [projectList, taskList, riskList, folio, allocationList, absenceList, members] = await Promise.all([
    db.query.projects.findMany({
      with: {
        organization: { columns: { name: true } },
        portfolioProduct: { columns: { name: true, color: true } },
        milestones: { columns: { status: true, weightBps: true, dueDate: true } },
        timeEntries: { columns: { minutes: true, billable: true, costRateCents: true } },
        tasks: { columns: { blocked: true, status: true } },
      },
    }),
    db.select({
      id: t.tasks.id, title: t.tasks.title, status: t.tasks.status, blocked: t.tasks.blocked,
      priority: t.tasks.priority, blockedReason: t.tasks.blockedReason,
    }).from(t.tasks),
    db.query.risks.findMany({
      where: eq(t.risks.status, 'Open'),
      with: { project: { columns: { name: true } } },
    }),
    portfolioRows(),
    db.select({
      memberId: t.allocations.teamMemberId, weekStarting: t.allocations.weekStarting,
      minutes: t.allocations.plannedMinutes,
    }).from(t.allocations),
    db.select({
      memberId: t.absences.teamMemberId, startDate: t.absences.startDate,
      endDate: t.absences.endDate, days: t.absences.workingDays, approved: t.absences.approved,
    }).from(t.absences),
    db.select({
      id: t.teamMembers.id, name: t.teamMembers.name,
      capacity: t.teamMembers.weeklyCapacityHours, status: t.teamMembers.status,
    }).from(t.teamMembers).where(eq(t.teamMembers.status, 'Active')),
  ])

  const active = projectList.filter((p) => p.status !== 'Closed' && p.status !== 'Cancelled')

  const projects = active
    .map((p) => {
      const roll = projectRollup(p)
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        health: p.health,
        healthNote: p.healthNote,
        client: p.organization?.name ?? p.portfolioProduct?.name ?? 'Internal',
        percentComplete: roll.percentCompleteBps / 10_000,
        burn: roll.burnBps === null ? null : roll.burnBps / 10_000,
        warning: budgetWarning(roll),
        marginBps: roll.marginBps,
        targetLaunch: p.targetLaunch,
        slipDays: roll.slipDays,
        blockers: roll.openBlockers,
      }
    })
    .sort((a, b) => {
      const rank = { Red: 0, Amber: 1, Green: 2 } as Record<string, number>
      return (rank[a.health] ?? 3) - (rank[b.health] ?? 3)
    })

  // Capacity for the current week only. Planned against available.
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const mondayISO = monday.toISOString().slice(0, 10)
  const weekEndISO = new Date(monday.getTime() + 6 * 86_400_000).toISOString().slice(0, 10)

  const capacity = members.map((m) => {
    const planned = allocationList
      .filter((a) => a.memberId === m.id && a.weekStarting === mondayISO)
      .reduce((sum, a) => sum + a.minutes, 0)
    const away = absenceList
      .filter((a) => a.approved && a.memberId === m.id && a.startDate <= weekEndISO && a.endDate >= mondayISO)
      .reduce((sum, a) => sum + a.days, 0)
    const availableMinutes = Math.max(0, (m.capacity - away * (m.capacity / 5)) * 60)
    return {
      id: m.id,
      name: m.name,
      plannedMinutes: planned,
      availableMinutes,
      loadBps: availableMinutes > 0 ? Math.round((planned / availableMinutes) * 10_000) : null,
      away,
    }
  }).sort((a, b) => (b.loadBps ?? 0) - (a.loadBps ?? 0))

  return {
    projects,
    redCount: projects.filter((p) => p.health === 'Red').length,
    amberCount: projects.filter((p) => p.health === 'Amber').length,
    blockedTasks: taskList.filter((task) => task.blocked && isOpenTask(task.status)),
    openP0: taskList.filter((task) => task.priority === 'P0' && isOpenTask(task.status)).length,
    risks: riskList.map((r) => ({
      id: r.id,
      title: r.title,
      project: r.project?.name ?? '',
      severity: riskSeverity(r.probability, r.impact),
    })).sort((a, b) => b.severity - a.severity),
    /**
     * `showCost` gates the delivery-cost half of the portfolio bars and the
     * contribution figure — both are derived from hourly cost rates, so
     * publishing them to the whole team publishes what everyone is paid.
     */
    showCost,
    portfolio: folio
      .map((p) => ({
        id: String(p.id),
        name: String(p.name),
        status: String(p.status),
        won: Number(p.wonValue ?? 0),
        pipeline: Number(p.pipelineValue ?? 0),
        cost: showCost ? Number(p.buildCost ?? 0) : 0,
        contribution: showCost ? Number(p.contribution ?? 0) : 0,
        openTasks: Number(p.openTasks ?? 0),
      }))
      .sort((a, b) => (showCost ? b.contribution - a.contribution : b.won - a.won)),
    weekStarting: mondayISO,
    capacity,
    overAllocated: capacity.filter((c) => (c.loadBps ?? 0) > 10_000).length,
  }
}

export async function getMyWork(memberId: string | null) {
  if (!memberId) return { deals: [], tasks: [], activities: [] }
  const [myDeals, myTasks, myActs] = await Promise.all([
    db.query.deals.findMany({
      where: eq(t.deals.ownerId, memberId),
      with: {
        organization: { columns: { name: true } },
        lineItems: { columns: { quantity: true, unitPriceCents: true, discountBps: true, billing: true } },
      },
    }),
    /**
     * Tasks assigned to you.
     *
     * This is what most people mean by "my work", and until now nothing asked
     * for it — assigneeId was written by the grid, displayed as a column, and
     * never queried. So a page called My work showed you deals you own and
     * nothing you had actually been given to do.
     */
    db.query.tasks.findMany({
      where: eq(t.tasks.assigneeId, memberId),
      with: {
        project: { columns: { name: true } },
        milestone: { columns: { name: true } },
        // Portfolio work has no project — most tasks here hang off a product.
        portfolioProduct: { columns: { name: true } },
      },
    }),
    db.query.activities.findMany({
      where: eq(t.activities.ownerId, memberId),
      orderBy: [desc(t.activities.occurredAt)],
      limit: 12,
      with: { organization: { columns: { name: true } } },
    }),
  ])

  return {
    deals: myDeals
      .filter((d) => isOpenStage(d.stage))
      .map((d) => ({
        id: d.id,
        name: d.name,
        stage: d.stage,
        org: d.organization?.name ?? '',
        valueCents: dealMoney(d).tcvCents,
        closeDate: d.expectedCloseDate,
        flag: hygieneFlag(d),
      }))
      .sort((a, b) => b.valueCents - a.valueCents),
    /**
     * Ordered the way you would triage them: blocked first because somebody
     * else has to move before you can, then overdue, then by due date, and
     * priority only breaks ties. Sorting by priority alone buries a P2 that
     * was due last week under a P0 due next month.
     */
    tasks: myTasks
      .filter((task) => isOpenTask(task.status))
      .map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        blocked: task.blocked,
        blockedReason: task.blockedReason,
        dueDate: task.dueDate,
        overdue: Boolean(task.dueDate && task.dueDate < toISODate(new Date())),
        // Whichever of the three this task hangs off, so the row says where
        // the work lives rather than showing a bare title.
        project: task.project?.name ?? task.portfolioProduct?.name ?? task.milestone?.name ?? '',
      }))
      .sort((a, b) => {
        if (a.blocked !== b.blocked) return a.blocked ? -1 : 1
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
        // Undated work sits below anything with a date on it.
        if (a.dueDate !== b.dueDate) return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
        return a.priority.localeCompare(b.priority)
      }),
    activities: myActs.map((a) => ({
      id: a.id,
      subject: a.subject,
      org: a.organization?.name ?? '',
      date: iso(a.occurredAt),
      nextStep: a.nextStep,
      nextStepDue: a.nextStepDue,
    })),
  }
}

/**
 * The signed-in member's own Team row, for the settings dialog.
 *
 * Deliberately narrow: no cost or bill rate. Those are on the Team table behind
 * spec section 10's warning, and a settings screen is the last place they should
 * leak into.
 */
export async function getMyProfile(memberId: string) {
  const member = await db.query.teamMembers.findFirst({
    where: eq(t.teamMembers.id, memberId),
    columns: {
      id: true, name: true, email: true, role: true, department: true, status: true,
      weeklyCapacityHours: true, timezone: true, squad: true, startDate: true,
    },
  })
  return member ?? null
}

export type MyProfile = NonNullable<Awaited<ReturnType<typeof getMyProfile>>>

/* ==========================================================================
 * REVENUE LOADERS
 * ========================================================================== */

async function subscriptionRows(): Promise<Row[]> {
  const rows = await db.query.subscriptions.findMany({
    with: {
      organization: { columns: { id: true, name: true } },
      portfolioProduct: { columns: { id: true, name: true } },
      deal: { columns: { id: true, name: true } },
      owner: { columns: { id: true, name: true } },
    },
    orderBy: [t.subscriptions.renewsOn],
  })

  return rows.map((s): Row => ({
    id: s.id,
    organizationId: ref('organizations', s.organization?.id, s.organization?.name),
    status: s.status,
    portfolioProductId: ref('portfolio', s.portfolioProduct?.id, s.portfolioProduct?.name),
    mrrCents: s.mrrCents,
    renewsOn: s.renewsOn,
    // Only meaningful while it is running — a cancelled subscription counting
    // down to a renewal it will never reach is noise on the renewals timeline.
    daysToRenewal: s.status === 'Active' ? daysUntilRenewal(s.renewsOn) : null,
    arrCents: s.mrrCents * 12,
    termMonths: s.termMonths,
    autoRenew: s.autoRenew,
    startDate: s.startDate,
    billing: s.billing,
    dealId: ref('deals', s.deal?.id, s.deal?.name),
    ownerId: ref('team', s.owner?.id, s.owner?.name),
    endedOn: s.endedOn,
    cancelReason: s.cancelReason,
    notes: s.notes,
  }))
}

async function invoiceRows(): Promise<Row[]> {
  const rows = await db.query.invoices.findMany({
    with: {
      organization: { columns: { id: true, name: true } },
      project: { columns: { id: true, name: true } },
      subscription: { columns: { id: true }, with: { organization: { columns: { name: true } } } },
      milestone: { columns: { id: true, name: true } },
      owner: { columns: { id: true, name: true } },
      payments: { columns: { amountCents: true } },
    },
    orderBy: [desc(t.invoices.issueDate)],
  })

  return rows.map((i): Row => {
    const state = invoiceState(i, i.payments)
    return {
      id: i.id,
      number: i.number,
      organizationId: ref('organizations', i.organization?.id, i.organization?.name),
      state: state.state,
      totalCents: state.totalCents,
      paidCents: state.paidCents,
      outstandingCents: state.outstandingCents,
      dueDate: i.dueDate,
      daysOverdue: state.daysOverdue || null,
      agingBucket: state.agingBucket || null,
      status: i.status,
      issueDate: i.issueDate,
      amountCents: i.amountCents,
      taxCents: i.taxCents,
      projectId: ref('projects', i.project?.id, i.project?.name),
      subscriptionId: ref('subscriptions', i.subscription?.id, i.subscription?.organization?.name),
      milestoneId: ref('milestones', i.milestone?.id, i.milestone?.name),
      ownerId: ref('team', i.owner?.id, i.owner?.name),
      notes: i.notes,
    }
  })
}

async function paymentRows(): Promise<Row[]> {
  const rows = await db.query.payments.findMany({
    with: {
      invoice: {
        columns: { id: true, number: true },
        with: { organization: { columns: { name: true } } },
      },
    },
    orderBy: [desc(t.payments.paidOn)],
  })

  return rows.map((p): Row => ({
    id: p.id,
    invoiceId: ref('invoices', p.invoice?.id, p.invoice?.number),
    client: p.invoice?.organization?.name ?? '',
    amountCents: p.amountCents,
    paidOn: p.paidOn,
    method: p.method,
    reference: p.reference,
    notes: p.notes,
  }))
}

/**
 * The client cockpit: one row per customer, pulling together what they pay us,
 * what they owe us, and how warm the relationship is.
 *
 * Restricted to organizations that have actually reached Customer — a Clients
 * list that includes leads is just the Organizations grid with extra columns.
 */
async function clientRows(): Promise<Row[]> {
  const rows = await db.query.organizations.findMany({
    with: {
      owner: { columns: { id: true, name: true } },
      deals: { columns: { stage: true, contractMonths: true, probabilityOverrideBps: true },
        with: { lineItems: { columns: { quantity: true, unitPriceCents: true, discountBps: true, billing: true } } } },
      activities: { columns: { occurredAt: true } },
      projects: { columns: { health: true, status: true } },
      subscriptions: true,
      invoices: { with: { payments: { columns: { amountCents: true } } } },
    },
    orderBy: [t.organizations.name],
  })

  return rows
    .filter((o) => o.lifecycle === 'Customer' || o.types.includes('Customer') || o.subscriptions.length > 0)
    .map((o): Row => {
      const open = o.deals.filter((d) => isOpenStage(d.stage))
      const lastActivity = o.activities.reduce<Date | null>(
        (acc, a) => (!acc || a.occurredAt > acc ? a.occurredAt : acc),
        null,
      )

      const live = o.subscriptions.filter((s) => s.status === 'Active')
      const mrr = live.reduce((sum, s) => sum + s.mrrCents, 0)
      // The soonest renewal is the one that matters; a client on three plans is
      // at risk on the first date, not the average of them.
      const nextRenewal = live.map((s) => s.renewsOn).sort()[0] ?? null

      const states = o.invoices.map((i) => invoiceState(i, i.payments))
      const outstanding = states.reduce((sum, s) => sum + s.outstandingCents, 0)
      const overdue = states.reduce((sum, s) => sum + (s.state === 'Overdue' ? s.outstandingCents : 0), 0)
      const maxDaysOverdue = states.reduce((max, s) => Math.max(max, s.daysOverdue), 0)

      const health = accountHealth({
        lastActivityAt: iso(lastActivity),
        openDeals: open,
        maxDaysOverdue,
        overdueCents: overdue,
        daysToRenewal: nextRenewal ? daysUntilRenewal(nextRenewal) : null,
        hasRedProject: o.projects.some((p) => p.health === 'Red' && p.status !== 'Closed' && p.status !== 'Cancelled'),
        hasActiveSubscription: live.length > 0,
      })

      return {
        id: o.id,
        name: o.name,
        temperature: health.temperature,
        healthNote: health.reasons.join(' · '),
        mrr,
        subscriptionStatus: live.length > 0
          ? 'Active'
          : o.subscriptions.some((s) => s.status === 'Paused')
            ? 'Paused'
            : o.subscriptions.length > 0
              ? 'Cancelled'
              : null,
        renewsOn: nextRenewal,
        outstanding,
        overdue,
        oldestOverdueDays: maxDaysOverdue || null,
        lastActivity: iso(lastActivity),
        openPipeline: open.reduce((sum, d) => sum + dealMoney(d).tcvCents, 0),
        ownerId: ref('team', o.owner?.id, o.owner?.name),
        segment: o.segment,
        domain: o.domain,
        notes: o.notes,
      }
    })
}

/**
 * The audit log, most recent first.
 *
 * `summary` picks whatever human-readable field the vanished row happened to
 * have, so the grid says "INV-2026-058" rather than a UUID. `payload` is the
 * complete row, pretty-printed — that is what you restore from.
 */
async function auditRows(): Promise<Row[]> {
  const rows = await db.query.auditLog.findMany({
    with: { actor: { columns: { name: true } } },
    orderBy: [desc(t.auditLog.seq)],
    limit: 500,
  })

  const label = (row: Record<string, unknown> | null) => {
    if (!row) return ''
    for (const key of ['number', 'name', 'title', 'subject', 'period', 'email']) {
      if (typeof row[key] === 'string' && row[key]) return row[key] as string
    }
    return String(row.id ?? '')
  }

  return rows.map((a): Row => {
    const body = (a.before ?? a.after) as Record<string, unknown> | null
    return {
      id: a.id,
      at: iso(a.at),
      actor: a.actor?.name ?? a.actorEmail ?? '—',
      action: a.action,
      tableId: a.tableId,
      summary: label(body),
      rowId: a.rowId,
      payload: body ? JSON.stringify(body, null, 2) : '',
    }
  })
}

/* ==========================================================================
 * PROJECT COCKPIT
 * ========================================================================== */

/**
 * Everything about one project in a single round trip.
 *
 * The data was always joined — client, deal, invoices, milestones, time, risks —
 * it just had no surface where it met. Assembling it here rather than in the page
 * keeps the page a rendering concern and the money definitions in compute.ts.
 */
export async function getProject(id: string) {
  const session = await auth()
  const showCost = canSeeCost(session?.user?.role ?? null)

  const project = await db.query.projects.findFirst({
    where: eq(t.projects.id, id),
    with: {
      organization: { columns: { id: true, name: true, domain: true, lifecycle: true } },
      deal: { columns: { id: true, name: true, stage: true } },
      portfolioProduct: { columns: { id: true, name: true, color: true } },
      pm: { columns: { id: true, name: true } },
      milestones: { with: { owner: { columns: { name: true } } } },
      tasks: { with: { assignee: { columns: { name: true } } } },
      risks: { with: { owner: { columns: { name: true } } } },
      changeRequests: true,
      timeEntries: {
        with: {
          teamMember: { columns: { id: true, name: true } },
          invoice: { columns: { status: true } },
        },
      },
      invoices: { with: { payments: { columns: { amountCents: true } } } },
    },
  })
  if (!project) return null

  const rollup = projectRollup(project)
  const money = projectFinancials({
    contractValueCents: project.contractValueCents,
    internalCostCents: rollup.internalCostCents,
    invoices: project.invoices,
  })

  const invoicedMilestones = new Set(project.invoices.map((i) => i.milestoneId).filter(Boolean))
  /** Accepted payment milestones nobody ever raised an invoice for. */
  const unbilledDeliveredCents = project.milestones
    .filter(
      (m) =>
        m.paymentTrigger &&
        (m.status === 'Delivered' || m.status === 'Accepted') &&
        !invoicedMilestones.has(m.id),
    )
    .reduce((sum, m) => sum + m.invoiceAmountCents, 0)

  // Which invoice, if any, each payment-trigger milestone actually produced.
  const invoiceByMilestone = new Map(
    project.invoices.filter((i) => i.milestoneId).map((i) => [i.milestoneId as string, i]),
  )

  // Hours per person on this project, biggest contributor first.
  const byMember = new Map<string, { name: string; minutes: number; billableMinutes: number }>()
  for (const entry of project.timeEntries) {
    const key = entry.teamMember?.id ?? 'unassigned'
    const current = byMember.get(key) ?? {
      name: entry.teamMember?.name ?? 'Unassigned', minutes: 0, billableMinutes: 0,
    }
    current.minutes += entry.minutes
    current.billableMinutes += entry.billable ? entry.minutes : 0
    byMember.set(key, current)
  }

  // The client's subscription, if they are also on a running plan — a project is
  // rarely the whole commercial relationship.
  const subs = project.organization
    ? await db.query.subscriptions.findMany({
        where: and(
          eq(t.subscriptions.organizationId, project.organization.id),
          eq(t.subscriptions.status, 'Active'),
        ),
      })
    : []

  return {
    id: project.id,
    name: project.name,
    type: project.type,
    status: project.status,
    health: project.health,
    healthNote: project.healthNote,
    scopeSummary: project.scopeSummary,
    notes: project.notes,
    repoUrl: project.repoUrl,
    stagingUrl: project.stagingUrl,
    startDate: project.startDate,
    targetLaunch: project.targetLaunch,
    baselineLaunch: project.baselineLaunch,
    actualLaunch: project.actualLaunch,
    budgetMinutes: project.budgetMinutes,

    client: project.organization
      ? { id: project.organization.id, name: project.organization.name, lifecycle: project.organization.lifecycle }
      : null,
    deal: project.deal ? { id: project.deal.id, name: project.deal.name, stage: project.deal.stage } : null,
    product: project.portfolioProduct
      ? { id: project.portfolioProduct.id, name: project.portfolioProduct.name, color: project.portfolioProduct.color }
      : null,
    pm: project.pm?.name ?? null,

    rollup,
    /** Cost and both margins are admin-only, like everywhere else. */
    money: showCost ? money : { ...money, internalCostCents: 0, contractedMarginBps: null, collectedMarginBps: null },
    showCost,

    subscription: subs[0]
      ? {
          id: subs[0].id,
          mrrCents: subs[0].mrrCents,
          renewsOn: subs[0].renewsOn,
          daysToRenewal: daysUntilRenewal(subs[0].renewsOn),
        }
      : null,

    milestones: project.milestones
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map((m) => {
        const linked = invoiceByMilestone.get(m.id)
        // Cancelled is excluded deliberately: it completes the project for the
        // purposes of percent-complete, but a descoped milestone is not billable.
        const delivered = m.status === 'Delivered' || m.status === 'Accepted'
        return {
          id: m.id,
          name: m.name,
          status: m.status,
          phase: m.phase,
          dueDate: m.dueDate,
          baselineDue: m.baselineDue,
          weightBps: m.weightBps,
          owner: m.owner?.name ?? null,
          paymentTrigger: m.paymentTrigger,
          invoiceAmountCents: m.invoiceAmountCents,
          invoice: linked ? { id: linked.id, number: linked.number, status: linked.status } : null,
          /**
           * Accepted work with a payment trigger and no invoice — money earned
           * and never asked for. A trigger on a milestone still in progress is
           * simply not due yet, which is a different thing entirely.
           */
          unbilled: delivered && m.paymentTrigger && !linked,
        }
      }),

    invoices: project.invoices
      .map((i) => ({ invoice: i, state: invoiceState(i, i.payments) }))
      .sort((a, b) => (a.invoice.issueDate < b.invoice.issueDate ? 1 : -1))
      .map(({ invoice, state }) => ({
        id: invoice.id,
        number: invoice.number,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        state: state.state,
        totalCents: state.totalCents,
        outstandingCents: state.outstandingCents,
        daysOverdue: state.daysOverdue,
      })),

    unbilledDeliveredCents,
    /** Hours logged against this project that no live invoice covers. */
    unbilledMinutes: project.timeEntries
      .filter((e) => e.billable && !timeIsInvoiced({ invoiceId: e.invoiceId, invoiceStatus: e.invoice?.status }))
      .reduce((sum, e) => sum + e.minutes, 0),
    team: [...byMember.values()].sort((a, b) => b.minutes - a.minutes),

    openTasks: project.tasks.filter((task) => isOpenTask(task.status)).length,
    blockedTasks: project.tasks
      .filter((task) => task.blocked && isOpenTask(task.status))
      .map((task) => ({ id: task.id, title: task.title, reason: task.blockedReason })),

    risks: project.risks
      .filter((r) => r.status === 'Open' || r.status === 'Mitigating')
      .map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        severity: riskSeverity(r.probability, r.impact),
        owner: r.owner?.name ?? null,
        targetDate: r.targetDate,
      }))
      .sort((a, b) => b.severity - a.severity),

    changeRequests: project.changeRequests
      .filter((c) => c.status !== 'Rejected')
      .map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        impactCostCents: c.impactCostCents,
        impactDays: c.impactDays,
      })),
  }
}

export type ProjectCockpit = NonNullable<Awaited<ReturnType<typeof getProject>>>
