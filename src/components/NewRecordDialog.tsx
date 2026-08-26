'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { GenericForm } from './GenericForm'
import {
  createDeal, createInvoice, createMeasurable, createOrganization, createPayment, createTarget, createTeamMember,
  openInvoices, suggestInvoiceNumber,
} from '@/server/actions'
import { CREATE_SPEC, DEAL_STAGE_OPTIONS, TABLES, TARGET_METRIC_UNIT } from '@/lib/tables'
import type { ActionResult, TableId } from '@/lib/types'

type Lookups = Record<string, { id: string; label: string }[]>

/**
 * Tables with a bespoke form, because something about them is not expressible as
 * a field list: a deal opens in a specific stage, a target's unit depends on its
 * metric, an invoice numbers itself, a payment defaults to what is outstanding.
 */
const BESPOKE: TableId[] = ['deals', 'organizations', 'targets', 'team', 'invoices', 'payments', 'measurables']

/**
 * Everything creatable — the bespoke forms plus every table declaring a
 * CREATE_SPEC, which the generic form renders straight from the table config.
 * The audit log is deliberately absent: it is append-only and written by the
 * server, never by a person.
 */
export const CREATABLE: TableId[] = [
  ...BESPOKE,
  ...(Object.keys(CREATE_SPEC) as TableId[]).filter((id) => !BESPOKE.includes(id)),
]

const TITLES: Partial<Record<TableId, string>> = {
  deals: 'deal',
  organizations: 'company',
  targets: 'target',
  measurables: 'measurable',
  team: 'member',
  invoices: 'invoice',
  payments: 'payment',
}

const selectStyle = {
  width: '100%', padding: '9px 11px', border: '1px solid var(--line)',
  borderRadius: 7, background: 'var(--bg)',
}
const hintStyle = { fontSize: 11.5, color: 'var(--ink-3)', margin: '6px 0 0' }

/** Options straight off the table config, so a new option appears here for free. */
const optionsFor = (table: TableId, fieldId: string) =>
  TABLES[table].fields.find((f) => f.id === fieldId)?.options ?? []

/** The submit/pending/error plumbing every form repeats. */
function useCreate(onDone: (message: string) => void) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const submit = (
    e: React.FormEvent,
    run: () => Promise<ActionResult>,
    message: (result: ActionResult) => string,
  ) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await run()
      if (!result.ok) {
        setError(result.error)
        return
      }
      onDone(message(result))
    })
  }

  return { pending, error, submit }
}

function Submit({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button className="btn pri full" type="submit" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  )
}

function Error({ error }: { error: string | null }) {
  if (!error) return null
  return <p style={{ color: 'var(--danger)', fontSize: 12.5, margin: '14px 0 0' }}>{error}</p>
}

/* --------------------------------------------------------------------- shell */

/**
 * Context supplied when the dialog is opened from somewhere that already knows
 * the answers — raising an invoice against an accepted milestone, say. The fixed
 * values render as a summary line instead of pickers you would only re-choose.
 */
export type InvoicePrefill = {
  kind: 'invoice'
  organizationId: string
  organizationName: string
  projectId?: string | null
  projectName?: string | null
  milestoneId?: string | null
  milestoneName?: string | null
  amountCents?: number
}

export type PaymentPrefill = {
  kind: 'payment'
  invoiceId: string
  invoiceNumber: string
  clientName: string
  outstandingCents: number
}

export type Prefill = InvoicePrefill | PaymentPrefill

