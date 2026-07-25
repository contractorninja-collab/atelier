'use client'

import { useState, useTransition } from 'react'
import { Icon } from './Icon'
import { createDeal, createOrganization } from '@/server/actions'
import { DEAL_STAGE_OPTIONS } from '@/lib/tables'
import type { TableId } from '@/lib/types'

type Props = {
  table: TableId
  lookups: Record<string, { id: string; label: string }[]>
  onClose: () => void
  onDone: (message: string) => void
}

export function NewRecordDialog({ table, lookups, onClose, onDone }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [organizationId, setOrganizationId] = useState(lookups.organizations?.[0]?.id ?? '')
  const [ownerId, setOwnerId] = useState('')
  const [dealType, setDealType] = useState('Subscription')
  const [closeDate, setCloseDate] = useState('')

  const isDeal = table === 'deals'

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = isDeal
        ? await createDeal({
            name,
            organizationId,
            ownerId: ownerId || null,
            type: dealType as never,
            expectedCloseDate: closeDate || null,
          })
        : await createOrganization({ name, domain, ownerId: ownerId || null })

      if (result.ok) onDone(isDeal ? `${name} added to Qualifying` : `${name} created`)
      else setError(result.error)
    })
  }

  return (
    <>
      <div className="scrim on" onClick={onClose} />
      <div
        style={{
          position: 'fixed', top: '18vh', left: '50%', transform: 'translateX(-50%)',
          width: 'min(440px, 92vw)', background: 'var(--bg)', border: '1px solid var(--line)',
          borderRadius: 14, boxShadow: 'var(--shadow-lg)', zIndex: 62, padding: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 670, letterSpacing: '-0.01em' }}>
            New {isDeal ? 'deal' : 'company'}
          </h2>
          <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose}>
            <Icon name="x" size={15} />
          </button>
        </div>

        <form onSubmit={submit} className="login" style={{ padding: 0, border: 'none', boxShadow: 'none', width: '100%' }}>
          <label htmlFor="nr-name">{isDeal ? 'Deal name' : 'Company name'}</label>
          <input
            id="nr-name" type="text" required autoFocus value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isDeal ? 'Acme — Payments — 2026-Q4' : 'Acme Logistics'}
            style={{ width: '100%' }}
          />

          {isDeal ? (
            <>
              <label htmlFor="nr-org" style={{ marginTop: 14 }}>Company</label>
              <select
                id="nr-org" value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}
                required
                style={{ width: '100%', padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 7, background: 'var(--bg)' }}
              >
                {(lookups.organizations ?? []).map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>

              <label htmlFor="nr-type" style={{ marginTop: 14 }}>Deal type</label>
              <select
                id="nr-type" value={dealType} onChange={(e) => setDealType(e.target.value)}
                style={{ width: '100%', padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 7, background: 'var(--bg)' }}
              >
                {['Subscription', 'Project', 'Hybrid', 'Retainer'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <label htmlFor="nr-close" style={{ marginTop: 14 }}>Expected close</label>
              <input
                id="nr-close" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)}
                style={{ width: '100%', padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 7, background: 'var(--bg)' }}
              />
            </>
          ) : (
            <>
              <label htmlFor="nr-domain" style={{ marginTop: 14 }}>Domain</label>
              <input
                id="nr-domain" type="text" required value={domain}
                onChange={(e) => setDomain(e.target.value)} placeholder="acme.com"
                style={{ width: '100%' }}
              />
              <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '6px 0 0' }}>
                The dedupe key. Stored bare — no protocol, no www.
              </p>
            </>
          )}

          <label htmlFor="nr-owner" style={{ marginTop: 14 }}>Owner</label>
          <select
            id="nr-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}
            style={{ width: '100%', padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 7, background: 'var(--bg)' }}
          >
            <option value="">Me</option>
            {(lookups.team ?? []).map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>

          {isDeal ? (
            <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '14px 0 0' }}>
              Opens in {DEAL_STAGE_OPTIONS[0].label}. Add line items on the record to give it a value.
            </p>
          ) : null}

          {error ? (
            <p style={{ color: '#e2597a', fontSize: 12.5, margin: '14px 0 0' }}>{error}</p>
          ) : null}

          <button className="btn pri full" type="submit" disabled={pending}>
            {pending ? 'Saving…' : `Create ${isDeal ? 'deal' : 'company'}`}
          </button>
        </form>
      </div>
    </>
  )
}
