'use client'

import { useState } from 'react'
import { createRecord } from '@/server/actions'
import { attempt } from '@/lib/attempt'
import { CREATE_SPEC, TABLES } from '@/lib/tables'
import type { ActionResult, Field, TableId } from '@/lib/types'

type Lookups = Record<string, { id: string; label: string }[]>
type Value = string | boolean

/**
 * The New-record form for every table that does not need a bespoke one.
 *
 * Fields come from the table config, so a column added to `tables.ts` appears
 * here without touching this file — the same bargain the grid, board and record
 * panel already make. What the form does *not* do is enforce anything beyond
 * "required is filled in": units are converted and invariants applied by
 * createRecord on the server, because a form is the wrong place to be the only
 * thing standing between a user and a wrong number.
 *
 * Units follow the field type, and the hints say so out loud: currency is
 * entered in euros, duration in hours, percent as a percentage.
 */
export function GenericForm({
  table, lookups, onDone, pending, setPending,
}: {
  table: TableId
  lookups: Lookups
  onDone: (message: string) => void
  pending: boolean
  setPending: (v: boolean) => void
}) {
  const config = TABLES[table]
  const spec = CREATE_SPEC[table]
  const [values, setValues] = useState<Record<string, Value>>({})
  const [error, setError] = useState<string | null>(null)

  if (!spec) return <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>No create form for {config.name}.</p>

  const hidden = new Set(spec.hide ?? [])
  const shown = config.fields.filter(
    (f) => !f.computed && !hidden.has(f.id) && f.type !== 'multi' && f.type !== 'progress' && f.type !== 'flag',
  )
  // Required first: the form should read as "the minimum, then the rest".
  const ordered = [
    ...shown.filter((f) => spec.required.includes(f.id)),
    ...shown.filter((f) => !spec.required.includes(f.id)),
  ]

  const set = (id: string, v: Value) => {
    setValues((current) => ({ ...current, [id]: v }))
    setError(null)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setPending(true)
    void (async () => {
      const result: ActionResult = await attempt(() => createRecord({ table, values: values as Record<string, string | boolean> }))
      setPending(false)
      if (!result.ok) setError(result.error)
      else onDone(result.detail ?? `${config.singular} created`)
    })()
  }

  return (
    <form className="login" style={{ padding: 0, border: 'none', boxShadow: 'none', width: '100%' }} onSubmit={submit}>
      {spec.note ? <p className="gf-note">{spec.note}</p> : null}

      {ordered.map((field, index) => {
        const required = spec.required.includes(field.id)
        return (
          <div key={field.id} style={{ marginTop: index === 0 ? 0 : 13 }}>
            <label htmlFor={`gf-${field.id}`}>
              {field.label}{unitSuffix(field)}
              {required ? <span className="gf-req"> required</span> : null}
            </label>
            <Input
              field={field}
              required={required}
              lookups={lookups}
              value={values[field.id]}
              onChange={(v) => set(field.id, v)}
            />
            {hintFor(field) ? <p className="gf-hint">{hintFor(field)}</p> : null}
          </div>
        )
      })}

      {error ? <p style={{ color: 'var(--danger)', fontSize: 12.5, margin: '14px 0 0' }}>{error}</p> : null}
      <button className="btn pri full" type="submit" disabled={pending}>
        {pending ? 'Saving…' : `Create ${config.singular}`}
      </button>
    </form>
  )
}

const selectStyle = {
  width: '100%', padding: '9px 11px', border: '1px solid var(--line)',
  borderRadius: 7, background: 'var(--bg)',
}

function Input({
  field, required, lookups, value, onChange,
}: {
  field: Field
  required: boolean
  lookups: Lookups
  value: Value | undefined
  onChange: (v: Value) => void
}) {
  const id = `gf-${field.id}`
  const text = typeof value === 'string' ? value : ''

  if (field.type === 'check') {
    return (
      <button
        type="button"
        className="st-toggle"
        role="switch"
        aria-checked={value === true}
        onClick={() => onChange(value !== true)}
      >
        <span className={`st-track ${value === true ? 'on' : ''}`}><span className="st-knob" /></span>
        <span>{value === true ? 'Yes' : 'No'}</span>
      </button>
    )
  }

  if (field.type === 'select') {
    return (
      <select id={id} required={required} value={text} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        <option value="">{required ? 'Choose…' : '—'}</option>
        {(field.options ?? []).map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    )
  }

  if (field.type === 'link' || field.type === 'user') {
    const options = lookups[field.linkTo ?? ''] ?? []
    return (
      <select id={id} required={required} value={text} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        <option value="">{required ? 'Choose…' : '—'}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    )
  }

  if (field.type === 'longtext') {
    return (
      <textarea
        id={id} required={required} value={text} rows={3}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...selectStyle, resize: 'vertical', fontFamily: 'inherit' }}
      />
    )
  }

  const inputType =
    field.type === 'date' ? 'date'
    : field.type === 'currency' || field.type === 'number' || field.type === 'percent' || field.type === 'duration'
      ? 'number'
      : 'text'

  return (
    <input
      id={id}
      type={inputType}
      required={required}
      value={text}
      min={inputType === 'number' ? 0 : undefined}
      max={field.type === 'percent' ? 100 : undefined}
      step={inputType === 'number' ? 'any' : undefined}
      onChange={(e) => onChange(e.target.value)}
      style={field.type === 'date' ? selectStyle : { width: '100%' }}
    />
  )
}

/** Say the unit in the label, because the stored unit is never the entered one. */
function unitSuffix(field: Field): string {
  if (field.type === 'currency') return ' (€)'
  if (field.type === 'percent') return ' (%)'
  if (field.type === 'duration') return ' (hours)'
  return ''
}

function hintFor(field: Field): string | null {
  if (field.type === 'currency') return 'Entered in euros, stored as cents.'
  if (field.type === 'percent') return 'A percentage. Stored as basis points.'
  if (field.type === 'duration') return 'Entered in hours, stored as minutes.'
  if (field.id === 'domain') return 'The dedupe key. Stored bare — no protocol, no www.'
  if (field.id === 'slug') return 'Lowercase, no spaces. Must be unique.'
  return null
}
