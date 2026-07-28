/**
 * The table config against the database.
 *
 * writable.test.ts checks the config against the allow-list. This checks both
 * against the schema, because those are three descriptions of the same columns
 * kept in three files, and every disagreement between them surfaces to the user
 * as a write that is simply refused with no clue why.
 *
 * Each test here corresponds to a failure someone would otherwise hit by
 * clicking around: "Invalid option", a crash inside the driver, a required
 * field with nowhere to type it, an empty dropdown.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { getTableColumns } from 'drizzle-orm'
import * as t from '@/db/schema'
import { CREATE_SPEC, TABLES, TABLE_IDS } from './tables'
import { WRITABLE } from './writable'
import type { TableId } from './types'

/** Mirrors TABLE_TO_DRIZZLE in actions.ts — clients ride on organizations. */
const DRIZZLE = {
  deals: t.deals, organizations: t.organizations, contacts: t.contacts, activities: t.activities,
  products: t.products, sources: t.sources, team: t.teamMembers, targets: t.targets,
  portfolio: t.portfolioProducts, projects: t.projects, milestones: t.milestones, tasks: t.tasks,
  sprints: t.sprints, timeEntries: t.timeEntries, allocations: t.allocations, absences: t.absences,
  changeRequests: t.changeRequests, risks: t.risks, subscriptions: t.subscriptions,
  invoices: t.invoices, payments: t.payments, audit: t.auditLog, clients: t.organizations,
} as const satisfies Record<TableId, unknown>

const NON_INPUT_TYPES = ['multi', 'progress', 'flag']

/**
 * Writable fields sitting on a `timestamp` column rather than a `date` one.
 *
 * Drizzle treats them differently — a date column takes the ISO string, a
 * timestamp column expects a Date and calls .toISOString() on whatever it gets.
 * Keep this in step with TIMESTAMP_FIELDS in actions.ts.
 */
const KNOWN_TIMESTAMP_FIELDS = new Set(['occurredAt'])

/**
 * Columns applyCreateRules fills in, so the form never asks for them.
 *
 * These are the deliberate ones — derived or snapshotted values a person should
 * not be typing. Anything notNull and defaultless that is neither required nor
 * listed here fails at the INSERT, which is a constraint error in a toast
 * rather than anything the form could have told you.
 */
const SET_BY_CREATE_RULES: Partial<Record<TableId, string[]>> = {
  // start + term, and it moves again on each renewal.
  subscriptions: ['renewsOn'],
  // Snapshotted off the member so a later raise cannot restate last year's margin.
  timeEntries: ['costRateCents', 'billRateCents'],
  // A client is an organization that has bought something.
  clients: ['lifecycle', 'types'],
}

const columnsFor = (id: TableId) => getTableColumns(DRIZZLE[id] as Parameters<typeof getTableColumns>[0])

