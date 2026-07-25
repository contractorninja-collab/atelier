'use server'

import { auth } from '@/auth'
import { TABLES } from '@/lib/tables'
import { getRows } from './queries'
import type { LinkRef, Row, TableId } from '@/lib/types'

export type RelatedGroup = {
  table: TableId
  tableName: string
  via: string
  color: string
  rows: { id: string; label: string; status: string | null; statusColor: string | null }[]
}

/**
 * Walks every table looking for link fields that point back at this record.
 * Generic on purpose — adding a table to the config makes it show up here
 * without touching this function.
 */
export async function fetchRelated(table: TableId, id: string): Promise<RelatedGroup[]> {
  const session = await auth()
  if (!session?.user) return []

  const groups: RelatedGroup[] = []

  for (const config of Object.values(TABLES)) {
    const linkFields = config.fields.filter((f) => f.linkTo === table)
    if (linkFields.length === 0) continue

    let rows: Row[]
    try {
      rows = await getRows(config.id)
    } catch {
      continue
    }

    for (const field of linkFields) {
      const matches = rows.filter((r) => {
        const v = r[field.id]
        if (!v) return false
        if (Array.isArray(v)) return (v as LinkRef[]).some((x) => x?.id === id)
        return (v as LinkRef).id === id
      })
      if (matches.length === 0) continue

      const primary = config.fields.find((f) => f.primary)
      const statusField =
        config.fields.find((f) => f.type === 'select' && ['status', 'stage', 'lifecycle'].includes(f.id)) ??
        config.fields.find((f) => f.type === 'select')

      groups.push({
        table: config.id,
        tableName: config.name,
        via: field.label,
        color: config.color,
        rows: matches.slice(0, 25).map((r) => {
          const statusValue = statusField ? r[statusField.id] : null
          const option = statusField?.options?.find((o) => o.value === statusValue)
          return {
            id: r.id,
            label: primary ? String(r[primary.id] ?? '—') : r.id,
            status: option?.label ?? null,
            statusColor: option?.color ?? null,
          }
        }),
      })
    }
  }

  return groups
}
