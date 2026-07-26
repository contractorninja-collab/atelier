'use client'

import { Icon } from './Icon'
import { Avatar, Pill } from './ui'
import { money, number as fmtNumber, bps, hours, shortDate, tint } from '@/lib/format'
import { TABLES, optionFor } from '@/lib/tables'
import type { CellValue, Field, LinkRef } from '@/lib/types'

function isLinkRef(v: unknown): v is LinkRef {
  return typeof v === 'object' && v !== null && 'id' in v && 'label' in v
}

export function Cell({ field, value }: { field: Field; value: CellValue }) {
  switch (field.type) {
    case 'select': {
      const option = optionFor(field, value)
      if (!option) return null
      return <Pill option={option} />
    }

    case 'multi': {
      if (!Array.isArray(value) || value.length === 0) return null
      const values = value.filter((v): v is string => typeof v === 'string')
      return (
        <>
          {values.map((v) => {
            const option = optionFor(field, v)
            return option ? <Pill key={v} option={option} /> : null
          })}
        </>
      )
    }

    case 'link':
    case 'user': {
      if (!value) return null
      const refs = Array.isArray(value) ? (value as LinkRef[]) : isLinkRef(value) ? [value] : []
      if (refs.length === 0) return null
      if (field.type === 'user') {
        return (
          <>
            {refs.map((r) => (
              <span className="uchip" key={r.id}>
                <Avatar name={r.label} size={20} />
                <span className="txt">{r.label}</span>
              </span>
            ))}
          </>
        )
      }
      return (
        <>
          {refs.map((r) => {
            const target = TABLES[r.table]
            return (
              <span className="lchip" key={r.id}>
                <span className="dot" style={{ background: target?.color ?? '#94a3b8' }}>
                  {r.label[0]?.toUpperCase()}
                </span>
                {r.label}
              </span>
            )
          })}
        </>
      )
    }

    case 'currency':
      return typeof value === 'number' && value !== 0 ? <span className="num">{money(value)}</span> : null

    case 'number':
      return typeof value === 'number' ? <span className="num">{fmtNumber(value)}</span> : null

    case 'duration':
      return typeof value === 'number' && value !== 0 ? <span className="num">{hours(value)}</span> : null

    case 'percent':
      return typeof value === 'number' ? <span className="num">{bps(value)}</span> : null

    case 'date':
      return value ? <span className="txt" style={{ color: 'var(--ink-2)' }}>{shortDate(value as string)}</span> : null

    case 'check':
      return (
        <span className={`chk ${value ? 'on' : ''}`}>{value ? <Icon name="check" size={10} /> : null}</span>
      )

    case 'progress': {
      const pct = typeof value === 'number' ? Math.min(Math.max(value, 0), 1.2) : 0
      const color = pct > 1 ? 'var(--danger)' : pct > 0.85 ? 'var(--accent)' : 'var(--brand)'
      return (
        <span className="bar-wrap">
          <span className="bar">
            <i style={{ width: `${Math.min(pct, 1) * 100}%`, background: color }} />
          </span>
          <span className="pctn">{Math.round(pct * 100)}%</span>
        </span>
      )
    }

    case 'flag':
      return value ? <span className="flag">{String(value)}</span> : null

    case 'longtext':
    case 'text':
    default:
      return value ? <span className="txt">{String(value)}</span> : null
  }
}

/** Board cards colour their left edge by the grouping option. */
export function optionColour(field: Field | undefined, value: unknown): string {
  const option = optionFor(field ?? {}, value)
  return option?.color ?? '#94a3b8'
}

export { tint }