export function NewRecordDialog({
  table, lookups, onClose, onDone, prefill,
}: {
  table: TableId
  lookups: Lookups
  onClose: () => void
  onDone: (message: string) => void
  prefill?: Prefill
}) {
  const title = TITLES[table] ?? TABLES[table].singular
  const [genericPending, setGenericPending] = useState(false)

  // Two separate escapes, both needed.
  //
  // Callers open this from buttons inside rows that are themselves links — the
  // dashboard's overdue list, the cockpit's invoice list. The portal moves the
  // markup out of the anchor so the HTML is valid. That alone is not enough:
  // React synthetic events bubble through the *React tree*, not the DOM, so a
  // click in here still reaches the Link's handler and navigates away — which
  // unmounts the pending action and loses the write with no error anywhere.
  // Hence the stopPropagation wrapper.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <div onClick={(e) => e.stopPropagation()} onSubmit={(e) => e.stopPropagation()}>
      <div className="scrim on" onClick={onClose} />
      <div
        style={{
          position: 'fixed', top: '14vh', left: '50%', transform: 'translateX(-50%)',
          width: 'min(440px, 92vw)', maxHeight: '76vh', overflowY: 'auto',
          background: 'var(--bg)', border: '1px solid var(--line)',
          borderRadius: 14, boxShadow: 'var(--shadow-lg)', zIndex: 62, padding: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 670, letterSpacing: '-0.01em' }}>
            New {title}
          </h2>
          <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose}>
            <Icon name="x" size={15} />
          </button>
        </div>

        {table === 'deals' ? <DealForm lookups={lookups} onDone={onDone} /> : null}
        {table === 'organizations' ? <CompanyForm lookups={lookups} onDone={onDone} /> : null}
        {table === 'targets' ? <TargetForm lookups={lookups} onDone={onDone} /> : null}
        {table === 'team' ? <MemberForm onDone={onDone} /> : null}
        {table === 'measurables' ? <MeasurableForm lookups={lookups} onDone={onDone} /> : null}
        {table === 'invoices' ? (
          <InvoiceForm
            lookups={lookups} onDone={onDone}
            prefill={prefill?.kind === 'invoice' ? prefill : undefined}
          />
        ) : null}
        {table === 'payments' ? (
          <PaymentForm onDone={onDone} prefill={prefill?.kind === 'payment' ? prefill : undefined} />
        ) : null}
        {!BESPOKE.includes(table) ? (
          <GenericForm
            table={table} lookups={lookups} onDone={onDone}
            pending={genericPending} setPending={setGenericPending}
          />
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

const formStyle = { padding: 0, border: 'none', boxShadow: 'none', width: '100%' }

/* ---------------------------------------------------------------------- deal */

function DealForm({ lookups, onDone }: { lookups: Lookups; onDone: (m: string) => void }) {
  const { pending, error, submit } = useCreate(onDone)
  const [name, setName] = useState('')
  const [organizationId, setOrganizationId] = useState(lookups.organizations?.[0]?.id ?? '')
  const [ownerId, setOwnerId] = useState('')
  const [type, setType] = useState('Subscription')
  const [closeDate, setCloseDate] = useState('')

  return (
    <form
      className="login"
      style={formStyle}
      onSubmit={(e) =>
        submit(
          e,
          () => createDeal({
            name, organizationId, ownerId: ownerId || null,
            type: type as never, expectedCloseDate: closeDate || null,
          }),
          () => `${name} added to Qualifying`,
        )
      }
    >
      <label htmlFor="nr-name">Deal name</label>
      <input
        id="nr-name" type="text" required autoFocus value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Acme — Payments — 2026-Q4" style={{ width: '100%' }}
      />

      <label htmlFor="nr-org" style={{ marginTop: 14 }}>Company</label>
      <select
        id="nr-org" value={organizationId} required
        onChange={(e) => setOrganizationId(e.target.value)} style={selectStyle}
      >
        {(lookups.organizations ?? []).map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>

      <label htmlFor="nr-type" style={{ marginTop: 14 }}>Deal type</label>
      <select id="nr-type" value={type} onChange={(e) => setType(e.target.value)} style={selectStyle}>
        {['Subscription', 'Project', 'Hybrid', 'Retainer'].map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <label htmlFor="nr-close" style={{ marginTop: 14 }}>Expected close</label>
      <input
        id="nr-close" type="date" value={closeDate}
        onChange={(e) => setCloseDate(e.target.value)} style={selectStyle}
      />

      <OwnerSelect lookups={lookups} value={ownerId} onChange={setOwnerId} />

      <p style={{ ...hintStyle, marginTop: 14 }}>
        Opens in {DEAL_STAGE_OPTIONS[0].label}. Add line items on the record to give it a value.
      </p>

      <Error error={error} />
      <Submit pending={pending} label="Create deal" />
    </form>
  )
}

/* ------------------------------------------------------------------- company */

function CompanyForm({ lookups, onDone }: { lookups: Lookups; onDone: (m: string) => void }) {
  const { pending, error, submit } = useCreate(onDone)
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [ownerId, setOwnerId] = useState('')

  return (
    <form
      className="login"
      style={formStyle}
      onSubmit={(e) =>
        submit(e, () => createOrganization({ name, domain, ownerId: ownerId || null }), () => `${name} created`)
      }
    >
      <label htmlFor="nr-name">Company name</label>
      <input
        id="nr-name" type="text" required autoFocus value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Acme Logistics" style={{ width: '100%' }}
      />

      <label htmlFor="nr-domain" style={{ marginTop: 14 }}>Domain</label>
      <input
        id="nr-domain" type="text" required value={domain}
        onChange={(e) => setDomain(e.target.value)}
        placeholder="acme.com" style={{ width: '100%' }}
      />
      <p style={hintStyle}>The dedupe key. Stored bare — no protocol, no www.</p>

      <OwnerSelect lookups={lookups} value={ownerId} onChange={setOwnerId} />

      <Error error={error} />
      <Submit pending={pending} label="Create company" />
    </form>
  )
}

/* -------------------------------------------------------------------- target */

function TargetForm({ lookups, onDone }: { lookups: Lookups; onDone: (m: string) => void }) {
  const { pending, error, submit } = useCreate(onDone)
  const [period, setPeriod] = useState('')
  const [metric, setMetric] = useState('NewBusinessTCV')
  const [scope, setScope] = useState('Company')
  const [amount, setAmount] = useState('')
  const [memberId, setMemberId] = useState('')

  const unit = TARGET_METRIC_UNIT[metric] ?? 'count'

  return (
    <form
      className="login"
      style={formStyle}
      onSubmit={(e) =>
        submit(
          e,
          () => createTarget({
            period, metric, scope,
            teamMemberId: memberId || null,
            amount: Number(amount),
          }),
          (r) => (r.ok && r.detail) || 'Target created',
        )
      }
    >
      <label htmlFor="nt-period">Period</label>
      <input
        id="nt-period" type="text" required autoFocus value={period}
        onChange={(e) => setPeriod(e.target.value)}
        placeholder="2026-Q3" style={{ width: '100%' }}
      />
      <p style={hintStyle}>A quarter (2026-Q3) or a month (2026-07).</p>

      <label htmlFor="nt-metric" style={{ marginTop: 14 }}>Metric</label>
      <select id="nt-metric" value={metric} onChange={(e) => setMetric(e.target.value)} style={selectStyle}>
        {optionsFor('targets', 'metric').map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <label htmlFor="nt-amount" style={{ marginTop: 14 }}>
        Target {unit === 'money' ? '(€)' : unit === 'percent' ? '(%)' : '(count)'}
      </label>
      <input
        id="nt-amount" type="number" required min={0}
        max={unit === 'percent' ? 100 : undefined}
        step={unit === 'count' ? 1 : 'any'}
        value={amount} onChange={(e) => setAmount(e.target.value)}
        placeholder={unit === 'money' ? '250000' : unit === 'percent' ? '75' : '12'}
        style={{ width: '100%' }}
      />
      <p style={hintStyle}>
        {unit === 'money'
          ? 'In euros. Stored as cents.'
          : unit === 'percent'
            ? 'A percentage. Stored as basis points.'
            : 'A plain count of deals.'}
      </p>

      <label htmlFor="nt-scope" style={{ marginTop: 14 }}>Scope</label>
      <select id="nt-scope" value={scope} onChange={(e) => setScope(e.target.value)} style={selectStyle}>
        {optionsFor('targets', 'scope').map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {scope === 'Individual' ? (
        <>
          <label htmlFor="nt-member" style={{ marginTop: 14 }}>Team member</label>
          <select
            id="nt-member" value={memberId} required
            onChange={(e) => setMemberId(e.target.value)} style={selectStyle}
          >
            <option value="">Choose someone…</option>
            {(lookups.team ?? []).map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </>
      ) : (
        <p style={{ ...hintStyle, marginTop: 14 }}>
          {scope === 'Company'
            ? 'A company-wide number. The dashboard measures coverage against this.'
            : 'A team number, not attributed to one person.'}
        </p>
      )}

      <Error error={error} />
      <Submit pending={pending} label="Create target" />
    </form>
  )
}

/* --------------------------------------------------------------- measurable */

/**
 * Bespoke for the same reason the target form is: the goal's unit depends on
 * the unit chosen beside it, which the generic field list cannot express.
 */
function MeasurableForm({ lookups, onDone }: { lookups: Lookups; onDone: (m: string) => void }) {
  const { pending, error, submit } = useCreate(onDone)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('Count')
  const [direction, setDirection] = useState('AtLeast')
  const [goal, setGoal] = useState('')
  const [ownerId, setOwnerId] = useState('')

  return (
    <form
      className="login"
      style={formStyle}
      onSubmit={(e) =>
        submit(
          e,
          () => createMeasurable({
            name, unit, direction,
            ownerId: ownerId || null,
            goal: Number(goal),
          }),
          (r) => (r.ok && r.detail) || 'Measurable created',
        )
      }
    >
      <label htmlFor="nm-name">Measurable</label>
      <input
        id="nm-name" type="text" required autoFocus value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Weekly cash collected" style={{ width: '100%' }}
      />
      <p style={hintStyle}>The number somebody reads out every week.</p>

      <label htmlFor="nm-unit" style={{ marginTop: 14 }}>Unit</label>
      <select id="nm-unit" value={unit} onChange={(e) => setUnit(e.target.value)} style={selectStyle}>
        {optionsFor('measurables', 'unit').map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <label htmlFor="nm-goal" style={{ marginTop: 14 }}>
        Goal {unit === 'Money' ? '(€)' : unit === 'Percent' ? '(%)' : '(count)'}
      </label>
      <input
        id="nm-goal" type="number" required min={0}
        max={unit === 'Percent' ? 100 : undefined}
        step={unit === 'Count' ? 1 : 'any'}
        value={goal} onChange={(e) => setGoal(e.target.value)}
        placeholder={unit === 'Money' ? '12000' : unit === 'Percent' ? '75' : '3'}
        style={{ width: '100%' }}
      />
      <p style={hintStyle}>
        {unit === 'Money'
          ? 'In euros. Stored as cents.'
          : unit === 'Percent'
            ? 'A percentage. Stored as basis points.'
            : 'A plain count.'}
      </p>

      <label htmlFor="nm-direction" style={{ marginTop: 14 }}>Direction</label>
      <select id="nm-direction" value={direction} onChange={(e) => setDirection(e.target.value)} style={selectStyle}>
        {optionsFor('measurables', 'direction').map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <p style={hintStyle}>
        {direction === 'AtLeast'
          ? 'On track when the week is at or above goal.'
          : 'On track when the week is at or below goal.'}
      </p>

      <label htmlFor="nm-owner" style={{ marginTop: 14 }}>Owner</label>
      <select id="nm-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} style={selectStyle}>
        <option value="">Nobody yet</option>
        {(lookups.team ?? []).map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      <p style={hintStyle}>Who answers for this number in the meeting.</p>

      <Error error={error} />
      <Submit pending={pending} label="Create measurable" />
    </form>
  )
}

/* -------------------------------------------------------------------- member */

function MemberForm({ onDone }: { onDone: (m: string) => void }) {
  const { pending, error, submit } = useCreate(onDone)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Engineer')
  const [department, setDepartment] = useState('Engineering')
  const [capacity, setCapacity] = useState('40')

  return (
    <form
      className="login"
      style={formStyle}
      onSubmit={(e) =>
        submit(
          e,
          () => createTeamMember({
            name, email, role, department,
            weeklyCapacityHours: Number(capacity),
          }),
          () => `${name} added to the team`,
        )
      }
    >
      <label htmlFor="nm-name">Full name</label>
      <input
        id="nm-name" type="text" required autoFocus value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Anna Nowak" style={{ width: '100%' }}
      />

      <label htmlFor="nm-email" style={{ marginTop: 14 }}>Work email</label>
      <input
        id="nm-email" type="email" required value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="anna@yourhouse.com" style={{ width: '100%' }}
      />
      <p style={{ ...hintStyle, color: 'var(--accent-600)' }}>
        This grants access. Sign-in is invite-only and checks this table, so
        whoever controls this address can sign in and read the whole pipeline.
      </p>

      <label htmlFor="nm-role" style={{ marginTop: 14 }}>Role</label>
      <select id="nm-role" value={role} onChange={(e) => setRole(e.target.value)} style={selectStyle}>
        {optionsFor('team', 'role').map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <label htmlFor="nm-dept" style={{ marginTop: 14 }}>Department</label>
      <select
        id="nm-dept" value={department}
        onChange={(e) => setDepartment(e.target.value)} style={selectStyle}
      >
        {optionsFor('team', 'department').map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <label htmlFor="nm-cap" style={{ marginTop: 14 }}>Capacity (h/wk)</label>
      <input
        id="nm-cap" type="number" required min={0} max={80} value={capacity}
        onChange={(e) => setCapacity(e.target.value)} style={{ width: '100%' }}
      />
      <p style={hintStyle}>
        Every utilisation figure divides by this. 40 for full time, the real number otherwise.
      </p>

      <p style={{ ...hintStyle, marginTop: 14 }}>
        Opens as Active. Timezone, squad and start date are editable on the record afterwards.
      </p>

      <Error error={error} />
      <Submit pending={pending} label="Add member" />
    </form>
  )
}

/* ------------------------------------------------------------------- invoice */

function InvoiceForm({
  lookups, onDone, prefill,
}: {
  lookups: Lookups
  onDone: (m: string) => void
  prefill?: InvoicePrefill
}) {
  const { pending, error, submit } = useCreate(onDone)

  const [number, setNumber] = useState('')
  const [organizationId, setOrganizationId] = useState(prefill?.organizationId ?? lookups.organizations?.[0]?.id ?? '')
  const [projectId, setProjectId] = useState(prefill?.projectId ?? '')
  const [status, setStatus] = useState('Draft')
  const [issueDate, setIssueDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [amount, setAmount] = useState(prefill?.amountCents ? String(prefill.amountCents / 100) : '')
  const [tax, setTax] = useState('0')

  // The reference and the standard terms come from the server so the number
  // shown is the number that will be used, rather than a guess the insert
  // silently corrects.
  useEffect(() => {
    let live = true
    suggestInvoiceNumber()
      .then((s) => {
        if (!live) return
        setNumber((n) => n || s.number)
        setIssueDate((d) => d || s.issueDate)
        setDueDate((d) => d || s.dueDate)
      })
      .catch(() => {})
    return () => { live = false }
  }, [])

  const total = (Number(amount) || 0) + (Number(tax) || 0)

  return (
    <form
      className="login"
      style={formStyle}
      onSubmit={(e) =>
        submit(
          e,
          () => createInvoice({
            number,
            organizationId,
            projectId: projectId || null,
            milestoneId: prefill?.milestoneId ?? null,
            status,
            issueDate,
            dueDate,
            amount: Number(amount),
            tax: Number(tax) || 0,
          }),
          (r) => (r.ok && r.detail) || 'Invoice raised',
        )
      }
    >
      <label htmlFor="ni-number">Invoice number</label>
      <input
        id="ni-number" type="text" required value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder="INV-2026-001" style={{ width: '100%' }}
      />
      <p style={hintStyle}>The next free reference. Change it if you number differently.</p>

      {prefill ? (
        <div className="ni-context">
          <div><b>{prefill.organizationName}</b></div>
          {prefill.projectName ? <div>{prefill.projectName}</div> : null}
          {prefill.milestoneName ? <div>Against milestone: {prefill.milestoneName}</div> : null}
        </div>
      ) : (
        <>
          <label htmlFor="ni-org" style={{ marginTop: 14 }}>Client</label>
          <select
            id="ni-org" value={organizationId} required
            onChange={(e) => setOrganizationId(e.target.value)} style={selectStyle}
          >
            {(lookups.organizations ?? []).map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>

          <label htmlFor="ni-project" style={{ marginTop: 14 }}>Project</label>
          <select
            id="ni-project" value={projectId}
            onChange={(e) => setProjectId(e.target.value)} style={selectStyle}
          >
            <option value="">None — not against a project</option>
            {(lookups.projects ?? []).map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </>
      )}

      <label htmlFor="ni-amount" style={{ marginTop: 14 }}>Net amount (€)</label>
      <input
        id="ni-amount" type="number" required min={0} step="any" value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="2900" style={{ width: '100%' }}
      />

      <label htmlFor="ni-tax" style={{ marginTop: 14 }}>Tax (€)</label>
      <input
        id="ni-tax" type="number" min={0} step="any" value={tax}
        onChange={(e) => setTax(e.target.value)} style={{ width: '100%' }}
      />
      <p style={hintStyle}>
        Total <b>€{total.toLocaleString('en-IE')}</b>. Both stored as cents; the outstanding
        figure is measured on the total.
      </p>

      <label htmlFor="ni-issue" style={{ marginTop: 14 }}>Issue date</label>
      <input
        id="ni-issue" type="date" required value={issueDate}
        onChange={(e) => setIssueDate(e.target.value)} style={selectStyle}
      />

      <label htmlFor="ni-due" style={{ marginTop: 14 }}>Due date</label>
      <input
        id="ni-due" type="date" required value={dueDate}
        onChange={(e) => setDueDate(e.target.value)} style={selectStyle}
      />

      <label htmlFor="ni-status" style={{ marginTop: 14 }}>Status</label>
      <select id="ni-status" value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
        <option value="Draft">Draft — not sent yet</option>
        <option value="Sent">Sent — the clock is running</option>
      </select>
      <p style={hintStyle}>
        A draft counts as outstanding but never as overdue. Only a sent invoice ages.
      </p>

      <Error error={error} />
      <Submit pending={pending} label="Raise invoice" />
    </form>
  )
}

/* ------------------------------------------------------------------- payment */

type OpenInvoice = { id: string; number: string; client: string; outstandingCents: number }

function PaymentForm({
  onDone, prefill,
}: {
  onDone: (m: string) => void
  prefill?: PaymentPrefill
}) {
  const { pending, error, submit } = useCreate(onDone)

  const [invoices, setInvoices] = useState<OpenInvoice[] | null>(null)
  const [invoiceId, setInvoiceId] = useState(prefill?.invoiceId ?? '')
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState(
    prefill ? String(prefill.outstandingCents / 100) : '',
  )
  const [method, setMethod] = useState('Transfer')
  const [reference, setReference] = useState('')

  // Only invoices with money on them. Void and settled ones are absent, which
  // is also what stops the same transfer being recorded twice.
  useEffect(() => {
    if (prefill) return
    let live = true
    openInvoices()
      .then((rows) => {
        if (!live) return
        setInvoices(rows)
        setInvoiceId((current) => current || rows[0]?.id || '')
      })
      .catch(() => setInvoices([]))
    return () => { live = false }
  }, [prefill])

  const chosen = prefill
    ? { outstandingCents: prefill.outstandingCents, number: prefill.invoiceNumber, client: prefill.clientName }
    : invoices?.find((i) => i.id === invoiceId)

  const entered = Math.round((Number(amount) || 0) * 100)
  const outstanding = chosen?.outstandingCents ?? 0
  const surplus = entered - outstanding

  // Pick up the outstanding figure when the invoice changes, so the common case
  // — paid in full — needs no typing.
  useEffect(() => {
    if (prefill || !invoices) return
    const match = invoices.find((i) => i.id === invoiceId)
    if (match) setAmount(String(match.outstandingCents / 100))
  }, [invoiceId, invoices, prefill])

  if (!prefill && invoices?.length === 0) {
    return (
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>
        Every invoice is settled or void — there is nothing to record a payment against.
      </p>
    )
  }

  return (
    <form
      className="login"
      style={formStyle}
      onSubmit={(e) =>
        submit(
          e,
          () => createPayment({
            invoiceId,
            paidOn,
            amount: Number(amount),
            method,
            reference: reference.trim() || null,
          }),
          (r) => (r.ok && r.detail) || 'Payment recorded',
        )
      }
    >
      {prefill ? (
        <div className="ni-context" style={{ marginTop: 0 }}>
          <div><b>{prefill.invoiceNumber}</b> — {prefill.clientName}</div>
          <div>€{(prefill.outstandingCents / 100).toLocaleString('en-IE')} outstanding</div>
        </div>
      ) : (
        <>
          <label htmlFor="np-invoice">Invoice</label>
          <select
            id="np-invoice" value={invoiceId} required
            onChange={(e) => setInvoiceId(e.target.value)} style={selectStyle}
          >
            {invoices === null ? <option value="">Loading…</option> : null}
            {(invoices ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.number} — {i.client} — €{(i.outstandingCents / 100).toLocaleString('en-IE')} outstanding
              </option>
            ))}
          </select>
          <p style={hintStyle}>Only invoices with money still on them.</p>
        </>
      )}

      <label htmlFor="np-amount" style={{ marginTop: 14 }}>Amount received (€)</label>
      <input
        id="np-amount" type="number" required min={0} step="any" value={amount}
        onChange={(e) => setAmount(e.target.value)} style={{ width: '100%' }}
      />
      {entered > 0 && surplus < 0 ? (
        <p style={hintStyle}>
          Part payment — <b>€{(-surplus / 100).toLocaleString('en-IE')}</b> would remain outstanding.
        </p>
      ) : entered > 0 && surplus > 0 ? (
        <p style={{ ...hintStyle, color: 'var(--accent-600)' }}>
          <b>€{(surplus / 100).toLocaleString('en-IE')}</b> more than outstanding. The invoice will
          settle; the surplus is not tracked as a credit anywhere.
        </p>
      ) : (
        <p style={hintStyle}>Settles the invoice in full.</p>
      )}

      <label htmlFor="np-date" style={{ marginTop: 14 }}>Received on</label>
      <input
        id="np-date" type="date" required value={paidOn}
        onChange={(e) => setPaidOn(e.target.value)} style={selectStyle}
      />

      <label htmlFor="np-method" style={{ marginTop: 14 }}>Method</label>
      <select id="np-method" value={method} onChange={(e) => setMethod(e.target.value)} style={selectStyle}>
        {optionsFor('payments', 'method').map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <label htmlFor="np-ref" style={{ marginTop: 14 }}>Reference</label>
      <input
        id="np-ref" type="text" value={reference}
        onChange={(e) => setReference(e.target.value)}
        placeholder="Bank reference or transaction id" style={{ width: '100%' }}
      />

      <Error error={error} />
      <Submit pending={pending} label="Record payment" />
    </form>
  )
}

/* --------------------------------------------------------------------- parts */

function OwnerSelect({
  lookups, value, onChange,
}: {
  lookups: Lookups
  value: string
  onChange: (v: string) => void
}) {
  return (
    <>
      <label htmlFor="nr-owner" style={{ marginTop: 14 }}>Owner</label>
      <select
        id="nr-owner" value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}
      >
        <option value="">Me</option>
        {(lookups.team ?? []).map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </>
  )
}
