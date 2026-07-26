'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Icon, FIELD_ICON } from './Icon'
import { GridView } from './GridView'
import { BoardView } from './BoardView'
import { TimelineView } from './TimelineView'
import { RecordPanel } from './RecordPanel'
import { Menu, type MenuState } from './Menu'
import { CREATABLE, NewRecordDialog } from './NewRecordDialog'
import { BulkBar } from './BulkBar'
import { usePrefs } from './Prefs'
import { bulkDelete, bulkUpdateCell, moveDealStage, moveTaskStatus, updateCell } from '@/server/actions'
import { TABLES } from '@/lib/tables'
import type { CellValue, Field, LinkRef, Row, TableConfig, TableId } from '@/lib/types'

type Props = {
  config: TableConfig
  rows: Row[]
  lookups: Record<string, { id: string; label: string }[]>
}

/** Above this many rows, a bulk delete has to be typed out rather than clicked. */
const LARGE_DELETE = 25

export function TableWorkspace({ config, rows: serverRows, lookups }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const { prefs, ready: prefsReady } = usePrefs()

  const [rows, setRows] = useState(serverRows)
  const [viewId, setViewId] = useState(config.views[0].id)
  const [query, setQuery] = useState('')
  const [groupBy, setGroupBy] = useState<string | null>(config.views[0].groupBy ?? null)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [rowHeight, setRowHeight] = useState(prefs.rowHeight)
  const [heightTouched, setHeightTouched] = useState(false)
  const [hidden, setHidden] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openId, setOpenId] = useState<string | null>(null)
  const [menu, setMenu] = useState<MenuState>(null)
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => setRows(serverRows), [serverRows])

  // Adopt the stored default once localStorage has been read, but never stomp on
  // a height the user has just picked from the toolbar for this view.
  useEffect(() => {
    if (prefsReady && !heightTouched) setRowHeight(prefs.rowHeight)
  }, [prefsReady, prefs.rowHeight, heightTouched])

  useEffect(() => {
    setViewId(config.views[0].id)
    setGroupBy(config.views[0].groupBy ?? null)
    setQuery('')
    setOpenId(null)
    setSelected(new Set())
  }, [config.id, config.views])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3600)
    return () => clearTimeout(id)
  }, [toast])

  const view = config.views.find((v) => v.id === viewId) ?? config.views[0]
  const visibleFields = useMemo(
    () => config.fields.filter((f) => !f.secondary && !hidden.includes(f.id)),
    [config.fields, hidden],
  )

  const filtered = useMemo(() => {
    let out = rows
    if (query.trim()) {
      const q = query.toLowerCase()
      out = out.filter((row) =>
        config.fields.some((f) => {
          const v = row[f.id]
          if (v === null || v === undefined) return false
          if (Array.isArray(v)) {
            return v.some((item) =>
              typeof item === 'string'
                ? item.toLowerCase().includes(q)
                : String((item as LinkRef)?.label ?? '').toLowerCase().includes(q),
            )
          }
          if (typeof v === 'object') return String((v as LinkRef).label ?? '').toLowerCase().includes(q)
          return String(v).toLowerCase().includes(q)
        }),
      )
    }
    if (sortBy) {
      const field = config.fields.find((f) => f.id === sortBy)
      out = [...out].sort((a, b) => {
        const x = a[sortBy]
        const y = b[sortBy]
        if (typeof x === 'number' && typeof y === 'number') return y - x
        const xs = typeof x === 'object' && x ? (x as LinkRef).label : String(x ?? '')
        const ys = typeof y === 'object' && y ? (y as LinkRef).label : String(y ?? '')
        if (field?.type === 'date') return String(y ?? '').localeCompare(String(x ?? ''))
        return xs.localeCompare(ys)
      })
    }
    return out
  }, [rows, query, sortBy, config.fields])

  const openRow = openId ? rows.find((r) => r.id === openId) ?? null : null

  /* ------------------------------------------------------------- mutation */

  const persist = useCallback(
    (rowId: string, field: Field, value: CellValue) => {
      const previous = rows
      // Optimistic: the grid should not wait on a round trip to feel alive.
      setRows((current) =>
        current.map((r) => {
          if (r.id !== rowId) return r
          if ((field.type === 'link' || field.type === 'user') && typeof value === 'string') {
            const label = (lookups[field.linkTo ?? ''] ?? []).find((o) => o.id === value)?.label ?? ''
            return { ...r, [field.id]: value ? { id: value, label, table: field.linkTo as TableId } : null }
          }
          return { ...r, [field.id]: value }
        }),
      )

      startTransition(async () => {
        const result = await updateCell({
          table: config.id,
          id: rowId,
          field: field.id,
          value: value as string | number | boolean | null,
        })
        if (!result.ok) {
          setRows(previous)
          setToast({ text: result.error, error: true })
        } else {
          router.refresh()
        }
      })
    },
    [rows, config.id, lookups, router],
  )

  const moveStage = useCallback(
    (rowId: string, toValue: string, fieldId?: string) => {
      const groupFieldId = fieldId ?? groupBy ?? view.groupBy
      const isDealStage = config.id === 'deals' && groupFieldId === 'stage'
      const isTaskStatus = config.id === 'tasks' && groupFieldId === 'status'

      // Everything except the two flows with side effects is a plain field write.
      if (!isDealStage && !isTaskStatus) {
        const field = config.fields.find((f) => f.id === groupFieldId)
        if (field) persist(rowId, field, toValue)
        return
      }

      const column = isDealStage ? 'stage' : 'status'
      const previous = rows
      setRows((current) => current.map((r) => (r.id === rowId ? { ...r, [column]: toValue } : r)))

      const label =
        config.fields.find((f) => f.id === column)?.options?.find((o) => o.value === toValue)?.label ?? toValue

      startTransition(async () => {
        const result = isDealStage
          ? await moveDealStage({ dealId: rowId, toStage: toValue as never })
          : await moveTaskStatus({ taskId: rowId, toStatus: toValue as never })

        if (!result.ok) {
          setRows(previous)
          setToast({ text: result.error, error: true })
          return
        }

        setToast({
          text:
            result.detail ??
            (isDealStage && toValue === 'ClosedWon'
              ? 'Closed Won — account promoted and stage history written'
              : `Moved to ${label}`),
        })
        router.refresh()
      })
    },
    [config, rows, groupBy, view.groupBy, persist, router],
  )

  /* ----------------------------------------------------------------- menus */

  const openFieldMenu = useCallback(
    (e: React.MouseEvent, field: Field, row: Row) => {
      e.stopPropagation()
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const base = { x: rect.left, y: rect.bottom + 4 }

      if (field.type === 'select') {
        const current = row[field.id]
        setMenu({
          ...base,
          title: field.label,
          items: (field.options ?? []).map((o) => ({
            value: o.value,
            label: o.label,
            color: o.color,
            checked: current === o.value,
          })),
          onPick: (value) => {
            const hasSideEffects =
              (config.id === 'deals' && field.id === 'stage') ||
              (config.id === 'tasks' && field.id === 'status')
            if (hasSideEffects) moveStage(row.id, value, field.id)
            else persist(row.id, field, value)
          },
        })
        return
      }

      if (field.type === 'link' || field.type === 'user') {
        const options = lookups[field.linkTo ?? ''] ?? []
        const current = row[field.id] as LinkRef | null
        setMenu({
          ...base,
          title: field.label,
          items: [
            { value: '', label: 'Clear', icon: 'x' },
            ...options.map((o) => ({ value: o.id, label: o.label, checked: current?.id === o.id })),
          ],
          onPick: (value) => persist(row.id, field, value || null),
        })
        return
      }

      if (field.type === 'check') {
        persist(row.id, field, !row[field.id])
        return
      }

      // Text, number, date and currency are edited in the record panel where
      // there is room for a real input rather than a cramped cell.
      setOpenId(row.id)
    },
    [config.id, lookups, moveStage, persist],
  )

  const toolbarMenu = (e: React.MouseEvent, kind: 'sort' | 'group' | 'fields' | 'height') => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const base = { x: rect.left, y: rect.bottom + 5 }

    if (kind === 'sort') {
      setMenu({
        ...base,
        title: 'Sort by',
        items: [
          { value: '', label: 'Default order', checked: !sortBy },
          ...visibleFields.map((f) => ({
            value: f.id, label: f.label, icon: FIELD_ICON[f.type], checked: sortBy === f.id,
          })),
        ],
        onPick: (v) => setSortBy(v || null),
      })
    } else if (kind === 'group') {
      setMenu({
        ...base,
        title: 'Group by',
        items: [
          { value: '', label: 'None', checked: !groupBy },
          ...config.fields.filter((f) => f.type === 'select').map((f) => ({
            value: f.id, label: f.label, icon: 'sel', checked: groupBy === f.id,
          })),
        ],
        onPick: (v) => {
          setGroupBy(v || null)
          if (v && view.type !== 'board') {
            const board = config.views.find((x) => x.type === 'board')
            if (board) setViewId(board.id)
          }
        },
      })
    } else if (kind === 'fields') {
      setMenu({
        ...base,
        title: 'Toggle fields',
        items: config.fields.filter((f) => !f.primary && !f.secondary).map((f) => ({
          value: f.id, label: f.label, icon: FIELD_ICON[f.type], checked: !hidden.includes(f.id),
        })),
        onPick: (v) => setHidden((h) => (h.includes(v) ? h.filter((x) => x !== v) : [...h, v])),
      })
    } else {
      setMenu({
        ...base,
        title: 'Row height',
        items: [
          { value: '32', label: 'Short', checked: rowHeight === 32 },
          { value: '36', label: 'Medium', checked: rowHeight === 36 },
          { value: '46', label: 'Tall', checked: rowHeight === 46 },
          { value: '60', label: 'Extra tall', checked: rowHeight === 60 },
        ],
        onPick: (v) => {
          setRowHeight(Number(v))
          setHeightTouched(true)
        },
      })
    }
  }

  /* ------------------------------------------------------------- selection */

  const lastClicked = useRef<string | null>(null)

  const toggleSelect = useCallback(
    (id: string, event: React.MouseEvent | React.KeyboardEvent) => {
      // Shift-click extends from the last row clicked, over the rows as currently
      // filtered and sorted — what you see is what you get.
      if (event.shiftKey && lastClicked.current) {
        const order = filtered.map((r) => r.id)
        const from = order.indexOf(lastClicked.current)
        const to = order.indexOf(id)
        if (from !== -1 && to !== -1) {
          const span = order.slice(Math.min(from, to), Math.max(from, to) + 1)
          setSelected((s) => new Set([...s, ...span]))
          lastClicked.current = id
          return
        }
      }

      setSelected((s) => {
        const next = new Set(s)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      lastClicked.current = id
    },
    [filtered],
  )

  const toggleAll = useCallback(() => {
    setSelected((s) => {
      const allShown = filtered.length > 0 && filtered.every((r) => s.has(r.id))
      return allShown ? new Set<string>() : new Set(filtered.map((r) => r.id))
    })
  }, [filtered])

  /* ---------------------------------------------------------- bulk actions */

  const applyBulk = useCallback(
    (ids: string[], field: Field, value: string) => {
      const hasSideEffects =
        (config.id === 'deals' && field.id === 'stage') ||
        (config.id === 'tasks' && field.id === 'status')

      // Stage and status carry the history append and the Closed Won handoff, so
      // they go one at a time through the action that knows about them. A bulk
      // UPDATE would skip all of it and nobody would notice for a month.
      if (hasSideEffects) {
        startTransition(async () => {
          const results = await Promise.all(
            ids.map((id) =>
              config.id === 'deals'
                ? moveDealStage({ dealId: id, toStage: value as never })
                : moveTaskStatus({ taskId: id, toStatus: value as never }),
            ),
          )
          const failed = results.filter((r) => !r.ok).length
          setToast(
            failed
              ? { text: `${ids.length - failed} moved, ${failed} failed`, error: true }
              : { text: `${ids.length} moved — history written for each` },
          )
          setSelected(new Set())
          router.refresh()
        })
        return
      }

      const previous = rows
      setRows((current) =>
        current.map((r) => {
          if (!ids.includes(r.id)) return r
          if ((field.type === 'link' || field.type === 'user') && typeof value === 'string') {
            const label = (lookups[field.linkTo ?? ''] ?? []).find((o) => o.id === value)?.label ?? ''
            return { ...r, [field.id]: value ? { id: value, label, table: field.linkTo as TableId } : null }
          }
          return { ...r, [field.id]: value }
        }),
      )

      startTransition(async () => {
        const result = await bulkUpdateCell({
          table: config.id,
          ids,
          field: field.id,
          value: value === '' ? null : value,
        })
        if (!result.ok) {
          setRows(previous)
          setToast({ text: result.error, error: true })
          return
        }
        setToast({ text: result.detail ?? `${ids.length} updated` })
        setSelected(new Set())
        router.refresh()
      })
    },
    [config.id, rows, lookups, router],
  )

  const bulkSetField = useCallback(
    (event: React.MouseEvent, field: Field) => {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const ids = [...selected]
      const options =
        field.type === 'select'
          ? (field.options ?? []).map((o) => ({ value: o.value, label: o.label, color: o.color }))
          : [
              { value: '', label: 'Clear', icon: 'x' },
              ...(lookups[field.linkTo ?? ''] ?? []).map((o) => ({ value: o.id, label: o.label })),
            ]

      // The bar sits at the bottom of the window, so the menu opens upwards.
      // Menu clamps both coordinates, which keeps a long option list on screen.
      setMenu({
        x: rect.left,
        y: Math.max(12, rect.top - 8 - Math.min(340, 44 + options.length * 32)),
        title: `Set ${field.label} on ${ids.length}`,
        items: options,
        onPick: (value) => applyBulk(ids, field, value),
      })
    },
    [selected, lookups, applyBulk],
  )

  const removeSelected = useCallback(() => {
    const ids = [...selected]
    if (!ids.length) return

    const noun = ids.length === 1 ? config.singular : `${config.singular}s`

    // Past a screenful, a single OK is too cheap for something this permanent —
    // ask for the number, so the muscle memory of clicking through cannot do it.
    // The audit log can reconstruct the rows, but that is a repair, not an undo.
    if (ids.length > LARGE_DELETE) {
      const typed = window.prompt(
        `This deletes ${ids.length} ${noun} permanently.\n\nType ${ids.length} to confirm.`,
      )
      if (typed?.trim() !== String(ids.length)) {
        setToast({ text: 'Delete cancelled' })
        return
      }
    } else if (prefs.confirmDeletes) {
      // A browser confirm rather than a bespoke dialog: this is the one
      // irreversible action in the grid and it should feel heavier, not lighter.
      if (!window.confirm(`Delete ${ids.length} ${noun}? This cannot be undone.`)) return
    }

    const previous = rows
    setRows((current) => current.filter((r) => !ids.includes(r.id)))
    setSelected(new Set())

    startTransition(async () => {
      const result = await bulkDelete({ table: config.id, ids })
      if (!result.ok) {
        setRows(previous)
        setToast({ text: result.error, error: true })
        return
      }
      setToast({ text: result.detail ?? `${ids.length} deleted` })
      router.refresh()
    })
  }, [selected, rows, config.id, config.singular, prefs.confirmDeletes, router])

  const canCreate = CREATABLE.includes(config.id)
  const groupField = config.fields.find((f) => f.id === (groupBy ?? view.groupBy))

  /* ------------------------------------------------------------------ view */

  return (
    <>
      <div className="vtabs">
        {config.views.map((v) => (
          <button
            key={v.id}
            className={`vtab ${v.id === viewId ? 'active' : ''}`}
            onClick={() => {
              setViewId(v.id)
              setGroupBy(v.groupBy ?? null)
            }}
          >
            <span className="ic"><Icon name={v.icon} size={14} /></span>
            {v.name}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div className="tsearch">
          <Icon name="search" size={14} />
          <input
            placeholder={`Search ${config.name.toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="divider" />
        <button className="chipbtn" onClick={(e) => toolbarMenu(e, 'sort')}>
          <Icon name="sort" size={14} />Sort
        </button>
        <button className={`chipbtn ${groupBy ? 'on' : ''}`} onClick={(e) => toolbarMenu(e, 'group')}>
          <Icon name="group" size={14} />
          {groupBy ? `Grouped by ${config.fields.find((f) => f.id === groupBy)?.label}` : 'Group'}
        </button>
        {view.type === 'grid' ? (
          <>
            <button className="chipbtn" onClick={(e) => toolbarMenu(e, 'fields')}>
              <Icon name="hide" size={14} />Fields
            </button>
            <button className="chipbtn" onClick={(e) => toolbarMenu(e, 'height')}>
              <Icon name="rowh" size={14} />Height
            </button>
          </>
        ) : null}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span className="count">
            {filtered.length} of {rows.length}
          </span>
          <div className="divider" />
          <button className="btn pri sm" onClick={() => (canCreate ? setShowNew(true) : setToast({ text: `Create ${config.singular} arrives with the next slice` }))}>
            <Icon name="plus" size={14} />New {config.singular}
          </button>
        </div>
      </div>

      <div className="content">
        {view.type === 'grid' ? (
          <GridView
            config={config}
            fields={visibleFields}
            rows={filtered}
            rowHeight={rowHeight}
            selected={selected}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAll}
            onOpen={setOpenId}
            onEditCell={(e, row, field) => openFieldMenu(e, field, row)}
            onAdd={() => (canCreate ? setShowNew(true) : setToast({ text: 'Not creatable from here yet' }))}
          />
        ) : view.type === 'board' ? (
          <BoardView
            config={config}
            view={view}
            groupField={groupField}
            rows={filtered}
            onOpen={setOpenId}
            onMove={moveStage}
            onAdd={() => (canCreate ? setShowNew(true) : setToast({ text: 'Not creatable from here yet' }))}
            canDrag={Boolean(groupField && !groupField.computed)}
          />
        ) : (
          <TimelineView config={config} view={view} rows={filtered} onOpen={setOpenId} />
        )}
      </div>

      <RecordPanel
        config={config}
        row={openRow}
        lookups={lookups}
        onClose={() => setOpenId(null)}
        onChange={(field, value) => openRow && persist(openRow.id, field, value)}
        onOpenRecord={(table, id) => {
          if (table === config.id) setOpenId(id)
          else router.push(`/table/${table}?record=${id}`)
        }}
        openMenu={openFieldMenu}
      />

      {selected.size > 0 && view.type === 'grid' ? (
        <BulkBar
          config={config}
          fields={visibleFields}
          count={selected.size}
          onSetField={bulkSetField}
          onDelete={removeSelected}
          onClear={() => setSelected(new Set())}
        />
      ) : null}

      <Menu state={menu} onClose={() => setMenu(null)} />

      {showNew ? (
        <NewRecordDialog
          table={config.id}
          lookups={lookups}
          onClose={() => setShowNew(false)}
          onDone={(message) => {
            setShowNew(false)
            setToast({ text: message })
            router.refresh()
          }}
        />
      ) : null}

      {toast ? (
        <div className={`toast on ${toast.error ? 'err' : ''}`}>
          <Icon name={toast.error ? 'warn' : 'check'} size={14} />
          <span>{toast.text}</span>
        </div>
      ) : null}
    </>
  )
}
