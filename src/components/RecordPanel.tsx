'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Icon, FIELD_ICON } from './Icon'
import { Cell } from './Cell'
import { SpaceDot } from './ui'
import { fetchRelated, type RelatedGroup } from '@/server/related'
import { tint } from '@/lib/format'
import type { CellValue, Field, LinkRef, Row, TableConfig, TableId } from '@/lib/types'

type Props = {
  config: TableConfig
  row: Row | null
  lookups: Record<string, { id: string; label: string }[]>
  onClose: () => void
  onChange: (field: Field, value: CellValue) => void
  onOpenRecord: (table: TableId, id: string) => void
  openMenu: (e: React.MouseEvent, field: Field, row: Row) => void
}

export function RecordPanel({ config, row, lookups, onClose, onChange, onOpenRecord, openMenu }: Props) {
  const [tab, setTab] = useState<'details' | 'related'>('details')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [related, setRelated] = useState<RelatedGroup[] | null>(null)
  const [loadingRelated, setLoadingRelated] = useState(false)

  useEffect(() => {
    setTab('details')
    setEditing(null)
    setRelated(null)
  }, [row?.id])

  useEffect(() => {
    if (tab !== 'related' || !row || related !== null) return
    setLoadingRelated(true)
    fetchRelated(config.id, row.id)
      .then(setRelated)
      .finally(() => setLoadingRelated(false))
  }, [tab, row, related, config.id])

  const primary = config.fields.find((f) => f.primary)

  function beginEdit(field: Field, current: CellValue) {
    setEditing(field.id)
    if (field.type === 'currency') setDraft(typeof current === 'number' ? String(current / 100) : '')
    else setDraft(current === null || current === undefined ? '' : String(current))
  }

  function commit(field: Field) {
    setEditing(null)
    onChange(field, draft === '' ? null : draft)
  }

  return (
    <>
      <div className={`scrim ${row ? 'on' : ''}`} onClick={onClose} />
      <aside className={`over ${row ? 'on' : ''}`} aria-hidden={!row}>
        {row ? (
          <>
            <div className="over-h">
              <div className="over-top">
                <SpaceDot color={config.color} letter={config.name[0]} />
                <div className="tt">{String(primary ? row[primary.id] ?? '—' : '—')}</div>
                <button className="icon-btn" onClick={onClose} title="Close">
                  <Icon name="x" size={15} />
                </button>
              </div>
              <div className="over-tabs">
                <button className={`over-tab ${tab === 'details' ? 'active' : ''}`} onClick={() => setTab('details')}>
                  Details
                </button>
                <button className={`over-tab ${tab === 'related' ? 'active' : ''}`} onClick={() => setTab('related')}>
                  Related
                </button>
                {/* A project has a page of its own; the panel is the summary. */}
                {config.id === 'projects' ? (
                  <Link className="over-open" href={`/project/${row.id}`}>
                    Open project <Icon name="arrow" size={12} />
                  </Link>
                ) : null}
                {/* A meeting is run from its page, not edited in a grid. */}
                {config.id === 'meetings' ? (
                  <Link className="over-open" href={`/meeting/${row.id}`}>
                    Open meeting <Icon name="arrow" size={12} />
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="over-b">
              {tab === 'details' ? (
                <>
                  <div className="sect">{config.singular} fields</div>
                  {config.fields.filter((f) => !f.primary).map((field) => {
                    const value = row[field.id]
                    const isEditing = editing === field.id
                    const inlineType = ['text', 'longtext', 'number', 'currency', 'date'].includes(field.type)

                    return (
                      <div className="frow" key={field.id}>
                        <div className="fl">
                          <Icon name={FIELD_ICON[field.type] ?? 'text'} size={12} />
                          {field.label}
                        </div>

                        {isEditing && inlineType ? (
                          field.type === 'longtext' ? (
                            <textarea
                              className="inline"
                              rows={3}
                              autoFocus
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              onBlur={() => commit(field)}
                            />
                          ) : (
                            <input
                              className="inline"
                              autoFocus
                              type={field.type === 'date' ? 'date' : field.type === 'text' ? 'text' : 'number'}
                              step={field.type === 'currency' ? '0.01' : undefined}
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              onBlur={() => commit(field)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commit(field)
                                if (e.key === 'Escape') setEditing(null)
                              }}
                            />
                          )
                        ) : (
                          <div
                            className={`fv ${field.computed ? '' : 'editable'}`}
                            onClick={(e) => {
                              if (field.computed) return
                              if (field.type === 'check') return onChange(field, !value)
                              if (field.type === 'select' || field.type === 'link' || field.type === 'user') {
                                return openMenu(e, field, row)
                              }
                              if (inlineType) beginEdit(field, value)
                            }}
                          >
                            {value === null || value === undefined || value === '' ? (
                              <span className="empty-val">Empty</span>
                            ) : (
                              <Cell field={field} value={value} />
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </>
              ) : (
                <>
                  {loadingRelated ? (
                    <div className="sect">Loading…</div>
                  ) : related && related.length > 0 ? (
                    related.map((group) => (
                      <div key={`${group.table}-${group.via}`}>
                        <div className="sect">
                          {group.tableName} · via {group.via}{' '}
                          <span style={{ color: 'var(--ink-3)' }}>({group.rows.length})</span>
                        </div>
                        {group.rows.map((r) => (
                          <button
                            className="subrow"
                            key={r.id}
                            onClick={() => onOpenRecord(group.table, r.id)}
                          >
                            <SpaceDot color={group.color} letter={group.tableName[0]} size={14} />
                            <span className="st">{r.label}</span>
                            {r.status && r.statusColor ? (
                              <span
                                className="pill"
                                style={{ background: tint(r.statusColor, 0.15), color: r.statusColor }}
                              >
                                {r.status}
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ))
                  ) : (
                    <div className="empty">
                      <div className="et">No linked records</div>
                      <div className="ed">Nothing else in the workspace points at this record yet.</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : null}
      </aside>
    </>
  )
}

export function linkOptionsFor(
  field: Field,
  lookups: Record<string, { id: string; label: string }[]>,
): { id: string; label: string }[] {
  if (!field.linkTo) return []
  return lookups[field.linkTo] ?? []
}

export type { LinkRef }
