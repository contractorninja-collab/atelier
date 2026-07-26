'use client'

import { Icon, FIELD_ICON } from './Icon'
import type { Field, TableConfig } from '@/lib/types'

/**
 * The floating bar that appears once rows are checked.
 *
 * Which fields it offers is derived from the table config rather than listed per
 * table: any select or link/owner field that is not computed can be set in bulk.
 * That means a field added to `tables.ts` shows up here for free, the same way it
 * does in the grid and the record panel.
 */
export function BulkBar({
  config, fields, count, onSetField, onDelete, onClear,
}: {
  config: TableConfig
  fields: Field[]
  count: number
  onSetField: (event: React.MouseEvent, field: Field) => void
  onDelete: () => void
  onClear: () => void
}) {
  const settable = fields.filter(
    (f) => !f.computed && (f.type === 'select' || f.type === 'user' || f.type === 'link'),
  )

  return (
    <div className="bulkbar">
      <span className="bb-count">
        {count} {count === 1 ? config.singular : `${config.singular}s`} selected
      </span>

      <div className="bb-sep" />

      {settable.map((f) => (
        <button key={f.id} className="bb-btn" onClick={(e) => onSetField(e, f)}>
          <Icon name={FIELD_ICON[f.type] ?? 'text'} size={13} />
          {f.label}
        </button>
      ))}

      {settable.length === 0 ? (
        <span className="bb-empty">No bulk-editable fields on this table</span>
      ) : null}

      <div className="bb-sep" />

      <button className="bb-btn danger" onClick={onDelete}>
        <Icon name="x" size={13} />Delete
      </button>
      <button className="bb-btn" onClick={onClear}>Clear</button>
    </div>
  )
}
