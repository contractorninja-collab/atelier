/**
 * Exercises every CREATE_SPEC table against real Postgres, then rolls back.
 *
 * It reproduces createRecord's coercion and rules rather than importing the
 * action, because the action requires a session. The point is to prove the
 * required-field lists match the schema's notNull columns and the unit
 * conversions land — a mismatch shows up here as a constraint error.
 */
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as t from '../src/db/schema'
import { CREATE_SPEC, TABLES } from '../src/lib/tables'
import { nextRenewalDate } from '../src/server/compute'
import type { TableId } from '../src/lib/types'

const TABLE_TO_DRIZZLE: Record<string, unknown> = {
  contacts: t.contacts, activities: t.activities, products: t.products, sources: t.sources,
  portfolio: t.portfolioProducts, projects: t.projects, milestones: t.milestones, tasks: t.tasks,
  sprints: t.sprints, timeEntries: t.timeEntries, allocations: t.allocations, absences: t.absences,
  changeRequests: t.changeRequests, risks: t.risks, subscriptions: t.subscriptions,
  clients: t.organizations,
}

async function main() {
  const client = postgres(process.env.DIRECT_URL!, { prepare: false, max: 3, onnotice: () => {} })
  const db = drizzle(client, { schema: t })

  // Fixtures for the foreign keys. Created if the database has none, and rolled
  // back at the end — this must never leave rows behind in a live database.
  const fixtures: { orgs: string[]; projects: string[] } = { orgs: [], projects: [] }

  let [org] = await db.select({ id: t.organizations.id }).from(t.organizations).limit(1)
  if (!org) {
    const [made] = await db.insert(t.organizations)
      .values({ name: '__probe org__', domain: 'probe-fixture.example' }).returning()
    org = { id: made.id }
    fixtures.orgs.push(made.id)
  }

  const [member] = await db.select({
    id: t.teamMembers.id, cost: t.teamMembers.costRateCents, bill: t.teamMembers.billRateCents,
  }).from(t.teamMembers).limit(1)
  if (!member) throw new Error('no team members exist; sign-in would be impossible anyway')

  let [project] = await db.select({ id: t.projects.id }).from(t.projects).limit(1)
  if (!project) {
    const [made] = await db.insert(t.projects).values({ name: '__probe project__' }).returning()
    project = { id: made.id }
    fixtures.projects.push(made.id)
  }

  const cleanUp = async () => {
    for (const id of fixtures.projects) await db.delete(t.projects).where(eq(t.projects.id, id))
    for (const id of fixtures.orgs) await db.delete(t.organizations).where(eq(t.organizations.id, id))
    if (fixtures.orgs.length || fixtures.projects.length) console.log('(probe fixtures removed)')
  }

  // What a person would type into the form, in display units.
  const typed: Partial<Record<TableId, Record<string, string | boolean>>> = {
    clients: { name: 'Probe Client Ltd', domain: 'Probe-Client.example' },
    subscriptions: { organizationId: org.id, startDate: '2026-03-31', termMonths: '12', mrrCents: '1500' },
    contacts: { firstName: 'Probe', lastName: 'Person', email: 'Probe.Person@Example.com', organizationId: org.id },
    activities: { subject: 'Probe call', type: 'Call', occurredAt: '2026-07-20' },
    products: { name: 'Probe Plan', type: 'SaaSPlan', listPriceCents: '499', billing: 'Monthly' },
    sources: { name: 'Probe Source', category: 'Inbound' },
    portfolio: { name: 'Probe Product', slug: 'probe-product' },
    projects: { name: 'Probe Project', targetLaunch: '2026-12-01' },
    milestones: { name: 'Probe Milestone', projectId: project.id, weightBps: '10' },
    tasks: { title: 'Probe Task' },
    sprints: { name: 'Probe Sprint', startDate: '2026-08-03', endDate: '2026-08-14' },
    timeEntries: { teamMemberId: member.id, workedOn: '2026-07-20', minutes: '7.5' },
    allocations: { teamMemberId: member.id, weekStarting: '2026-08-03', plannedMinutes: '20' },
    absences: { teamMemberId: member.id, type: 'PTO', startDate: '2026-08-10', endDate: '2026-08-14', workingDays: '5' },
    changeRequests: { title: 'Probe CR', projectId: project.id, raisedDate: '2026-07-20' },
    risks: { title: 'Probe Risk', projectId: project.id, category: 'Risk', probability: 'Low', impact: 'Low' },
  }

  // Mirrors prepareCellWrite.
  const coerce = (table: TableId, values: Record<string, string | boolean>) => {
    const config = TABLES[table]
    const row: Record<string, unknown> = {}
    for (const [key, raw] of Object.entries(values)) {
      const field = config.fields.find((f) => f.id === key)
      let v: unknown = raw
      if (typeof raw === 'string') {
        if (field?.type === 'number') v = Number(raw)
        else if (field?.type === 'currency') v = Math.round(Number(raw) * 100)
        else if (field?.type === 'duration') v = Math.round(Number(raw) * 60)
        else if (field?.type === 'percent') v = Math.round(Number(raw) * 100)
        // Timestamp columns need a Date; date columns take the string.
        else if (field?.type === 'date' && key === 'occurredAt') v = new Date(raw)
      }
      row[key] = v
    }
    return row
  }

  let failures = 0
  for (const table of Object.keys(CREATE_SPEC) as TableId[]) {
    const values = typed[table]
    if (!values) { console.log('SKIP  ', table, '(no probe data)'); continue }

    // Required list must cover the schema's mandatory columns.
    const missing = CREATE_SPEC[table]!.required.filter((f) => !(f in values))
    if (missing.length) { console.log('BAD   ', table, 'probe omits required:', missing.join(', ')); failures++; continue }

    const row = coerce(table, values)
    if (table === 'clients') Object.assign(row, { domain: 'probe-client.example', lifecycle: 'Customer', types: ['Customer'] })
    if (table === 'subscriptions') row.renewsOn = nextRenewalDate(String(row.startDate), Number(row.termMonths))
    if (table === 'timeEntries') Object.assign(row, { costRateCents: member.cost ?? 0, billRateCents: member.bill ?? 0 })
    if (table === 'contacts') row.email = String(row.email).toLowerCase()

    try {
      await db.transaction(async (tx) => {
        const target = TABLE_TO_DRIZZLE[table] as Parameters<typeof tx.insert>[0]
        const [created] = await tx.insert(target).values(row as never).returning()
        const c = created as Record<string, unknown>
        const extra =
          table === 'subscriptions' ? ` renewsOn=${c.renewsOn}`
          : table === 'timeEntries' ? ` minutes=${c.minutes} costRate=${c.costRateCents}`
          : table === 'milestones' ? ` weightBps=${c.weightBps}`
          : table === 'products' ? ` listPriceCents=${c.listPriceCents}`
          : ''
        console.log('ok    ', table.padEnd(15) + extra)
        throw new Error('__rollback__')
      })
    } catch (e) {
      const msg = String((e as Error).message)
      if (msg !== '__rollback__') { console.log('FAILS ', table.padEnd(15), msg.slice(0, 95)); failures++ }
    }
  }

  await cleanUp()
  console.log(failures === 0 ? '\nall create specs insert cleanly' : `\n${failures} table(s) need attention`)
  await client.end()
}
main().catch((e) => { console.error('setup failed:', String(e.message).slice(0, 180)); process.exit(1) })
