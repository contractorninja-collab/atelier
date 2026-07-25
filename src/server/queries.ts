import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import * as t from '@/db/schema'
import type { LinkRef, Row, TableId } from '@/lib/types'
import {
  budgetWarning, cycleTimeDays, dealMoney, hygieneFlag, isOpenStage, isOpenTask,
  projectRollup, qualificationScore, riskSeverity,
} from './compute'
import { daysBetween } from '@/lib/format'

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
  const moneyMetrics = ['NewBusinessTCV', 'NetNewMRR']
  const pctMetrics = ['BillableUtilization', 'GrossMargin']
  return rows.map((x): Row => ({
    id: x.id,
    period: x.period,
    metric: x.metric,
    scope: x.scope,
    value: x.value,
    teamMemberId: ref('team', x.teamMember?.id, x.teamMember?.name),
    displayValue: moneyMetrics.includes(x.metric)
      ? `€${Math.round(x.value / 100).toLocaleString('en-IE')}`
      : pctMetrics.includes(x.metric)
        ? `${x.value / 100}%`
        : String(x.value),
  }))
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
    invoiced: e.invoiced,
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
}

export function getRows(table: TableId): Promise<Row[]> {
  return LOADERS[table]()
}

/** Options for link and user pickers in the record panel. */
export async function getLookups(): Promise<Record<string, { id: string; label: string }[]>> {
  const [orgs, people, members, srcs, dls, folio, projs, miles, sprnts, tsks] = await Promise.all([
    db.select({ id: t.organizations.id, label: t.organizations.name }).from(t.organizations).orderBy(t.organizations.name),
    db.select({ id: t.contacts.id, first: t.contacts.firstName, last: t.contacts.lastName }).from(t.contacts),
    db.select({ id: t.teamMembers.id, label: t.teamMembers.name }).from(t.teamMembers).orderBy(t.teamMembers.name),
    db.select({ id: t.sources.id, label: t.sources.name }).from(t.sources).orderBy(t.sources.name),
    db.select({ id: t.deals.id, label: t.deals.name }).from(t.deals).orderBy(t.deals.name),
    db.select({ id: t.portfolioProducts.id, label: t.portfolioProducts.name })
      .from(t.portfolioProducts).orderBy(t.portfolioProducts.name),
    db.select({ id: t.projects.id, label: t.projects.name }).from(t.projects).orderBy(t.projects.name),
    db.select({ id: t.milestones.id, label: t.milestones.name }).from(t.milestones).orderBy(t.milestones.name),
    db.select({ id: t.sprints.id, label: t.sprints.name }).from(t.sprints).orderBy(desc(t.sprints.startDate)),
    db.select({ id: t.tasks.id, label: t.tasks.title }).from(t.tasks).orderBy(t.tasks.title),
  ])
  return {
    organizations: orgs,
    contacts: people.map((c) => ({ id: c.id, label: `${c.first} ${c.last}` })).sort((a, b) => a.label.localeCompare(b.label)),
    team: members,
    sources: srcs,
    deals: dls,
    portfolio: folio,
    projects: projs,
    milestones: miles,
    sprints: sprnts,
    tasks: tsks,
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
    portfolio: folio
      .map((p) => ({
        id: String(p.id),
        name: String(p.name),
        status: String(p.status),
        won: Number(p.wonValue ?? 0),
        pipeline: Number(p.pipelineValue ?? 0),
        cost: Number(p.buildCost ?? 0),
        contribution: Number(p.contribution ?? 0),
        openTasks: Number(p.openTasks ?? 0),
      }))
      .sort((a, b) => b.contribution - a.contribution),
    weekStarting: mondayISO,
    capacity,
    overAllocated: capacity.filter((c) => (c.loadBps ?? 0) > 10_000).length,
  }
}

export async function getMyWork(memberId: string | null) {
  if (!memberId) return { deals: [], activities: [] }
  const [myDeals, myActs] = await Promise.all([
    db.query.deals.findMany({
      where: eq(t.deals.ownerId, memberId),
      with: {
        organization: { columns: { name: true } },
        lineItems: { columns: { quantity: true, unitPriceCents: true, discountBps: true, billing: true } },
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