describe('config against the database schema', () => {
  test('every select option exists in the database enum', () => {
    const bad: string[] = []

    for (const id of TABLE_IDS) {
      const cols = columnsFor(id)
      for (const field of TABLES[id].fields) {
        if (field.computed) continue
        if (field.type !== 'select' && field.type !== 'multi') continue
        const col = cols[field.id] as { enumValues?: string[] } | undefined
        if (!col?.enumValues) continue
        for (const option of field.options ?? []) {
          if (!col.enumValues.includes(option.value)) bad.push(`${id}.${field.id} = "${option.value}"`)
        }
      }
    }

    // prepareCellWrite validates against the config, then Postgres validates
    // against the enum. An option only the config knows about is accepted by
    // the first and rejected by the second.
    assert.deepEqual(bad, [], `Options the database enum does not have:\n  ${bad.join('\n  ')}`)
  })

  test('every writable field is a real column', () => {
    const missing: string[] = []

    for (const id of TABLE_IDS) {
      const cols = columnsFor(id)
      for (const fieldId of WRITABLE[id] ?? []) {
        if (!cols[fieldId]) missing.push(`${id}.${fieldId}`)
      }
    }

    assert.deepEqual(missing, [], `Allow-listed but not a column:\n  ${missing.join('\n  ')}`)
  })

  test('every writable timestamp column is declared as one', () => {
    const undeclared: string[] = []

    for (const id of TABLE_IDS) {
      const cols = columnsFor(id)
      for (const fieldId of WRITABLE[id] ?? []) {
        const col = cols[fieldId] as { columnType?: string } | undefined
        if (!col?.columnType || !/Timestamp/i.test(col.columnType)) continue
        if (!KNOWN_TIMESTAMP_FIELDS.has(fieldId)) undeclared.push(`${id}.${fieldId}`)
      }
    }

    // Undeclared, the driver is handed a string and throws
    // "value.toISOString is not a function" from somewhere unhelpful.
    assert.deepEqual(
      undeclared, [],
      `Timestamp columns missing from TIMESTAMP_FIELDS in actions.ts:\n  ${undeclared.join('\n  ')}`,
    )
  })

  test('every required field on a create form is actually rendered', () => {
    const unreachable: string[] = []

    for (const [table, spec] of Object.entries(CREATE_SPEC)) {
      const config = TABLES[table as TableId]
      const hidden = new Set(spec.hide ?? [])

      for (const required of spec.required) {
        const field = config.fields.find((f) => f.id === required)
        if (!field) { unreachable.push(`${table}.${required} — no such field`); continue }
        if (field.computed) unreachable.push(`${table}.${required} — computed`)
        else if (hidden.has(required)) unreachable.push(`${table}.${required} — in spec.hide`)
        else if (NON_INPUT_TYPES.includes(field.type)) unreachable.push(`${table}.${required} — type ${field.type}`)
      }
    }

    // The form refuses to submit without it and gives you nowhere to put it.
    assert.deepEqual(unreachable, [], `Required but not on the form:\n  ${unreachable.join('\n  ')}`)
  })

  test('every link field points at a table that exists', () => {
    const dangling: string[] = []

    for (const id of TABLE_IDS) {
      for (const field of TABLES[id].fields) {
        if (field.type !== 'link' && field.type !== 'user') continue
        if (!field.linkTo) { dangling.push(`${id}.${field.id} — no linkTo`); continue }
        if (!TABLES[field.linkTo]) dangling.push(`${id}.${field.id} -> ${field.linkTo}`)
      }
    }

    // A link with nowhere to point renders as an empty dropdown, which reads
    // as "there is no data" rather than "this is misconfigured".
    assert.deepEqual(dangling, [], `Link fields pointing nowhere:\n  ${dangling.join('\n  ')}`)
  })

  test('every column the database demands is asked for or filled in', () => {
    const unfillable: string[] = []

    for (const table of Object.keys(CREATE_SPEC) as TableId[]) {
      const spec = CREATE_SPEC[table]!
      const cols = columnsFor(table)
      const supplied = new Set([...spec.required, ...(SET_BY_CREATE_RULES[table] ?? [])])

      for (const [name, col] of Object.entries(cols)) {
        // id and seq generate themselves.
        if (name === 'id' || name === 'seq') continue
        const c = col as { notNull?: boolean; hasDefault?: boolean }
        if (!c.notNull || c.hasDefault) continue
        if (!supplied.has(name)) unfillable.push(`${table}.${name}`)
      }
    }

    assert.deepEqual(
      unfillable, [],
      `NOT NULL with no default, and nothing supplies it — the insert will fail:\n  ${unfillable.join('\n  ')}`,
    )
  })

  test('every table is creatable except the audit log', () => {
    const bespoke = ['deals', 'organizations', 'targets', 'team', 'invoices', 'payments']
    const uncreatable = TABLE_IDS.filter((id) => !CREATE_SPEC[id] && !bespoke.includes(id))

    // The audit log is written by the server and by nobody else. Any other
    // table landing here means a space has a New button that cannot work.
    assert.deepEqual(uncreatable, ['audit'], `Tables with no way to create a row:\n  ${uncreatable.join(', ')}`)
  })
})
