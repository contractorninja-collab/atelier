/**
 * The table config and the writable allow-list have to agree.
 *
 * They live in different files and are edited at different times, and when they
 * disagree the failure is maddening rather than obvious: the field renders in
 * the form and in the grid, you fill it in, and the server answers "<field> is
 * read-only". Nothing in either file looks wrong on its own.
 *
 * That is exactly what happened to `portfolioProductId`. It was spliced into
 * the products and deals configs when the portfolio spine landed, and never
 * added to WRITABLE — so Catalogue → Products could not be created at all if
 * you picked a product line.
 *
 * Anything genuinely meant to be read-only goes in READ_ONLY_BY_DESIGN with a
 * reason, so "not writable" is always a decision somebody made rather than
 * something nobody noticed.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { TABLES, TABLE_IDS, CREATE_SPEC } from './tables'
import { READ_ONLY_BY_DESIGN, WRITABLE } from './writable'

/** Types the forms and the grid never write through, whatever the config says. */
const NON_INPUT_TYPES = ['multi', 'progress', 'flag']

describe('WRITABLE against the table config', () => {
  test('every editable field in every config is writable or deliberately not', () => {
    const gaps: string[] = []

    for (const id of TABLE_IDS) {
      const allowed = WRITABLE[id] ?? []
      const excused = READ_ONLY_BY_DESIGN[id] ?? {}

      for (const field of TABLES[id].fields) {
        if (field.computed || NON_INPUT_TYPES.includes(field.type)) continue
        if (allowed.includes(field.id) || field.id in excused) continue
        gaps.push(`${id}.${field.id} (${field.label})`)
      }
    }

    assert.deepEqual(
      gaps,
      [],
      `These fields render but cannot be saved — add them to WRITABLE, or to ` +
      `READ_ONLY_BY_DESIGN with a reason:\n  ${gaps.join('\n  ')}`,
    )
  })

  test('nothing is allow-listed that the config does not have', () => {
    const orphans: string[] = []

    for (const id of TABLE_IDS) {
      const fieldIds = new Set(TABLES[id].fields.map((f) => f.id))
      for (const allowed of WRITABLE[id] ?? []) {
        if (!fieldIds.has(allowed)) orphans.push(`${id}.${allowed}`)
      }
    }

    // A leftover entry is harmless at runtime but it is a lie about what the
    // table has, and it is how the list rots into being unreadable.
    assert.deepEqual(orphans, [], `Allow-listed but absent from the config:\n  ${orphans.join('\n  ')}`)
  })

  test('every required field on a create form is writable', () => {
    const unsatisfiable: string[] = []

    for (const [id, spec] of Object.entries(CREATE_SPEC)) {
      const allowed = WRITABLE[id as keyof typeof WRITABLE] ?? []
      for (const required of spec.required) {
        if (!allowed.includes(required)) unsatisfiable.push(`${id}.${required}`)
      }
    }

    // A required field that is not writable makes the form impossible to
    // submit — you must fill it in, and filling it in is refused.
    assert.deepEqual(unsatisfiable, [], `Required but not writable:\n  ${unsatisfiable.join('\n  ')}`)
  })

  test('every table has an entry, so a new one cannot be missed', () => {
    for (const id of TABLE_IDS) {
      assert.ok(WRITABLE[id] !== undefined, `${id} has no WRITABLE entry`)
    }
  })

  test('read-only exceptions carry a reason and name a real field', () => {
    for (const [id, fields] of Object.entries(READ_ONLY_BY_DESIGN)) {
      const config = TABLES[id as keyof typeof TABLES]
      for (const [fieldId, reason] of Object.entries(fields ?? {})) {
        assert.ok(
          config.fields.some((f) => f.id === fieldId),
          `${id}.${fieldId} is excused but no longer exists`,
        )
        assert.ok(reason.length > 20, `${id}.${fieldId} needs a real reason, not "${reason}"`)
      }
    }
  })
})
