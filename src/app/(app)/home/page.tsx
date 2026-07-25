import Link from 'next/link'
import { Topbar } from '@/components/Topbar'
import { Icon } from '@/components/Icon'
import { Avatar } from '@/components/ui'
import { getDashboard, getDelivery } from '@/server/queries'
import { money, shortDate, tint } from '@/lib/format'
import { DEAL_STAGE_OPTIONS } from '@/lib/tables'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [d, delivery] = await Promise.all([getDashboard(), getDelivery()])
  const maxStage = Math.max(1, ...d.byStage.map((s) => s.valueCents))
  const HEALTH_COLOUR: Record<string, string> = { Green: '#0e9f6e', Amber: '#e0a020', Red: '#e2597a' }

  return (
    <>
      <Topbar title="Home" />
      <div className="content">
        <div className="dash">
          <h3>This quarter</h3>
          <div className="kpis">
            <Kpi
              icon="euro" label="Open pipeline" value={money(d.openPipelineCents)}
              detail={<><b className="up">{money(d.weightedCents)}</b> weighted · {d.openCount} deals</>}
            />
            <Kpi
              icon="target" label="Pipeline coverage"
              value={d.coverage !== null ? `${d.coverage.toFixed(1)}×` : '—'}
              detail={
                d.quarterTargetCents > 0
                  ? <>Against a <b>{money(d.quarterTargetCents)}</b> target{d.coverage !== null && d.coverage < 3 ? <> · <b className="down">below 3×</b></> : null}</>
                  : <>Set a company target to compute this</>
              }
            />
            <Kpi
              icon="check" label="Win rate"
              value={d.winRate !== null ? `${Math.round(d.winRate * 100)}%` : '—'}
              detail={<>{d.wonCount} won · {d.lostCount} lost</>}
            />
            <Kpi
              icon="bolt" label="Recurring revenue" value={`${money(d.mrrCents)}/mo`}
              detail={<>ARR <b>{money(d.mrrCents * 12)}</b> from closed-won deals</>}
            />
            <Kpi
              icon="users" label="Customers" value={String(d.customerCount)}
              detail={<>Accounts with lifecycle set to Customer</>}
            />
            <Kpi
              icon="warn" label="Needs attention" value={String(d.attention.length)}
              detail={<>Deals failing a hygiene check</>}
            />
            <Kpi
              icon="board" label="Delivery health"
              value={delivery.redCount > 0 ? `${delivery.redCount} red` : delivery.amberCount > 0 ? `${delivery.amberCount} amber` : 'All green'}
              detail={<>{delivery.projects.length} active projects · <b>{delivery.blockedTasks.length}</b> blocked</>}
            />
            <Kpi
              icon="users" label="Over capacity"
              value={String(delivery.overAllocated)}
              detail={delivery.overAllocated > 0
                ? <><b className="down">Planned above availability</b> this week</>
                : <>Everyone inside their hours this week</>}
            />
          </div>

          <h3>Pipeline</h3>
          <div className="panels">
            <div className="pnl">
              <div className="pnl-h">
                <span className="t">By stage</span>
                <Link className="a" href="/table/deals">Open pipeline →</Link>
              </div>
              <div className="pnl-b">
                <div className="funnel">
                  {d.byStage.map((s) => {
                    const option = DEAL_STAGE_OPTIONS.find((o) => o.value === s.stage)!
                    return (
                      <div className="fstage" key={s.stage}>
                        <span className="fn">{option.label}</span>
                        <span className="fb">
                          <i style={{ width: `${(s.valueCents / maxStage) * 100}%`, background: tint(option.color, 0.85) }} />
                        </span>
                        <span className="fv">{money(s.valueCents)}</span>
                        <span className="fc">{s.count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="pnl">
              <div className="pnl-h">
                <span className="t">Needs attention</span>
                <Link className="a" href="/table/deals">All deals →</Link>
              </div>
              <div className="pnl-b">
                {d.attention.length === 0 ? (
                  <p style={{ color: 'var(--ink-3)', fontSize: 12.5, margin: 0 }}>
                    Every open deal has a next step and is inside its stage limit. Rare and good.
                  </p>
                ) : (
                  d.attention.map((a) => (
                    <Link className="lrow" href={`/table/deals?record=${a.id}`} key={a.id}>
                      <span className="hdot" style={{ background: '#e0a020' }} />
                      <span className="lt">{a.name}</span>
                      <span className="ls">{a.flag}</span>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>

          <h3>Portfolio</h3>
          <div className="pnl">
            <div className="pnl-h">
              <span className="t">What each product earns, and what it costs to build</span>
              <Link className="a" href="/table/portfolio">Portfolio →</Link>
            </div>
            <div className="pnl-b">
              {delivery.portfolio.length === 0 ? (
                <p style={{ color: 'var(--ink-3)', fontSize: 12.5, margin: 0 }}>No products yet.</p>
              ) : (
                delivery.portfolio.map((p) => {
                  const scale = Math.max(1, ...delivery.portfolio.map((x) => Math.max(x.won, x.cost)))
                  return (
                    <div className="fstage" key={p.id} style={{ marginBottom: 10 }}>
                      <span className="fn" style={{ flexBasis: 120 }}>{p.name}</span>
                      <span className="fb" style={{ position: 'relative' }}>
                        <i style={{ width: `${(p.won / scale) * 100}%`, background: tint('#0e9f6e', 0.85) }} />
                        <i
                          style={{
                            width: `${(p.cost / scale) * 100}%`, background: tint('#e2597a', 0.8),
                            position: 'absolute', left: 0, top: 11, height: 11,
                          }}
                        />
                      </span>
                      <span className="fv" style={{ flexBasis: 106, color: p.contribution >= 0 ? 'var(--brand)' : '#e2597a' }}>
                        {money(p.contribution)}
                      </span>
                      <span className="fc" style={{ flexBasis: 70 }}>{p.openTasks} open</span>
                    </div>
                  )
                })
              )}
              <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '12px 0 0', lineHeight: 1.6 }}>
                Upper bar is closed-won value, lower bar is delivery cost from logged time. The figure on the
                right is contribution — what the product has earned less what it cost us to build.
              </p>
            </div>
          </div>

          <h3>Delivery</h3>
          <div className="panels">
            <div className="pnl">
              <div className="pnl-h">
                <span className="t">Project health</span>
                <Link className="a" href="/table/projects">Delivery board →</Link>
              </div>
              <div className="pnl-b">
                {delivery.projects.length === 0 ? (
                  <p style={{ color: 'var(--ink-3)', fontSize: 12.5, margin: 0 }}>
                    No active projects. Closing a Project or Hybrid deal creates one automatically.
                  </p>
                ) : (
                  delivery.projects.map((p) => (
                    <Link className="lrow" href={`/table/projects?record=${p.id}`} key={p.id}>
                      <span className="hdot" style={{ background: HEALTH_COLOUR[p.health] }} />
                      <span className="lt">{p.name}</span>
                      {p.warning ? <span className="flag">{p.warning}</span> : null}
                      <span style={{ width: 78 }}>
                        <span className="bar-wrap">
                          <span className="bar">
                            <i style={{ width: `${p.percentComplete * 100}%`, background: '#0e9f6e' }} />
                          </span>
                          <span className="pctn">{Math.round(p.percentComplete * 100)}%</span>
                        </span>
                      </span>
                      <span className="ls">{shortDate(p.targetLaunch)}</span>
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="pnl">
              <div className="pnl-h">
                <span className="t">Capacity this week</span>
                <Link className="a" href="/table/allocations">Allocations →</Link>
              </div>
              <div className="pnl-b">
                {delivery.capacity.map((c) => {
                  const load = (c.loadBps ?? 0) / 10_000
                  const colour = load > 1 ? '#e2597a' : load > 0.85 ? '#e0a020' : '#0e9f6e'
                  return (
                    <div className="fstage" key={c.id} style={{ marginBottom: 8 }}>
                      <span className="fn" style={{ flexBasis: 130 }}>{c.name}</span>
                      <span className="fb">
                        <i style={{ width: `${Math.min(load, 1.4) / 1.4 * 100}%`, background: colour }} />
                      </span>
                      <span className="fv" style={{ flexBasis: 58 }}>{Math.round(load * 100)}%</span>
                      <span className="fc" style={{ flexBasis: 60 }}>
                        {c.away > 0 ? `${c.away}d off` : ''}
                      </span>
                    </div>
                  )
                })}
                <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '12px 0 0', lineHeight: 1.6 }}>
                  Planned hours against hours available, net of approved leave. Anything over 100% is a
                  promise somebody is going to have to break.
                </p>
              </div>
            </div>
          </div>

          {delivery.blockedTasks.length > 0 || delivery.risks.length > 0 ? (
            <div className="panels" style={{ marginTop: 13 }}>
              <div className="pnl">
                <div className="pnl-h">
                  <span className="t">Blocked work</span>
                  <Link className="a" href="/table/tasks">Board →</Link>
                </div>
                <div className="pnl-b">
                  {delivery.blockedTasks.length === 0 ? (
                    <p style={{ color: 'var(--ink-3)', fontSize: 12.5, margin: 0 }}>Nothing blocked.</p>
                  ) : (
                    delivery.blockedTasks.map((task) => (
                      <Link className="lrow" href={`/table/tasks?record=${task.id}`} key={task.id}>
                        <span className="hdot" style={{ background: '#e2597a' }} />
                        <span className="lt">{task.title}</span>
                        <span className="ls">{task.blockedReason ?? 'Blocked'}</span>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              <div className="pnl">
                <div className="pnl-h">
                  <span className="t">Open risks</span>
                  <Link className="a" href="/table/risks">Register →</Link>
                </div>
                <div className="pnl-b">
                  {delivery.risks.length === 0 ? (
                    <p style={{ color: 'var(--ink-3)', fontSize: 12.5, margin: 0 }}>Register is clear.</p>
                  ) : (
                    delivery.risks.map((r) => (
                      <Link className="lrow" href={`/table/risks?record=${r.id}`} key={r.id}>
                        <span
                          className="hdot"
                          style={{ background: r.severity >= 6 ? '#e2597a' : r.severity >= 4 ? '#e0a020' : '#94a3b8' }}
                        />
                        <span className="lt">{r.title}</span>
                        <span className="ls">{r.project} · severity {r.severity}</span>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <h3>Recent activity</h3>
          <div className="pnl">
            <div className="pnl-b">
              {d.recent.length === 0 ? (
                <p style={{ color: 'var(--ink-3)', fontSize: 12.5, margin: 0 }}>Nothing logged yet.</p>
              ) : (
                d.recent.map((a) => (
                  <Link className="lrow" href={`/table/activities?record=${a.id}`} key={a.id}>
                    <Avatar name={a.owner} size={24} />
                    <span className="lt">{a.subject}</span>
                    <span className="ls">{a.org ? `${a.org} · ` : ''}{shortDate(a.date)}</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function Kpi({
  icon, label, value, detail,
}: {
  icon: string
  label: string
  value: string
  detail: React.ReactNode
}) {
  return (
    <div className="kpi">
      <div className="l"><Icon name={icon} size={13} />{label}</div>
      <div className="v">{value}</div>
      <div className="d">{detail}</div>
    </div>
  )
}
