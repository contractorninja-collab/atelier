'use client'

import { useState } from 'react'
import { Icon } from './Icon'
import { Cell } from './Cell'
import { Avatar, EmptyState, Pill } from './ui'
import { money, shortDate, tint } from '@/lib/format'
import type { Field, LinkRef, Row, TableConfig, View } from '@/lib/types'

type Props = {
  config: TableConfig
  view: View
  groupField: Field | undefined
  rows: Row[]
  onOpen: (id: string) => void
  onMove: (rowId: string, toValue: string) => void
  onAdd: () => void
  canDrag: boolean
}

export function BoardView({ config, view, groupField, rows, onOpen, onMove, onAdd, canDrag }: Props) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overColumn, setOverColumn] = useState<string | null>(null)

  if (!groupField?.options) {
    return <EmptyState title="Nothing to group by" body="This view needs a select field to build columns from." />
  }

  const sumField = view.sumBy ? config.fields.find((f) => f.id === view.sumBy) : undefined
  const primary = config.fields.find((f) => f.primary)!
  const metaFields = config.fields.filter(
    (f) => (f.type === 'select' || f.type === 'flag') && !f.primary && f.id !== groupField.id && !f.secondary,
  ).slice(0, 2)
  const userField = config.fields.find((f) => f.type === 'user')
  const currencyField = config.fields.find((f) => f.type === 'currency')
  const dateField = config.fields.find((f) => f.type === 'date')

  return (
    <div className="board">
      {groupField.options.map((option) => {
        const items = rows.filter((r) => r[groupField.id] === option.value)
        const total = sumField
          ? items.reduce((sum, r) => sum + (typeof r[sumField.id] === 'number' ? (r[sumField.id] as number) : 0), 0)
          : 0

        return (
          <div
            key={option.value}
            className={`bcol ${overColumn === option.value ? 'over' : ''}`}
            onDragOver={(e) => {
              if (!canDrag) return
              e.preventDefault()
              setOverColumn(option.value)
            }}
            onDragLeave={() => setOverColumn((c) => (c === option.value ? null : c))}
            onDrop={(e) => {
              e.preventDefault()
              setOverColumn(null)
              if (dragId) onMove(dragId, option.value)
              setDragId(null)
            }}
          >
            <div className="bcol-h">
              <Pill option={option} />
              <span className="c">{items.length}</span>
              {total > 0 ? <span className="s">{money(total)}</span> : null}
            </div>

            <div className="bcol-b">
              {items.map((row) => {
                const owner = userField ? (row[userField.id] as LinkRef | null) : null
                const value = currencyField ? row[currencyField.id] : null
                const date = dateField ? row[dateField.id] : null
                return (
                  <div
                    key={row.id}
                    className={`card ${dragId === row.id ? 'drag' : ''}`}
                    draggable={canDrag}
                    onDragStart={() => setDragId(row.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => onOpen(row.id)}
                    style={{ borderLeft: `3px solid ${tint(option.color, 0.5)}` }}
                  >
                    <div className="t">{String(row[primary.id] ?? '')}</div>
                    {metaFields.length > 0 ? (
                      <div className="meta">
                        {metaFields.map((f) => (
                          <Cell key={f.id} field={f} value={row[f.id]} />
                        ))}
                      </div>
                    ) : null}
                    <div className="foot">
                      {owner ? <Avatar name={owner.label} size={22} /> : null}
                      {typeof value === 'number' && value > 0 ? <span className="v">{money(value)}</span> : null}
                      {date ? (
                        <>
                          <span style={{ marginLeft: 'auto' }}><Icon name="date" size={12} /></span>
                          <span>{shortDate(date as string)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="bcol-add" onClick={onAdd}>
              <Icon name="plus" size={13} /> Add {config.singular}
            </div>
          </div>
        )
      })}
    </div>
  )
}
