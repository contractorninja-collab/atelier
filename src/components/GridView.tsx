'use client'

import { Icon, FIELD_ICON } from './Icon'
import { Cell } from './Cell'
import { money, number as fmtNumber } from '@/lib/format'
import type { Field, Row, TableConfig } from '@/lib/types'

type Props = {
  config: TableConfig
  fields: Field[]
  rows: Row[]
  rowHeight: number
  selected: Set<string>
  onToggleSelect: (id: string) => void
  onOpen: (id: string) => void
  onEditCell: (event: React.MouseEvent, row: Row, field: Field) => void
  onAdd: () => void
}

export function GridView({
  config, fields, rows, rowHeight, selected, onToggleSelect, onOpen, onEditCell, onAdd,
}: Props) {
  const width = (f: Field) => ({ flex: `0 0 ${f.width}px`, width: f.width })

  const summary = fields.map((f) => {
    if (f.type === 'currency') {
      const total = rows.reduce((sum, r) => sum + (typeof r[f.id] === 'number' ? (r[f.id] as number) : 0), 0)
      return total ? money(total) : ''
    }
    if (f.type === 'number') {
      const total = rows.reduce((sum, r) => sum + (typeof r[f.id] === 'number' ? (r[f.id] as number) : 0), 0)
      return total ? fmtNumber(total) : ''
    }
    if (f.type === 'percent' || f.type === 'progress') {
      const values = rows.map((r) => r[f.id]).filter((v): v is number => typeof v === 'number')
      if (!values.length) return ''
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      return f.type === 'percent' ? `${Math.round(mean / 100)}% avg` : `${Math.round(mean * 100)}% avg`
    }
    return ''
  })

  return (
    <div className="grid-wrap">
      <div className="grow head">
        <div className="gcell gutter" />
        {fields.map((f) => (
          <div key={f.id} className={`gcell ${f.primary ? 'pri' : ''}`} style={width(f)}>
            <span className="ftype"><Icon name={FIELD_ICON[f.type] ?? 'text'} size={12} /></span>
            {f.label}
          </div>
        ))}
        <div className="gcell" style={{ flex: '0 0 46px', width: 46, color: 'var(--ink-3)' }}>
          <Icon name="plus" size={13} />
        </div>
      </div>

      {rows.map((row, i) => (
        <div
          key={row.id}
          className={`grow ${selected.has(row.id) ? 'sel' : ''}`}
          style={{ height: rowHeight }}
        >
          <div className="gcell gutter">
            <span className="rn">{i + 1}</span>
            <span
              className={`cbx ${selected.has(row.id) ? 'on' : ''}`}
              onClick={() => onToggleSelect(row.id)}
              role="checkbox"
              aria-checked={selected.has(row.id)}
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onToggleSelect(row.id)}
            >
              {selected.has(row.id) ? <Icon name="check" size={9} /> : null}
            </span>
            <button className="exp" onClick={() => onOpen(row.id)} title="Open record">
              <Icon name="expand" size={11} />
            </button>
          </div>

          {fields.map((f) => (
            <div
              key={f.id}
              className={`gcell ${f.primary ? 'pri' : ''} ${f.computed ? '' : 'editable'}`}
              style={width(f)}
              onClick={(e) => (f.computed ? onOpen(row.id) : onEditCell(e, row, f))}
            >
              <Cell field={f} value={row[f.id]} />
            </div>
          ))}
          <div className="gcell" style={{ flex: '0 0 46px', width: 46 }} />
        </div>
      ))}

      <div className="addrow" onClick={onAdd}>
        <Icon name="plus" size={13} /> Add {config.singular}
      </div>

      <div className="gsum">
        <div className="gcell gutter" style={{ fontSize: 10.5, letterSpacing: '0.06em' }}>SUMMARY</div>
        {fields.map((f, i) => (
          <div key={f.id} className={`gcell ${f.primary ? 'pri' : ''}`} style={width(f)}>
            {summary[i]}
          </div>
        ))}
        <div className="gcell" style={{ flex: '0 0 46px', width: 46 }} />
      </div>
    </div>
  )
}
