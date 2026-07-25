'use client'

import { useEffect, useState } from 'react'
import { EmptyState } from './ui'
import { optionFor } from '@/lib/tables'
import type { Row, TableConfig, View } from '@/lib/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function TimelineView({
  config, view, rows, onOpen,
}: {
  config: TableConfig
  view: View
  rows: Row[]
  onOpen: (id: string) => void
}) {
  // The "today" marker depends on the clock, which differs between the server
  // render and hydration. Drawing it only after mount keeps the two passes
  // identical instead of producing a hydration mismatch on every timeline.
  const [today, setToday] = useState<number | null>(null)
  useEffect(() => setToday(Date.now()), [])

  const { startField, endField } = view
  if (!startField || !endField) {
    return <EmptyState title="Timeline not configured" body="This view needs a start field and an end field." />
  }

  const plotted = rows.filter((r) => r[startField] && r[endField])
  if (plotted.length === 0) {
    return (
      <EmptyState
        title="Nothing to plot"
        body="Records need both a start and an end date before they appear on the timeline."
      />
    )
  }

  const times = plotted.flatMap((r) => [
    new Date(String(r[startField])).getTime(),
    new Date(String(r[endField])).getTime(),
  ])
  const first = new Date(Math.min(...times))
  first.setDate(1)
  const last = new Date(Math.max(...times))
  last.setMonth(last.getMonth() + 1, 1)

  const min = first.getTime()
  const span = last.getTime() - min || 1

  const months: string[] = []
  const cursor = new Date(first)
  while (cursor.getTime() < last.getTime()) {
    months.push(`${MONTHS[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`)
    cursor.setMonth(cursor.getMonth() + 1)
  }

  const colourField = view.colorField ? config.fields.find((f) => f.id === view.colorField) : undefined
  const primary = config.fields.find((f) => f.primary)!
  const todayPct = today === null ? null : ((today - min) / span) * 100

  return (
    <div className="tl">
      <div className="tl-head">
        <div className="tl-lab">{config.name}</div>
        <div className="tl-months">
          {months.map((m) => (
            <div className="tl-m" key={m}>{m}</div>
          ))}
        </div>
      </div>

      {plotted.map((row) => {
        const start = new Date(String(row[startField])).getTime()
        const end = new Date(String(row[endField])).getTime()
        const left = ((start - min) / span) * 100
        const width = Math.max(((end - start) / span) * 100, 2)
        const option = colourField ? optionFor(colourField, row[colourField.id]) : undefined
        const label = view.labelField ? row[view.labelField] : option?.label

        return (
          <div className="tl-row" key={row.id}>
            <div className="tl-lab" onClick={() => onOpen(row.id)}>
              {String(row[primary.id] ?? '')}
            </div>
            <div
              className="tl-track"
              style={{
                backgroundImage: 'linear-gradient(90deg, var(--line-2) 1px, transparent 1px)',
                backgroundSize: `calc(100% / ${months.length}) 100%`,
              }}
            >
              {todayPct === null ? null : (
                <div className="tl-today" style={{ left: `${todayPct}%` }} />
              )}
              <div
                className="tl-bar"
                style={{ left: `${left}%`, width: `${width}%`, background: option?.color ?? '#3b93e0' }}
                onClick={() => onOpen(row.id)}
              >
                {typeof label === 'string' ? (option?.label ?? label) : ''}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
