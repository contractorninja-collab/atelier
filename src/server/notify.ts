import 'server-only'
import { inArray } from 'drizzle-orm'
import { db } from '@/db'
import * as t from '@/db/schema'
import { getTable } from '@/lib/tables'
import { assignmentPhrase } from '@/lib/assignments'
import type { TableId } from '@/lib/types'

/**
 * Assignment emails.
 *
 * One rule above all: notifying must never break the write it describes. Every
 * path out of here is a return or a logged error — the assignment has already
 * committed by the time this runs, and failing it because a mail API hiccuped
 * would trade a real change for a vanity one.
 *
 * Sent through Resend's plain REST API with the same key the magic-link login
 * already uses — no new service, no new secret. When the key is absent (local
 * development), it logs and does nothing, so the write paths behave
 * identically everywhere.
 */

const LABEL_KEYS = ['name', 'title', 'subject', 'number', 'period', 'email', 'slug'] as const

/** Something a person will recognise — humanLabel's rule, for arbitrary rows. */
function labelOf(row: Record<string, unknown>, singular: string): string {
  for (const key of LABEL_KEYS) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return `A ${singular}`
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function notifyAssignment(input: {
  actorMemberId: string | null
  actorEmail: string | null
  table: TableId
  field: string
  assigneeMemberId: string
  /**
   * The rows as written, or a thunk that fetches them. The thunk form matters:
   * it runs inside this function's try, after the cheap guards — so a caller
   * whose row data needs a query neither pays it when the email will not send,
   * nor lets that query's failure escape into the action and fail a write that
   * has already committed. That is not hypothetical on this deployment.
   */
  rows: Record<string, unknown>[] | (() => Promise<Record<string, unknown>[]>)
}): Promise<void> {
  try {
    const phrase = assignmentPhrase(input.table, input.field)
    if (!phrase) return

    // Assigning something to yourself is how most work starts. No email.
    if (!input.assigneeMemberId || input.assigneeMemberId === input.actorMemberId) return

    const key = process.env.AUTH_RESEND_KEY
    const from = process.env.EMAIL_FROM
    if (!key || !from) {
      console.log('assignment email skipped: Resend is not configured')
      return
    }

    const rows = typeof input.rows === 'function' ? await input.rows() : input.rows
    if (rows.length === 0) return

    const memberIds = [input.assigneeMemberId, input.actorMemberId].filter((x): x is string => Boolean(x))
    const people = await db.query.teamMembers.findMany({
      where: inArray(t.teamMembers.id, memberIds),
      columns: { id: true, name: true, email: true },
    })
    const assignee = people.find((p) => p.id === input.assigneeMemberId)
    if (!assignee?.email) return
    const actorName =
      people.find((p) => p.id === input.actorMemberId)?.name ?? input.actorEmail ?? 'Someone'

    const config = getTable(input.table)
    const singular = config?.singular ?? 'record'
    const base = (process.env.AUTH_URL ?? '').replace(/\/$/, '')
    const items = rows.map((row) => ({
      label: labelOf(row, singular),
      url: base && row.id ? `${base}/table/${input.table}?record=${row.id}` : null,
    }))

    const subject =
      items.length === 1
        ? `${items[0].label} — ${phrase}`
        : `${items.length} ${(config?.name ?? 'records').toLowerCase()} — ${phrase}`

    // Up to eight named, the rest counted. A 200-row bulk assign is one email.
    const listed = items.slice(0, 8)
    const rest = items.length - listed.length
    const lines = listed
      .map((item) => {
        const label = escapeHtml(item.label)
        return `<li style="margin:4px 0">${item.url ? `<a href="${item.url}" style="color:#1c8c5a">${label}</a>` : label}</li>`
      })
      .join('')

    const html = `
      <div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:480px;color:#1a1a1a">
        <p style="font-size:14px"><strong>${escapeHtml(actorName)}</strong> made this yours in Atelier — ${escapeHtml(phrase)}:</p>
        <ul style="font-size:15px;font-weight:600;padding-left:18px">${lines}</ul>
        ${rest > 0 ? `<p style="font-size:13px;color:#666">…and ${rest} more.</p>` : ''}
        <p style="font-size:12px;color:#999;margin-top:24px">Atelier · the house workspace</p>
      </div>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: assignee.email, subject, html }),
      // A slow mail API must not hold the user's save hostage. Five seconds,
      // then the abort lands in the catch below and the write returns fine.
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) {
      console.error('assignment email refused', res.status, (await res.text()).slice(0, 200))
    }
  } catch (error) {
    console.error('assignment email failed', error)
  }
}
