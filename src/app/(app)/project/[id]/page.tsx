import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Topbar } from '@/components/Topbar'
import { Icon } from '@/components/Icon'
import { getProject } from '@/server/queries'
import { money, shortDate } from '@/lib/format'
import { HEALTH_COLOUR } from '@/lib/brand'
import { MILESTONE_STATUS_COLOUR } from '@/lib/tables'
import { RaiseInvoiceButton } from '@/components/RaiseInvoiceButton'
import { RecordPaymentButton } from '@/components/RecordPaymentButton'

export const dynamic = 'force-dynamic'

const hours = (minutes: number) => `${Math.round(minutes / 60)}h`
const pct = (bps: number | null) => (bps === null ? '—' : `${Math.round(bps / 100)}%`)

/**
 * One project, end to end: who it is for, what it earns, what it has cost, how
 * far along it is and what is in the way.
 *
 * Every figure here already existed somewhere — the point of the page is that
 * they were in four different grids, so nobody could answer "is Nordwind
 * actually going well" without opening all four.
 */
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const p = await getProject(id)
  if (!p) notFound()

  const { money: m, rollup } = p
  const behind = rollup.slipDays !== null && rollup.slipDays > 0

  return (
    <>
      <Topbar
        crumbs={[{ label: 'Delivery', color: '#d97757', abbr: 'D', icon: 'board' }]}
        title={p.name}
      />
      <div className="content">
        <div className="dash">
          {/* ------------------------------------------------------ header */}
          <div className="pj-head">
            <span className="hdot" style={{ background: HEALTH_COLOUR[p.health] ?? 'var(--ink-3)', width: 10, height: 10 }} />
            <span className="pj-status">{p.status}</span>
            {p.client ? (
              <Link className="pj-link" href={`/table/clients?record=${p.client.id}`}>
                <Icon name="users" size={13} />{p.client.name}
              </Link>
            ) : null}
            {p.deal ? (
              <Link className="pj-link" href={`/table/deals?record=${p.deal.id}`}>
                <Icon name="euro" size={13} />{p.deal.name}
              </Link>
            ) : null}
            {p.product ? (
              <span className="pj-link" style={{ color: p.product.color }}>
                <Icon name="bolt" size={13} />{p.product.name}
              </span>
            ) : null}
            {p.pm ? <span className="pj-meta">PM {p.pm}</span> : null}
          </div>

          {p.healthNote ? (
            <p className="pj-note" style={{ borderColor: HEALTH_COLOUR[p.health] ?? 'var(--line)' }}>
              {p.healthNote}
            </p>
          ) : null}

          {/* ------------------------------------------------------- money */}
          <h3>Money</h3>
          <div className="kpis">
            <Kpi label="Contract value" value={money(m.contractValueCents)}
              detail={m.uninvoicedCents > 0
                ? <><b>{money(m.uninvoicedCents)}</b> not yet billed</>
                : m.uninvoicedCents < 0
                  ? <><b className="down">{money(-m.uninvoicedCents)}</b> billed above contract</>
                  : <>Fully billed</>} />

            <Kpi label="Collected" value={money(m.collectedCents)}
              detail={<>of <b>{money(m.invoicedCents)}</b> invoiced</>} />

            <Kpi label="Outstanding" value={money(m.outstandingCents)}
              detail={m.overdueCents > 0
                ? <><b className="down">{money(m.overdueCents)}</b> overdue</>
                : <>Nothing past due</>} />

            {p.unbilledDeliveredCents > 0 ? (
              <Kpi label="Delivered, unbilled" value={money(p.unbilledDeliveredCents)}
                detail={<><b className="down">Accepted work</b> with no invoice raised</>} />
            ) : null}

            {p.showCost ? (
              <>
                <Kpi label="Internal cost" value={money(m.internalCostCents)}
                  detail={p.unbilledMinutes > 0
                    ? <>{hours(rollup.loggedMinutes)} logged · <b>{hours(p.unbilledMinutes)}</b> not on any invoice</>
                    : <>{hours(rollup.loggedMinutes)} logged at snapshotted rates</>} />
                <Kpi label="Margin — contracted" value={pct(m.contractedMarginBps)}
                  detail={rollup.burnBps !== null && rollup.burnBps < 8_000
                    ? <>Against cost <b>so far</b> — {pct(rollup.burnBps)} of budget spent</>
                    : <>On what was sold</>} />
                <Kpi label="Margin — collected" value={pct(m.collectedMarginBps)}
                  detail={m.collectedMarginBps === null
                    ? <>Nothing collected yet</>
                    : <>On money actually received</>} />
              </>
            ) : null}
          </div>

          {p.showCost && m.contractedMarginBps !== null && m.collectedMarginBps === null ? (
            <p className="pj-warn">
              This project is profitable on paper and has collected nothing. Contracted margin is a
              forecast until the invoices are paid.
            </p>
          ) : null}

          {/* ---------------------------------------------------- delivery */}
          <h3>Delivery</h3>
          <div className="kpis">
            <Kpi label="Complete" value={pct(rollup.percentCompleteBps)}
              detail={<>Weighted across {p.milestones.length} milestones</>} />
            <Kpi label="Budget burn" value={rollup.burnBps === null ? '—' : pct(rollup.burnBps)}
              detail={rollup.burnBps === null
                ? <>No budget set</>
                : <>{hours(rollup.loggedMinutes)} of {hours(p.budgetMinutes)}</>} />
            <Kpi label="Launch" value={p.actualLaunch ? shortDate(p.actualLaunch) : p.targetLaunch ? shortDate(p.targetLaunch) : '—'}
              detail={rollup.slipDays === null
                ? <>No baseline set</>
                : behind
                  ? <><b className="down">{rollup.slipDays} days</b> behind baseline</>
                  : <>On or ahead of baseline</>} />
            <Kpi label="Open work" value={String(p.openTasks)}
              detail={p.blockedTasks.length > 0
                ? <><b className="down">{p.blockedTasks.length} blocked</b></>
                : <>Nothing blocked</>} />
          </div>

          {/* -------------------------------------------- milestones + AR */}
          <div className="panels">
            <div className="pnl">
              <div className="pnl-h">
                <span className="t">Milestones</span>
                <Link className="a" href="/table/milestones">All milestones →</Link>
              </div>
              <div className="pnl-b">
                {p.milestones.length === 0 ? (
                  <Empty>No milestones. Percent complete cannot be computed without them.</Empty>
                ) : (
                  p.milestones.map((ms) => (
                    <div className="lrow" key={ms.id}>
                      <span className="hdot" style={{ background: MILESTONE_STATUS_COLOUR[ms.status] ?? 'var(--ink-3)' }} />
                      <span className="lt">{ms.name}</span>
                      <span className="ls">
                        {Math.round(ms.weightBps / 100)}%
                        {ms.dueDate ? ` · ${shortDate(ms.dueDate)}` : ''}
                        {ms.paymentTrigger && ms.invoice ? ` · ${ms.invoice.number}` : ''}
                        {ms.paymentTrigger && !ms.invoice && !ms.unbilled
                          ? ` · ${money(ms.invoiceAmountCents)} on completion`
                          : ''}
                      </span>
                      {ms.unbilled ? (
                        <>
                          <span className="pj-unbilled">{money(ms.invoiceAmountCents)} unbilled</span>
                          {p.client ? (
                            <RaiseInvoiceButton
                              prefill={{
                                kind: 'invoice',
                                organizationId: p.client.id,
                                organizationName: p.client.name,
                                projectId: p.id,
                                projectName: p.name,
                                milestoneId: ms.id,
                                milestoneName: ms.name,
                                amountCents: ms.invoiceAmountCents,
                              }}
                            />
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ))
                )}
                <p className="pj-foot">
                  Payment milestones show what they trigger. Flagged in amber once the work is accepted
                  and no invoice has been raised against it.
                </p>
              </div>
            </div>

            <div className="pnl">
              <div className="pnl-h">
                <span className="t">Invoices</span>
                <Link className="a" href="/table/invoices">All invoices →</Link>
              </div>
              <div className="pnl-b">
                {p.invoices.length === 0 ? (
                  <Empty>Nothing invoiced against this project yet.</Empty>
                ) : (
                  p.invoices.map((i) => (
                    <Link className="lrow" href={`/table/invoices?record=${i.id}`} key={i.id}>
                      <span className="hdot" style={{
                        background: i.state === 'Overdue' ? 'var(--danger)'
                          : i.state === 'Paid' ? 'var(--brand)'
                          : i.state === 'Draft' ? 'var(--ink-3)' : 'var(--accent)',
                      }} />
                      <span className="lt">{i.number}</span>
                      <span className="ls">
                        {money(i.totalCents)} · {i.state}
                        {i.daysOverdue > 0 ? ` · ${i.daysOverdue} days` : ''}
                      </span>
                      {i.outstandingCents > 0 && i.state !== 'Draft' && p.client ? (
                        <RecordPaymentButton
                          prefill={{
                            kind: 'payment',
                            invoiceId: i.id,
                            invoiceNumber: i.number,
                            clientName: p.client.name,
                            outstandingCents: i.outstandingCents,
                          }}
                          label="Paid"
                        />
                      ) : null}
                    </Link>
                  ))
                )}
                {p.subscription ? (
                  <p className="pj-foot">
                    This client is also on a plan: <b>{money(p.subscription.mrrCents)}/mo</b>,
                    renewing {shortDate(p.subscription.renewsOn)}.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* ------------------------------------------- team, risks, blocks */}
          <div className="panels">
            <div className="pnl">
              <div className="pnl-h"><span className="t">Who has worked on it</span></div>
              <div className="pnl-b">
                {p.team.length === 0 ? (
                  <Empty>No time logged against this project.</Empty>
                ) : (
                  p.team.map((person) => {
                    const widest = Math.max(...p.team.map((x) => x.minutes))
                    return (
                      <div className="fstage" key={person.name}>
                        <span className="fn" style={{ flexBasis: 130 }}>{person.name}</span>
                        <span className="fb">
                          <i style={{ width: `${(person.minutes / widest) * 100}%`, background: 'var(--brand-soft)' }} />
                        </span>
                        <span className="fv" style={{ flexBasis: 70 }}>{hours(person.minutes)}</span>
                        <span className="fc" style={{ flexBasis: 84 }}>{hours(person.billableMinutes)} billable</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="pnl">
              <div className="pnl-h">
                <span className="t">In the way</span>
                <Link className="a" href="/table/risks">Register →</Link>
              </div>
              <div className="pnl-b">
                {p.risks.length === 0 && p.blockedTasks.length === 0 ? (
                  <Empty>No open risks and nothing blocked.</Empty>
                ) : (
                  <>
                    {p.risks.map((r) => (
                      <Link className="lrow" href={`/table/risks?record=${r.id}`} key={r.id}>
                        <span className="hdot" style={{
                          background: r.severity >= 6 ? 'var(--danger)' : r.severity >= 4 ? 'var(--accent)' : 'var(--ink-3)',
                        }} />
                        <span className="lt">{r.title}</span>
                        <span className="ls">{r.category}{r.owner ? ` · ${r.owner}` : ''}</span>
                      </Link>
                    ))}
                    {p.blockedTasks.map((task) => (
                      <Link className="lrow" href={`/table/tasks?record=${task.id}`} key={task.id}>
                        <span className="hdot" style={{ background: 'var(--accent)' }} />
                        <span className="lt">{task.title}</span>
                        <span className="ls">{task.reason ?? 'Blocked'}</span>
                      </Link>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          {p.changeRequests.length > 0 ? (
            <>
              <h3>Change requests</h3>
              <div className="pnl">
                <div className="pnl-b">
                  {p.changeRequests.map((c) => (
                    <Link className="lrow" href={`/table/changeRequests?record=${c.id}`} key={c.id}>
                      <span className="hdot" style={{ background: c.status === 'Approved' ? 'var(--brand)' : 'var(--accent)' }} />
                      <span className="lt">{c.title}</span>
                      <span className="ls">
                        {c.status}
                        {c.impactCostCents > 0 ? ` · ${money(c.impactCostCents)}` : ''}
                        {c.impactDays > 0 ? ` · +${c.impactDays} days` : ''}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {p.scopeSummary ? (
            <>
              <h3>Scope</h3>
              <div className="pnl"><div className="pnl-b"><p className="pj-scope">{p.scopeSummary}</p></div></div>
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: React.ReactNode }) {
  return (
    <div className="kpi">
      <div className="l">{label}</div>
      <div className="v">{value}</div>
      <div className="d">{detail}</div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ color: 'var(--ink-3)', fontSize: 12.5, margin: 0 }}>{children}</p>
}
