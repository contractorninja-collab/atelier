/**
 * The Closed Won handoff, against a real database.
 *
 * Every other test in this project is pure arithmetic. This one is not, because
 * the thing worth testing is not a calculation — it is whether a *second* Closed
 * Won does nothing. That question only has an answer if there are real rows and
 * a real transaction, so this runs Postgres in memory via PGlite. No Docker, no
 * connection string, no service: `npm test` starts it and throws it away.
 *
 * Why this test and not another integration test: a duplicate project is
 * invisible. Nothing errors, nothing looks wrong, and every capacity and margin
 * figure downstream is quietly doubled until someone reconciles by hand weeks
 * later. A guard whose failure is silent is a guard that needs a test.
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { eq } from 'drizzle-orm'
import * as schema from '@/db/schema'
import * as t from '@/db/schema'
import { MILESTONE_TEMPLATE } from '@/lib/tables'
import { spawnProjectForDeal, type Tx } from './handoff'

let client: PGlite
let db: ReturnType<typeof drizzle<typeof schema>>

/** Ids are fixed so a failure names the row it means. */
const OWNER = 'tm-owner'
const PM = 'tm-pm'
const ORG = 'org-nordwind'
const PRODUCT = 'prod-build'
const DEAL = 'deal-project'
const SUBSCRIPTION_DEAL = 'deal-subscription'

before(async () => {
  // No path argument: entirely in memory, nothing left on disk afterwards.
  client = new PGlite()
  db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })

  await db.insert(t.teamMembers).values([
    { id: OWNER, name: 'Owner', email: 'owner@atelier.test', role: 'AE', department: 'Sales' },
    { id: PM, name: 'PM', email: 'pm@atelier.test', role: 'PM', department: 'Delivery', status: 'Active' },
  ])
  await db.insert(t.organizations).values({ id: ORG, name: 'Nordwind', domain: 'nordwind.test' })
  await db.insert(t.products).values({
    id: PRODUCT, name: 'Build', type: 'Service', listPriceCents: 100_000, billing: 'OneOff',
  })
  await db.insert(t.deals).values([
    {
      id: DEAL, name: 'Nordwind — Portal', organizationId: ORG, ownerId: OWNER,
      type: 'Project', stage: 'ClosedWon',
    },
    {
      id: SUBSCRIPTION_DEAL, name: 'Nordwind — Seats', organizationId: ORG, ownerId: OWNER,
      type: 'Subscription', stage: 'ClosedWon',
    },
  ])
  await db.insert(t.dealLineItems).values({
    dealId: DEAL, productId: PRODUCT, quantity: 1, unitPriceCents: 4_000_000,
    billing: 'OneOff', estimatedDeliveryHours: 320,
  })
})

after(async () => {
  await client.close()
})

/**
 * The production caller always has a transaction open, so the tests run inside
 * one too. The cast is because `Tx` is derived from the postgres-js driver and
 * this is the PGlite one; the query surface they expose is the same, which is
 * the whole reason local development works at all.
 */
function inTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction((tx) => fn(tx as unknown as Tx))
}

describe('spawnProjectForDeal', () => {
  test('creates the project and the full milestone set on the first win', async () => {
    const detail = await inTransaction((tx) => spawnProjectForDeal(tx, DEAL))
    assert.ok(detail, 'expected a project to be created')

    const projects = await db.select().from(t.projects).where(eq(t.projects.dealId, DEAL))
    assert.equal(projects.length, 1)

    const project = projects[0]
    assert.equal(project.organizationId, ORG)
    assert.equal(project.type, 'ClientDelivery')
    assert.equal(project.status, 'Kickoff')
    // A Delivery member exists, so the PM is them rather than the deal owner.
    assert.equal(project.pmId, PM)
    // 320 estimated hours, stored as minutes.
    assert.equal(project.budgetMinutes, 320 * 60)
    assert.equal(project.contractValueCents, 4_000_000)
    // Frozen at creation so slip is always measured against the original promise.
    assert.equal(project.baselineLaunch, project.targetLaunch)

    const milestones = await db.select().from(t.milestones).where(eq(t.milestones.projectId, project.id))
    assert.equal(milestones.length, MILESTONE_TEMPLATE.length)
    assert.equal(milestones.reduce((sum, m) => sum + m.weightBps, 0), 10_000)
  })

  /** The reason this file exists. */
  test('a second win creates nothing', async () => {
    const before = await db.select().from(t.projects).where(eq(t.projects.dealId, DEAL))
    assert.equal(before.length, 1, 'precondition: the first win already ran')

    const detail = await inTransaction((tx) => spawnProjectForDeal(tx, DEAL))
    assert.equal(detail, null, 'the second run must report that it did nothing')

    const after = await db.select().from(t.projects).where(eq(t.projects.dealId, DEAL))
    assert.equal(after.length, 1, 'a duplicate project would double every capacity and margin figure')
    assert.equal(after[0].id, before[0].id, 'the original project must be untouched')

    const milestones = await db.select().from(t.milestones).where(eq(t.milestones.projectId, before[0].id))
    assert.equal(milestones.length, MILESTONE_TEMPLATE.length, 'no second milestone set')
  })

  test('a subscription deal produces no delivery project', async () => {
    const detail = await inTransaction((tx) => spawnProjectForDeal(tx, SUBSCRIPTION_DEAL))
    assert.equal(detail, null)

    const projects = await db.select().from(t.projects).where(eq(t.projects.dealId, SUBSCRIPTION_DEAL))
    assert.equal(projects.length, 0)
  })

  test('an unknown deal is inert rather than an error', async () => {
    const detail = await inTransaction((tx) => spawnProjectForDeal(tx, 'deal-does-not-exist'))
    assert.equal(detail, null)
  })
})
