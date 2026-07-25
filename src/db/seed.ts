/**
 * Seeds a working pipeline so the app is not an empty grid on first run.
 * Safe to re-run: it clears the CRM tables first (auth tables are untouched).
 *
 *   npm run db:seed
 */
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as s from './schema'

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!url) throw new Error('Set DATABASE_URL (and ideally DIRECT_URL) in .env first.')

const client = postgres(url, { max: 1, prepare: false })
const db = drizzle(client, { schema: s })

/**
 * The address you sign in with, and the house domain for everyone else.
 * Change both before seeding. PagaPRO product names below are deliberate:
 * they are what you sell, not what this system is called.
 */
const FOUNDER_EMAIL = 'florianthegooat@gmail.com'

const euros = (n: number) => Math.round(n * 100)

async function main() {
  console.log('Clearing CRM tables…')
  // Phase 2 first — these reference Phase 1 rows.
  await db.delete(s.timeEntries)
  await db.delete(s.allocations)
  await db.delete(s.absences)
  await db.delete(s.risks)
  await db.delete(s.changeRequests)
  await db.delete(s.tasks)
  await db.delete(s.milestones)
  await db.delete(s.sprints)
  await db.delete(s.projects)
  await db.delete(s.portfolioProducts)
  await db.delete(s.dealStageHistory)
  await db.delete(s.dealLineItems)
  await db.delete(s.dealContacts)
  await db.delete(s.activities)
  await db.delete(s.deals)
  await db.delete(s.contacts)
  await db.delete(s.organizations)
  await db.delete(s.targets)
  await db.delete(s.products)
  await db.delete(s.sources)
  await db.delete(s.teamMembers)

  console.log('Team…')
  const team = await db.insert(s.teamMembers).values([
    { name: 'Florian Lambert', email: FOUNDER_EMAIL, role: 'Founder', department: 'Ops', weeklyCapacityHours: 40, costRateCents: euros(0), billRateCents: euros(140) },
    { name: 'Marta Kowalska', email: 'marta@atelier.studio', role: 'AE', department: 'Sales', weeklyCapacityHours: 40, costRateCents: euros(38), billRateCents: euros(0) },
    { name: 'Luca Ferrari', email: 'luca@atelier.studio', role: 'CSM', department: 'Sales', weeklyCapacityHours: 40, costRateCents: euros(34), billRateCents: euros(0) },
    { name: 'Anna Nowak', email: 'anna@atelier.studio', role: 'PM', department: 'Delivery', weeklyCapacityHours: 40, costRateCents: euros(42), billRateCents: euros(110) },
    { name: 'Elena Marchetti', email: 'elena@atelier.studio', role: 'PartnerManager', department: 'Sales', weeklyCapacityHours: 24, costRateCents: euros(36), billRateCents: euros(0) },
    { name: 'Jakub Wiśniewski', email: 'jakub@atelier.studio', role: 'Engineer', department: 'Engineering', weeklyCapacityHours: 40, costRateCents: euros(46), billRateCents: euros(115) },
    { name: 'Piotr Zieliński', email: 'piotr@atelier.studio', role: 'Engineer', department: 'Engineering', weeklyCapacityHours: 40, costRateCents: euros(48), billRateCents: euros(120) },
    { name: 'Sofia Rossi', email: 'sofia@atelier.studio', role: 'Designer', department: 'Engineering', weeklyCapacityHours: 32, costRateCents: euros(40), billRateCents: euros(100) },
  ]).returning()

  const byName = (n: string) => team.find((m) => m.name.startsWith(n))!.id
  const florian = byName('Florian')
  const marta = byName('Marta')
  const luca = byName('Luca')
  const elena = byName('Elena')
  const anna = byName('Anna')
  const jakub = byName('Jakub')
  const piotr = byName('Piotr')

  console.log('Sources…')
  const sources = await db.insert(s.sources).values([
    { name: 'Outbound email', category: 'Outbound' },
    { name: 'Inbound demo request', category: 'Inbound' },
    { name: 'Customer referral', category: 'Referral' },
    { name: 'Partner referral', category: 'Partner' },
    { name: 'Webinar', category: 'Event' },
    { name: 'Organic search', category: 'Organic' },
  ]).returning()
  const src = (n: string) => sources.find((x) => x.name === n)!.id

  console.log('Products…')
  const products = await db.insert(s.products).values([
    { name: 'PagaPRO Starter', type: 'SaaSPlan', listPriceCents: euros(190), billing: 'Monthly', unit: 'Per org', costToServeCents: euros(42), entitlements: ['Payments core', 'Basic dashboard'] },
    { name: 'PagaPRO Pro', type: 'SaaSPlan', listPriceCents: euros(590), billing: 'Monthly', unit: 'Per org', costToServeCents: euros(120), entitlements: ['Payments core', 'Payouts', 'API access'] },
    { name: 'PagaPRO Scale', type: 'SaaSPlan', listPriceCents: euros(1890), billing: 'Monthly', unit: 'Per org', costToServeCents: euros(410), entitlements: ['Everything in Pro', 'SLA', 'Dedicated CSM'] },
    { name: 'Seat add-on', type: 'AddOn', listPriceCents: euros(29), billing: 'Monthly', unit: 'Per seat', costToServeCents: euros(4) },
    { name: 'Implementation', type: 'Service', listPriceCents: euros(12000), billing: 'OneOff', unit: 'Fixed', costToServeCents: euros(6400) },
    { name: 'Custom integration', type: 'Service', listPriceCents: euros(28000), billing: 'OneOff', unit: 'Fixed', costToServeCents: euros(16800) },
    { name: 'Support retainer', type: 'Retainer', listPriceCents: euros(1400), billing: 'Monthly', unit: 'Fixed', costToServeCents: euros(700) },
  ]).returning()
  const prod = (n: string) => products.find((p) => p.name === n)!.id

  console.log('Targets…')
  await db.insert(s.targets).values([
    { period: '2026-Q3', metric: 'NewBusinessTCV', scope: 'Company', value: euros(250_000) },
    { period: '2026-Q3', metric: 'NetNewMRR', scope: 'Company', value: euros(9_000) },
    { period: '2026-Q3', metric: 'ClosedWonCount', scope: 'Company', value: 8 },
    { period: '2026-Q3', metric: 'NewBusinessTCV', scope: 'Individual', value: euros(120_000), teamMemberId: marta },
  ])

  console.log('Organizations…')
  const orgs = await db.insert(s.organizations).values([
    { name: 'Aurora Bank', domain: 'aurorabank.no', lifecycle: 'Opportunity', types: ['Prospect'], segment: 'Enterprise', country: 'Norway', ownerId: florian, sourceId: src('Outbound email'), employeeCount: 2400 },
    { name: 'Vantis Retail', domain: 'vantisretail.nl', lifecycle: 'Opportunity', types: ['Prospect'], segment: 'Enterprise', country: 'Netherlands', ownerId: marta, sourceId: src('Inbound demo request'), employeeCount: 900 },
    { name: 'Nordwind Logistics', domain: 'nordwind-log.de', lifecycle: 'Customer', types: ['Customer'], segment: 'MidMarket', country: 'Germany', ownerId: marta, sourceId: src('Outbound email'), employeeCount: 310 },
    { name: 'Café Milano Group', domain: 'cafemilano.it', lifecycle: 'Customer', types: ['Customer'], segment: 'SMB', country: 'Italy', ownerId: luca, sourceId: src('Customer referral'), employeeCount: 48 },
    { name: 'Bergström AB', domain: 'bergstrom.se', lifecycle: 'Customer', types: ['Customer', 'Reseller'], segment: 'MidMarket', country: 'Sweden', ownerId: luca, sourceId: src('Partner referral'), employeeCount: 220 },
    { name: 'Lumen Health', domain: 'lumenhealth.pl', lifecycle: 'SQL', types: ['Prospect'], segment: 'MidMarket', country: 'Poland', ownerId: marta, sourceId: src('Webinar'), employeeCount: 180 },
    { name: 'Baltic Commerce', domain: 'balticcommerce.lt', lifecycle: 'SQL', types: ['Prospect'], segment: 'MidMarket', country: 'Lithuania', ownerId: marta, sourceId: src('Partner referral'), employeeCount: 140 },
    { name: 'Toro Ventures', domain: 'toroventures.es', lifecycle: 'Lead', types: ['Prospect'], segment: 'SMB', country: 'Spain', ownerId: marta, sourceId: src('Organic search'), employeeCount: 26 },
    { name: 'Helios Energy', domain: 'helios-energy.gr', lifecycle: 'MQL', types: ['Prospect'], segment: 'Enterprise', country: 'Greece', ownerId: marta, sourceId: src('Webinar'), employeeCount: 1600 },
    { name: 'Delta Foods', domain: 'deltafoods.pl', lifecycle: 'Customer', types: ['Customer'], segment: 'SMB', country: 'Poland', ownerId: luca, sourceId: src('Organic search'), employeeCount: 62 },
    { name: 'Meridian Pay Partners', domain: 'meridianpay.pt', lifecycle: 'Customer', types: ['Partner', 'Reseller'], segment: 'MidMarket', country: 'Portugal', ownerId: elena, sourceId: src('Partner referral'), employeeCount: 95 },
    { name: 'Kwiat Studio', domain: 'kwiatstudio.pl', lifecycle: 'Churned', types: ['Prospect'], segment: 'Micro', country: 'Poland', ownerId: luca, sourceId: src('Organic search'), employeeCount: 8 },
  ]).returning()
  const org = (n: string) => orgs.find((o) => o.name.startsWith(n))!.id

  console.log('Contacts…')
  const contacts = await db.insert(s.contacts).values([
    { firstName: 'Ingrid', lastName: 'Solberg', email: 'i.solberg@aurorabank.no', title: 'Head of Payments', persona: 'Champion', organizationId: org('Aurora'), ownerId: florian },
    { firstName: 'Lars', lastName: 'Berg', email: 'l.berg@aurorabank.no', title: 'Chief Risk Officer', persona: 'Blocker', organizationId: org('Aurora'), ownerId: florian },
    { firstName: 'Sanne', lastName: 'de Vries', email: 's.devries@vantisretail.nl', title: 'CFO', persona: 'EconomicBuyer', organizationId: org('Vantis'), ownerId: marta },
    { firstName: 'Henrik', lastName: 'Vogel', email: 'h.vogel@nordwind-log.de', title: 'Head of Operations', persona: 'Champion', organizationId: org('Nordwind'), ownerId: marta },
    { firstName: 'Giulia', lastName: 'Bruno', email: 'giulia@cafemilano.it', title: 'Owner', persona: 'EconomicBuyer', organizationId: org('Café'), ownerId: luca },
    { firstName: 'Tomas', lastName: 'Lindqvist', email: 'tomas@bergstrom.se', title: 'CTO', persona: 'TechnicalEvaluator', organizationId: org('Bergström'), ownerId: luca },
    { firstName: 'Ewa', lastName: 'Mazur', email: 'e.mazur@lumenhealth.pl', title: 'Finance Director', persona: 'Champion', organizationId: org('Lumen'), ownerId: marta },
    { firstName: 'Gintaras', lastName: 'Petrauskas', email: 'g.p@balticcommerce.lt', title: 'COO', persona: 'TechnicalEvaluator', organizationId: org('Baltic'), ownerId: marta },
    { firstName: 'Marek', lastName: 'Dąbrowski', email: 'marek@deltafoods.pl', title: 'Managing Director', persona: 'EconomicBuyer', organizationId: org('Delta'), ownerId: luca },
    { firstName: 'Rita', lastName: 'Almeida', email: 'rita@meridianpay.pt', title: 'Partnerships Lead', persona: 'Champion', organizationId: org('Meridian'), ownerId: elena },
  ]).returning()
  const contact = (email: string) => contacts.find((c) => c.email === email)!.id

  console.log('Deals…')
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)
  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

  const deals = await db.insert(s.deals).values([
    {
      name: 'Aurora Bank — Hybrid — 2026-Q3', stage: 'Negotiation', type: 'Hybrid', forecast: 'Commit',
      organizationId: org('Aurora'), primaryContactId: contact('i.solberg@aurorabank.no'), ownerId: florian,
      sourceId: src('Outbound email'), contractMonths: 24, expectedCloseDate: inDays(20),
      nextStep: 'Legal redlines call with risk team', nextStepDate: inDays(4), stageEnteredAt: daysAgo(11),
      championIdentified: true, economicBuyerIdentified: true, painDocumented: true, decisionProcessDocumented: true,
    },
    {
      name: 'Vantis Retail — Hybrid — 2026-Q3', stage: 'Proposal', type: 'Hybrid', forecast: 'BestCase',
      organizationId: org('Vantis'), primaryContactId: contact('s.devries@vantisretail.nl'), ownerId: marta,
      sourceId: src('Inbound demo request'), contractMonths: 12, expectedCloseDate: inDays(35),
      nextStep: 'Follow up on the pricing sheet', nextStepDate: inDays(2), stageEnteredAt: daysAgo(9),
      championIdentified: true, economicBuyerIdentified: true, painDocumented: true,
    },
    {
      name: 'Lumen Health — Project — 2026-Q3', stage: 'SolutionFit', type: 'Project',
      organizationId: org('Lumen'), primaryContactId: contact('e.mazur@lumenhealth.pl'), ownerId: marta,
      sourceId: src('Webinar'), expectedCloseDate: inDays(52),
      nextStep: 'Technical deep-dive with IT', nextStepDate: inDays(6), stageEnteredAt: daysAgo(14),
      championIdentified: true, painDocumented: true,
    },
    {
      name: 'Baltic Commerce — Subscription — 2026-Q3', stage: 'Discovery', type: 'Subscription',
      organizationId: org('Baltic'), primaryContactId: contact('g.p@balticcommerce.lt'), ownerId: marta,
      sourceId: src('Partner referral'), expectedCloseDate: inDays(66),
      nextStep: 'Send the volume questionnaire', nextStepDate: inDays(3), stageEnteredAt: daysAgo(6),
      painDocumented: true,
    },
    {
      name: 'Bergström AB — Expansion — 2026-Q3', stage: 'Proposal', type: 'Subscription', motion: 'Expansion',
      organizationId: org('Bergström'), primaryContactId: contact('tomas@bergstrom.se'), ownerId: luca,
      sourceId: src('Customer referral'), expectedCloseDate: inDays(14),
      nextStep: 'Seat expansion quote sent — chase Thursday', nextStepDate: inDays(3), stageEnteredAt: daysAgo(8),
      championIdentified: true, economicBuyerIdentified: true, painDocumented: true,
    },
    {
      name: 'Café Milano — Expansion — 2026-Q3', stage: 'Negotiation', type: 'Subscription', motion: 'Expansion',
      organizationId: org('Café'), primaryContactId: contact('giulia@cafemilano.it'), ownerId: luca,
      expectedCloseDate: inDays(7), nextStep: 'Awaiting signature', nextStepDate: inDays(1), stageEnteredAt: daysAgo(5),
      championIdentified: true, economicBuyerIdentified: true, painDocumented: true, decisionProcessDocumented: true,
    },
    {
      // Deliberately unhealthy: no next step. Shows the hygiene flag on first run.
      name: 'Toro Ventures — Subscription — 2026-Q4', stage: 'Qualifying', type: 'Subscription',
      organizationId: org('Toro'), ownerId: marta, sourceId: src('Organic search'),
      expectedCloseDate: inDays(80), stageEnteredAt: daysAgo(23),
    },
    {
      name: 'Helios Energy — Project — 2026-Q4', stage: 'Qualifying', type: 'Project',
      organizationId: org('Helios'), ownerId: marta, sourceId: src('Webinar'),
      expectedCloseDate: inDays(118), nextStep: 'Book the discovery call', nextStepDate: inDays(5), stageEnteredAt: daysAgo(4),
    },
    {
      // Deliberately unhealthy: stalled well past the Solution Fit limit.
      name: 'Meridian — Reseller bundle — 2026-Q3', stage: 'SolutionFit', type: 'Subscription',
      organizationId: org('Meridian'), primaryContactId: contact('rita@meridianpay.pt'), ownerId: elena,
      sourceId: src('Partner referral'), expectedCloseDate: inDays(42),
      nextStep: 'Partner enablement session', nextStepDate: inDays(9), stageEnteredAt: daysAgo(38),
      championIdentified: true,
    },
    {
      name: 'Nordwind — Integration — 2026-Q2', stage: 'ClosedWon', type: 'Hybrid', forecast: 'ClosedWon',
      organizationId: org('Nordwind'), primaryContactId: contact('h.vogel@nordwind-log.de'), ownerId: marta,
      sourceId: src('Outbound email'), contractMonths: 24,
      expectedCloseDate: inDays(-68), actualCloseDate: inDays(-68), stageEnteredAt: daysAgo(68),
      championIdentified: true, economicBuyerIdentified: true, painDocumented: true, decisionProcessDocumented: true,
    },
    {
      name: 'Delta Foods — Upsell — 2026-Q3', stage: 'ClosedWon', type: 'Subscription', motion: 'Upsell',
      forecast: 'ClosedWon', organizationId: org('Delta'), primaryContactId: contact('marek@deltafoods.pl'),
      ownerId: luca, expectedCloseDate: inDays(-23), actualCloseDate: inDays(-23), stageEnteredAt: daysAgo(23),
      championIdentified: true, economicBuyerIdentified: true, painDocumented: true,
    },
    {
      name: 'Kwiat Studio — Subscription — 2026-Q2', stage: 'ClosedLost', type: 'Subscription',
      forecast: 'ClosedLost', organizationId: org('Kwiat'), ownerId: luca,
      expectedCloseDate: inDays(-72), actualCloseDate: inDays(-72), stageEnteredAt: daysAgo(72),
      lossReason: 'Price', lossNotes: 'Went with a cheaper regional processor. Revisit if they scale past 200 transactions a month.',
    },
  ]).returning()
  const deal = (n: string) => deals.find((d) => d.name.startsWith(n))!.id

  console.log('Line items…')
  await db.insert(s.dealLineItems).values([
    { dealId: deal('Aurora'), productId: prod('PagaPRO Scale'), quantity: 3, unitPriceCents: euros(1890), billing: 'Monthly', discountBps: 1000 },
    { dealId: deal('Aurora'), productId: prod('Custom integration'), quantity: 1, unitPriceCents: euros(28000), billing: 'OneOff', estimatedDeliveryHours: 320 },
    { dealId: deal('Aurora'), productId: prod('Implementation'), quantity: 1, unitPriceCents: euros(12000), billing: 'OneOff', estimatedDeliveryHours: 140 },
    { dealId: deal('Vantis'), productId: prod('PagaPRO Scale'), quantity: 2, unitPriceCents: euros(1890), billing: 'Monthly' },
    { dealId: deal('Vantis'), productId: prod('Implementation'), quantity: 1, unitPriceCents: euros(12000), billing: 'OneOff', estimatedDeliveryHours: 140 },
    { dealId: deal('Lumen'), productId: prod('Custom integration'), quantity: 1, unitPriceCents: euros(28000), billing: 'OneOff', discountBps: 500, estimatedDeliveryHours: 300 },
    { dealId: deal('Baltic'), productId: prod('PagaPRO Pro'), quantity: 4, unitPriceCents: euros(590), billing: 'Monthly' },
    { dealId: deal('Bergström'), productId: prod('Seat add-on'), quantity: 40, unitPriceCents: euros(29), billing: 'Monthly' },
    { dealId: deal('Café Milano'), productId: prod('PagaPRO Pro'), quantity: 2, unitPriceCents: euros(590), billing: 'Monthly' },
    { dealId: deal('Toro'), productId: prod('PagaPRO Starter'), quantity: 2, unitPriceCents: euros(190), billing: 'Monthly' },
    { dealId: deal('Helios'), productId: prod('Custom integration'), quantity: 2, unitPriceCents: euros(28000), billing: 'OneOff' },
    { dealId: deal('Meridian'), productId: prod('PagaPRO Pro'), quantity: 5, unitPriceCents: euros(590), billing: 'Monthly', discountBps: 1500 },
    { dealId: deal('Nordwind'), productId: prod('PagaPRO Scale'), quantity: 1, unitPriceCents: euros(1890), billing: 'Monthly' },
    { dealId: deal('Nordwind'), productId: prod('Custom integration'), quantity: 1, unitPriceCents: euros(28000), billing: 'OneOff', estimatedDeliveryHours: 300 },
    { dealId: deal('Delta'), productId: prod('PagaPRO Starter'), quantity: 2, unitPriceCents: euros(190), billing: 'Monthly' },
    { dealId: deal('Kwiat'), productId: prod('PagaPRO Starter'), quantity: 1, unitPriceCents: euros(190), billing: 'Monthly' },
  ])

  console.log('Stage history…')
  await db.insert(s.dealStageHistory).values(
    deals.map((d) => ({
      dealId: d.id,
      fromStage: null,
      toStage: d.stage,
      changedAt: d.stageEnteredAt,
      changedById: d.ownerId,
    })),
  )

  console.log('Activities…')
  await db.insert(s.activities).values([
    { subject: 'Legal redlines review with risk team', type: 'Meeting', outcome: 'NextStepSet', organizationId: org('Aurora'), dealId: deal('Aurora'), contactId: contact('l.berg@aurorabank.no'), ownerId: florian, occurredAt: daysAgo(1), durationMinutes: 60 },
    { subject: 'Pricing sheet walkthrough', type: 'Demo', outcome: 'Positive', organizationId: org('Vantis'), dealId: deal('Vantis'), contactId: contact('s.devries@vantisretail.nl'), ownerId: marta, occurredAt: daysAgo(2), durationMinutes: 45 },
    { subject: 'Expansion signature chase', type: 'Email', outcome: 'Positive', organizationId: org('Café'), dealId: deal('Café Milano'), ownerId: luca, occurredAt: daysAgo(1) },
    { subject: 'Quarterly business review', type: 'QBR', outcome: 'Neutral', organizationId: org('Nordwind'), contactId: contact('h.vogel@nordwind-log.de'), ownerId: luca, occurredAt: daysAgo(3), durationMinutes: 90 },
    { subject: 'Volume questionnaire sent', type: 'Email', outcome: 'NextStepSet', organizationId: org('Baltic'), dealId: deal('Baltic'), ownerId: marta, occurredAt: daysAgo(3) },
    { subject: 'Technical deep-dive scoping', type: 'Call', outcome: 'Positive', organizationId: org('Lumen'), dealId: deal('Lumen'), contactId: contact('e.mazur@lumenhealth.pl'), ownerId: marta, occurredAt: daysAgo(4), durationMinutes: 50 },
    { subject: 'Intro call — inbound from webinar', type: 'Call', outcome: 'NextStepSet', organizationId: org('Helios'), dealId: deal('Helios'), ownerId: marta, occurredAt: daysAgo(5), durationMinutes: 30 },
    { subject: 'Partner enablement session', type: 'Meeting', outcome: 'Neutral', organizationId: org('Meridian'), dealId: deal('Meridian'), contactId: contact('rita@meridianpay.pt'), ownerId: elena, occurredAt: daysAgo(8), durationMinutes: 75 },
    { subject: 'Seat expansion quote', type: 'Email', outcome: 'Positive', organizationId: org('Bergström'), dealId: deal('Bergström'), ownerId: luca, occurredAt: daysAgo(9) },
    { subject: 'Renewal health check', type: 'CheckIn', outcome: 'Neutral', organizationId: org('Nordwind'), ownerId: luca, occurredAt: daysAgo(10), durationMinutes: 25 },
  ])

  console.log('Buying groups…')
  await db.insert(s.dealContacts).values([
    { dealId: deal('Aurora'), contactId: contact('i.solberg@aurorabank.no') },
    { dealId: deal('Aurora'), contactId: contact('l.berg@aurorabank.no') },
    { dealId: deal('Vantis'), contactId: contact('s.devries@vantisretail.nl') },
  ])

  /* ======================================================================
   * PHASE 2 — portfolio, delivery, production, capacity
   * ====================================================================== */

  console.log('Portfolio…')
  const folio = await db.insert(s.portfolioProducts).values([
    {
      name: 'PagaPRO', slug: 'pagapro', status: 'Live', ownerId: florian, color: '#0e9f6e',
      description: 'Merchant payments, onboarding and payouts. The house product.',
      launchedAt: inDays(-420), repoUrl: 'https://github.com/your-org/pagapro',
    },
    {
      name: 'Ledgerline', slug: 'ledgerline', status: 'Building', ownerId: florian, color: '#7c6cf0',
      description: 'Reconciliation and settlement reporting. Second product, not yet launched.',
    },
    {
      name: 'Client work', slug: 'client-work', status: 'Maintenance', ownerId: anna, color: '#d97757',
      description: 'Bespoke delivery that is not tied to one of our own products.',
    },
  ]).returning()
  const fol = (n: string) => folio.find((f) => f.name === n)!.id

  console.log('Linking catalogue and deals to the portfolio…')
  for (const planName of ['PagaPRO Starter', 'PagaPRO Pro', 'PagaPRO Scale', 'Seat add-on']) {
    await db.update(s.products)
      .set({ portfolioProductId: fol('PagaPRO') })
      .where(eq(s.products.name, planName))
  }
  for (const dealName of ['Aurora Bank', 'Vantis Retail', 'Baltic Commerce', 'Bergström AB',
    'Café Milano', 'Toro Ventures', 'Nordwind', 'Delta Foods', 'Kwiat Studio', 'Meridian']) {
    await db.update(s.deals)
      .set({ portfolioProductId: fol('PagaPRO') })
      .where(eq(s.deals.name, deals.find((d) => d.name.startsWith(dealName))!.name))
  }
  await db.update(s.deals)
    .set({ portfolioProductId: fol('Client work') })
    .where(eq(s.deals.id, deal('Lumen')))
  await db.update(s.deals)
    .set({ portfolioProductId: fol('Client work') })
    .where(eq(s.deals.id, deal('Helios')))

  console.log('Projects…')
  const projects = await db.insert(s.projects).values([
    {
      name: 'Nordwind — Payments Integration — 2026', type: 'ClientDelivery', status: 'Build',
      health: 'Amber', healthNote: 'Sandbox credentials from the client are two weeks late; UAT at risk.',
      organizationId: org('Nordwind'), dealId: deal('Nordwind'), portfolioProductId: fol('PagaPRO'),
      pmId: anna, startDate: inDays(-61), targetLaunch: inDays(48), baselineLaunch: inDays(34),
      actualLaunch: null, budgetMinutes: 480 * 60, contractValueCents: euros(58_000),
      scopeSummary: 'Connect Nordwind ERP to PagaPRO payouts. In scope: routing, reconciliation, ERP export. Out of scope: invoice OCR.',
      repoUrl: 'https://github.com/your-org/nordwind-integration',
    },
    {
      name: 'Café Milano — Onboarding — 2026', type: 'ClientDelivery', status: 'Hypercare',
      health: 'Green', organizationId: org('Café'), dealId: deal('Café Milano'),
      portfolioProductId: fol('PagaPRO'), pmId: anna,
      startDate: inDays(-102), targetLaunch: inDays(-22), baselineLaunch: inDays(-22),
      actualLaunch: inDays(-22), budgetMinutes: 120 * 60, contractValueCents: euros(12_680),
      scopeSummary: 'Standard onboarding, eight sites, Italian localisation.',
    },
    {
      name: 'PagaPRO — SEPA Payouts', type: 'InternalProduct', status: 'Discovery',
      health: 'Green', portfolioProductId: fol('PagaPRO'), pmId: florian,
      startDate: inDays(-12), targetLaunch: inDays(125), baselineLaunch: inDays(125),
      budgetMinutes: 640 * 60, contractValueCents: 0,
      scopeSummary: 'Instant SEPA payouts. Blocking the Aurora Bank deal.',
    },
    {
      name: 'Ledgerline — Reconciliation MVP', type: 'InternalProduct', status: 'Build',
      health: 'Red',
      healthNote: 'Scope grew after the compliance review and we are two engineers short.',
      portfolioProductId: fol('Ledgerline'), pmId: florian,
      startDate: inDays(-82), targetLaunch: inDays(34), baselineLaunch: inDays(6),
      budgetMinutes: 900 * 60, contractValueCents: 0,
      scopeSummary: 'Matching engine, exception queue, settlement export.',
    },
  ]).returning()
  const prj = (n: string) => projects.find((p) => p.name.startsWith(n))!.id

  console.log('Milestones…')
  const milestoneSeed: (typeof s.milestones.$inferInsert)[] = []
  const addMilestones = (
    projectId: string,
    rows: [string, string, string, number, number, boolean][],
  ) => {
    rows.forEach(([name, phase, status, weightPct, dueOffset, pays], i) => {
      milestoneSeed.push({
        name, projectId, sequence: i + 1,
        phase: phase as 'Kickoff', status: status as 'NotStarted',
        ownerId: anna, weightBps: weightPct * 100,
        startDate: inDays(dueOffset - 21), dueDate: inDays(dueOffset), baselineDue: inDays(dueOffset - 4),
        completedDate: status === 'Accepted' || status === 'Delivered' ? inDays(dueOffset - 2) : null,
        paymentTrigger: pays, clientSignOffRequired: pays,
        invoiceAmountCents: pays ? euros(weightPct * 580) : 0,
        acceptanceCriteria: 'See the statement of work. Client sign-off required before the next phase starts.',
      })
    })
  }
  addMilestones(prj('Nordwind'), [
    ['Kickoff', 'Kickoff', 'Accepted', 5, -55, true],
    ['Discovery complete', 'DiscoveryComplete', 'Accepted', 10, -40, false],
    ['Integration design sign-off', 'DesignSignOff', 'Accepted', 15, -26, false],
    ['Build — payment routing', 'BuildPhase', 'InProgress', 30, 14, true],
    ['ERP integration', 'Integration', 'Blocked', 20, 27, false],
    ['UAT with Nordwind ops', 'UAT', 'NotStarted', 10, 41, false],
    ['Go-live', 'GoLive', 'NotStarted', 10, 48, true],
  ])
  addMilestones(prj('Café Milano'), [
    ['Kickoff', 'Kickoff', 'Accepted', 10, -95, true],
    ['Configuration & training', 'BuildPhase', 'Accepted', 50, -60, false],
    ['Go-live', 'GoLive', 'Accepted', 30, -22, true],
    ['Hypercare close-out', 'PostLaunchReview', 'InProgress', 10, 9, false],
  ])
  addMilestones(prj('PagaPRO — SEPA'), [
    ['Discovery complete', 'DiscoveryComplete', 'InProgress', 15, 27, false],
    ['Mandate handling', 'BuildPhase', 'NotStarted', 35, 69, false],
    ['Payout engine', 'BuildPhase', 'NotStarted', 35, 104, false],
    ['Launch', 'GoLive', 'NotStarted', 15, 125, false],
  ])
  addMilestones(prj('Ledgerline'), [
    ['Matching engine', 'BuildPhase', 'InProgress', 40, 6, false],
    ['Exception queue', 'BuildPhase', 'NotStarted', 35, 20, false],
    ['Settlement export', 'Integration', 'NotStarted', 25, 34, false],
  ])
  const milestones = await db.insert(s.milestones).values(milestoneSeed).returning()
  const ms = (n: string) => milestones.find((m) => m.name.startsWith(n))!.id

  console.log('Sprints…')
  const sprints = await db.insert(s.sprints).values([
    { name: '2026-W28', goal: 'Stabilise settlement reporting and ship onboarding analytics', status: 'Closed', startDate: inDays(-19), endDate: inDays(-8), committedMinutes: 152 * 60 },
    { name: '2026-W30', goal: 'KYC upload live, SCA exemptions through review, zero P0s open', status: 'Active', startDate: inDays(-5), endDate: inDays(6), committedMinutes: 168 * 60 },
    { name: '2026-W32', goal: 'SEPA mandate rules and the Nordwind ERP mapping', status: 'Planned', startDate: inDays(9), endDate: inDays(20), committedMinutes: 160 * 60 },
  ]).returning()
  const spr = (n: string) => sprints.find((x) => x.name === n)!.id

  console.log('Tasks…')
  const hrs = (h: number) => h * 60
  const tasks = await db.insert(s.tasks).values([
    { title: 'Merchant onboarding: KYC document upload', type: 'Feature', status: 'InProgress', priority: 'P1', portfolioProductId: fol('PagaPRO'), assigneeId: jakub, sprintId: spr('2026-W30'), estimateMinutes: hrs(16), dueDate: inDays(6), inProgressAt: daysAgo(3) },
    { title: 'Payout scheduling engine — spike', type: 'Spike', status: 'InReview', priority: 'P1', projectId: prj('PagaPRO — SEPA'), portfolioProductId: fol('PagaPRO'), assigneeId: piotr, sprintId: spr('2026-W30'), estimateMinutes: hrs(10), dueDate: inDays(4), inProgressAt: daysAgo(5) },
    { title: 'Fix: duplicate webhook on refund', type: 'Bug', status: 'QA', priority: 'P0', severity: 'Critical', reportSource: 'Customer', portfolioProductId: fol('PagaPRO'), assigneeId: piotr, sprintId: spr('2026-W30'), estimateMinutes: hrs(6), dueDate: inDays(2), inProgressAt: daysAgo(4) },
    { title: 'Nordwind ERP field mapping', type: 'Feature', status: 'Backlog', priority: 'P1', blocked: true, blockedReason: 'Waiting on sandbox credentials from the client', projectId: prj('Nordwind'), milestoneId: ms('ERP integration'), portfolioProductId: fol('PagaPRO'), assigneeId: piotr, sprintId: spr('2026-W32'), estimateMinutes: hrs(26), dueDate: inDays(21) },
    { title: 'Payment routing — multi-account support', type: 'Feature', status: 'InProgress', priority: 'P1', projectId: prj('Nordwind'), milestoneId: ms('Build — payment routing'), portfolioProductId: fol('PagaPRO'), assigneeId: jakub, sprintId: spr('2026-W30'), estimateMinutes: hrs(24), dueDate: inDays(12), inProgressAt: daysAgo(8) },
    { title: 'Matching engine — tolerance rules', type: 'Feature', status: 'InProgress', priority: 'P1', projectId: prj('Ledgerline'), milestoneId: ms('Matching engine'), portfolioProductId: fol('Ledgerline'), assigneeId: piotr, sprintId: spr('2026-W30'), estimateMinutes: hrs(30), dueDate: inDays(5), inProgressAt: daysAgo(11) },
    { title: 'Exception queue UI', type: 'Design', status: 'Ready', priority: 'P2', projectId: prj('Ledgerline'), portfolioProductId: fol('Ledgerline'), assigneeId: jakub, sprintId: spr('2026-W32'), estimateMinutes: hrs(12), dueDate: inDays(16) },
    { title: 'SEPA mandate validation rules', type: 'Feature', status: 'Ready', priority: 'P1', projectId: prj('PagaPRO — SEPA'), portfolioProductId: fol('PagaPRO'), assigneeId: piotr, sprintId: spr('2026-W32'), estimateMinutes: hrs(20), dueDate: inDays(18) },
    { title: 'Fix: timezone drift on settlement report', type: 'Bug', status: 'Done', priority: 'P1', severity: 'Major', reportSource: 'InternalQA', portfolioProductId: fol('PagaPRO'), assigneeId: jakub, sprintId: spr('2026-W28'), estimateMinutes: hrs(4), dueDate: inDays(-14), inProgressAt: daysAgo(21), completedAt: daysAgo(16) },
    { title: 'Onboarding funnel analytics events', type: 'Chore', status: 'Done', priority: 'P2', portfolioProductId: fol('PagaPRO'), assigneeId: piotr, sprintId: spr('2026-W28'), estimateMinutes: hrs(6), dueDate: inDays(-16), inProgressAt: daysAgo(24), completedAt: daysAgo(17) },
    { title: 'Café Milano — hypercare punch list', type: 'Chore', status: 'InProgress', priority: 'P2', projectId: prj('Café Milano'), milestoneId: ms('Hypercare close-out'), assigneeId: anna, sprintId: spr('2026-W30'), estimateMinutes: hrs(8), dueDate: inDays(9), inProgressAt: daysAgo(2) },
    { title: 'Nordwind — sandbox smoke tests', type: 'QA', status: 'Backlog', priority: 'P1', blocked: true, blockedReason: 'Blocked by the ERP field mapping', projectId: prj('Nordwind'), assigneeId: anna, sprintId: spr('2026-W32'), estimateMinutes: hrs(10), dueDate: inDays(14) },
    { title: 'Fix: CSV export truncates over 10k rows', type: 'Bug', status: 'Backlog', priority: 'P1', severity: 'Major', reportSource: 'Support', portfolioProductId: fol('PagaPRO'), assigneeId: jakub, estimateMinutes: hrs(4), dueDate: inDays(24) },
    { title: 'API rate-limit headers', type: 'Feature', status: 'QA', priority: 'P2', portfolioProductId: fol('PagaPRO'), assigneeId: piotr, sprintId: spr('2026-W30'), estimateMinutes: hrs(6), dueDate: inDays(6), inProgressAt: daysAgo(6) },
  ]).returning()
  const tsk = (n: string) => tasks.find((x) => x.title.startsWith(n))!.id

  console.log('Time entries…')
  const rateFor = (id: string) => {
    const m = team.find((x) => x.id === id)!
    return { costRateCents: m.costRateCents ?? 0, billRateCents: m.billRateCents ?? 0 }
  }
  const timeSeed: (typeof s.timeEntries.$inferInsert)[] = []
  const logDays: [string, string, string | null, number, number, boolean][] = [
    // member, project, task, daysAgo, hours, billable
    [jakub, prj('Nordwind'), tsk('Payment routing'), 1, 6, true],
    [jakub, prj('Nordwind'), tsk('Payment routing'), 2, 7, true],
    [jakub, prj('Nordwind'), tsk('Payment routing'), 3, 5, true],
    [piotr, prj('Nordwind'), tsk('Nordwind ERP'), 4, 4, true],
    [anna, prj('Nordwind'), null, 2, 3, true],
    [anna, prj('Nordwind'), null, 8, 4, true],
    [jakub, prj('Nordwind'), null, 9, 7, true],
    [piotr, prj('Nordwind'), null, 10, 6, true],
    [jakub, prj('Nordwind'), null, 15, 8, true],
    [piotr, prj('Nordwind'), null, 16, 7, true],
    [anna, prj('Café Milano'), tsk('Café Milano'), 1, 2, true],
    [anna, prj('Café Milano'), null, 6, 3, true],
    [piotr, prj('Ledgerline'), tsk('Matching engine'), 1, 7, false],
    [piotr, prj('Ledgerline'), tsk('Matching engine'), 2, 8, false],
    [piotr, prj('Ledgerline'), tsk('Matching engine'), 3, 6, false],
    [piotr, prj('Ledgerline'), null, 9, 8, false],
    [jakub, prj('Ledgerline'), null, 10, 6, false],
    [piotr, prj('Ledgerline'), null, 16, 8, false],
    [piotr, prj('PagaPRO — SEPA'), tsk('Payout scheduling'), 4, 5, false],
    [florian, prj('PagaPRO — SEPA'), null, 5, 4, false],
  ]
  for (const [member, project, task, ago, h, billable] of logDays) {
    timeSeed.push({
      teamMemberId: member, projectId: project, taskId: task,
      workedOn: inDays(-ago), minutes: hrs(h), billable, ...rateFor(member),
    })
  }
  await db.insert(s.timeEntries).values(timeSeed)

  console.log('Allocations & absences…')
  const monday = (weeksAhead: number) => {
    const d = new Date()
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + weeksAhead * 7)
    return d.toISOString().slice(0, 10)
  }
  const allocSeed: (typeof s.allocations.$inferInsert)[] = []
  for (const week of [0, 1, 2, 3]) {
    allocSeed.push(
      { teamMemberId: jakub, projectId: prj('Nordwind'), weekStarting: monday(week), plannedMinutes: hrs(24), billable: true, roleOnEngagement: 'Lead engineer' },
      { teamMemberId: piotr, projectId: prj('Ledgerline'), weekStarting: monday(week), plannedMinutes: hrs(28), billable: false, roleOnEngagement: 'Engineer' },
      { teamMemberId: anna, projectId: prj('Nordwind'), weekStarting: monday(week), plannedMinutes: hrs(12), billable: true, roleOnEngagement: 'PM' },
      // Piotr is deliberately over-allocated in the near weeks — the capacity
      // view should surface it rather than the team discovering it on Friday.
      { teamMemberId: piotr, projectId: prj('Nordwind'), weekStarting: monday(week), plannedMinutes: hrs(week < 2 ? 16 : 8), billable: true, roleOnEngagement: 'Integrations', confidence: week < 2 ? 'Confirmed' : 'Tentative' },
      { teamMemberId: florian, portfolioProductId: fol('PagaPRO'), weekStarting: monday(week), plannedMinutes: hrs(8), billable: false, roleOnEngagement: 'Product' },
    )
  }
  await db.insert(s.allocations).values(allocSeed)

  await db.insert(s.absences).values([
    { teamMemberId: jakub, type: 'PTO', startDate: monday(3), endDate: inDays(28), workingDays: 5, approved: true },
    { teamMemberId: anna, type: 'Training', startDate: monday(1), endDate: monday(1), workingDays: 1, approved: true },
    { teamMemberId: marta, type: 'PTO', startDate: monday(2), endDate: inDays(23), workingDays: 3, approved: false },
  ])

  console.log('Change requests & risks…')
  await db.insert(s.changeRequests).values([
    {
      title: 'Add multi-currency reporting to the ERP export', projectId: prj('Nordwind'),
      requestedById: contact('h.vogel@nordwind-log.de'), raisedDate: inDays(-9),
      description: 'Client asked for EUR and SEK side by side in the settlement export. Not in the original SOW.',
      impactMinutes: hrs(36), impactCostCents: euros(4_200), impactDays: 7, status: 'SentToClient',
    },
    {
      title: 'Extra training session for the Milan team', projectId: prj('Café Milano'),
      requestedById: contact('giulia@cafemilano.it'), raisedDate: inDays(-16),
      description: 'Two hours of additional training after staff turnover.',
      impactMinutes: hrs(4), impactCostCents: 0, impactDays: 0, status: 'Absorbed',
    },
  ])

  await db.insert(s.risks).values([
    {
      title: 'Sandbox credentials outstanding for 14 days', projectId: prj('Nordwind'),
      category: 'ClientBlocker', probability: 'High', impact: 'High', ownerId: anna, status: 'Mitigating',
      mitigation: 'Escalated to Henrik. If not received by Friday, re-plan UAT and notify the client of the launch slip in writing.',
      raisedDate: inDays(-14), targetDate: inDays(3),
    },
    {
      title: 'Ledgerline scope grew after the compliance review', projectId: prj('Ledgerline'),
      category: 'Issue', probability: 'High', impact: 'Medium', ownerId: florian, status: 'Open',
      mitigation: 'Cut the exception queue to a read-only view for the MVP and move the rest to v2.',
      raisedDate: inDays(-11), targetDate: inDays(7),
    },
    {
      title: 'Single engineer holds all SEPA knowledge', projectId: prj('PagaPRO — SEPA'),
      category: 'Risk', probability: 'Medium', impact: 'High', ownerId: florian, status: 'Open',
      mitigation: 'Pair Jakub onto the payout engine from the next sprint and write the mandate handling up as a doc.',
      raisedDate: inDays(-6), targetDate: inDays(30),
    },
  ])

  console.log(`\nDone. Sign in as ${FOUNDER_EMAIL}.`)
  await client.end()
}

main().catch(async (error) => {
  console.error(error)
  await client.end()
  process.exit(1)
})
