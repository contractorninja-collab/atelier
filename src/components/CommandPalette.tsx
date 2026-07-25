'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from './Icon'
import { TABLES, TABLE_IDS } from '@/lib/tables'
import type { TableId } from '@/lib/types'

type Entry = { group: string; label: string; icon: string; meta?: string; run: () => void }

export function CommandPalette({
  open, onClose, index,
}: {
  open: boolean
  onClose: () => void
  index: Record<string, { id: string; label: string }[]>
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
    }
  }, [open])

  const entries = useMemo<Entry[]>(() => {
    const q = query.toLowerCase().trim()
    const out: Entry[] = []

    const actions: Entry[] = [
      { group: 'Go to', label: 'Home', icon: 'home', run: () => router.push('/home') },
      { group: 'Go to', label: 'My work', icon: 'check', run: () => router.push('/my-work') },
      {
        group: 'Actions',
        label: 'Toggle dark mode',
        icon: 'moon',
        run: () => {
          const el = document.documentElement
          el.setAttribute('data-theme', el.getAttribute('data-theme') === 'dark' ? 'light' : 'dark')
        },
      },
    ]
    for (const a of actions) if (!q || a.label.toLowerCase().includes(q)) out.push(a)

    for (const id of TABLE_IDS) {
      const table = TABLES[id]
      if (!q || table.name.toLowerCase().includes(q)) {
        out.push({
          group: 'Tables',
          label: table.name,
          icon: table.icon,
          run: () => router.push(`/table/${id}`),
        })
      }
    }

    if (q.length >= 2) {
      for (const [tableId, items] of Object.entries(index)) {
        const table = TABLES[tableId as TableId]
        if (!table) continue
        for (const item of items) {
          if (out.length > 40) break
          if (item.label.toLowerCase().includes(q)) {
            out.push({
              group: 'Records',
              label: item.label,
              icon: table.icon,
              meta: table.name,
              run: () => router.push(`/table/${tableId}?record=${item.id}`),
            })
          }
        }
      }
    }

    return out
  }, [query, index, router])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor((c) => Math.min(c + 1, entries.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor((c) => Math.max(c - 1, 0))
      }
      if (e.key === 'Enter' && entries[cursor]) {
        e.preventDefault()
        entries[cursor].run()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, entries, cursor, onClose])

  if (!open) return null

  let lastGroup = ''

  return (
    <>
      <div className="pal-scrim" onClick={onClose} />
      <div className="pal">
        <div className="pal-i">
          <Icon name="search" size={17} />
          <input
            autoFocus
            value={query}
            placeholder="Search records, tables and actions…"
            onChange={(e) => {
              setQuery(e.target.value)
              setCursor(0)
            }}
          />
        </div>
        <div className="pal-r">
          {entries.length === 0 ? (
            <div className="pal-empty">No matches</div>
          ) : (
            entries.map((entry, i) => {
              const header = entry.group !== lastGroup ? entry.group : null
              lastGroup = entry.group
              return (
                <div key={`${entry.group}-${entry.label}-${i}`}>
                  {header ? <div className="pal-g">{header}</div> : null}
                  <button
                    className={`pal-o ${i === cursor ? 'sel' : ''}`}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => {
                      entry.run()
                      onClose()
                    }}
                  >
                    <Icon name={entry.icon} size={15} />
                    <span>{entry.label}</span>
                    {entry.meta ? <span className="pm">{entry.meta}</span> : null}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
