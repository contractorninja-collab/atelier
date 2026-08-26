import Link from 'next/link'
import { auth } from '@/auth'
import { Topbar } from '@/components/Topbar'
import { getMyWork } from '@/server/queries'
import { money, shortDate, tint } from '@/lib/format'
import { DEAL_STAGE_OPTIONS, HEALTH, MILESTONE_STATUS, PROJECT_STATUS, TASK_STATUS } from '@/lib/tables'

export const dynamic = 'force-dynamic'

export default async function MyWorkPage() {
  const session = await auth()
  const work = await getMyWork(session?.user.memberId ?? null)

  return (
    <>
      <Topbar title="My work" />
      <div className="content">
        <div className="dash">
          <h3>My open deals</h3>
          <div className="pnl">
            <div className="pnl-b">
              {work.deals.length === 0 ? (
                <p style={{ color: 'var(--ink-3)', fontSize: 12.5, margin: 0 }}>
                  Nothing assigned to you yet. Deals show here once you are set as the owner.
                </p>
              ) : (
                work.deals.map((deal) => {
                  const option = DEAL_STAGE_OPTIONS.find((o) => o.value === deal.stage)
                  return (
                    <Link prefetch={false} className="lrow" href={`/table/deals?record=${deal.id}`} key={deal.id}>
                      {option ? (
                        <span className="pill" style={{ background: tint(option.color, 0.15), color: option.color }}>
                          {option.label}
                        </span>
                      ) : null}
                      <span className="lt">{deal.name}</span>
                      {deal.flag ? <span className="flag">{deal.flag}</span> : null}
                      <span className="ls">
                        {money(deal.valueCents)}
                        {deal.closeDate ? ` · ${shortDate(deal.closeDate)}` : ''}
                      </span>
                    </Link>
                  )
                })
              )}
            </div>
          </div>

          <h3>Assigned to me</h3>
          <div className="pnl">
            <div className="pnl-b">
              {work.tasks.length === 0 ? (
                <p style={{ color: 'var(--ink-3)', fontSize: 12.5, margin: 0 }}>
                  No open tasks assigned to you. Set yourself as the assignee on a task in
                  Portfolio → Tasks and it appears here.
                </p>
              ) : (
                work.tasks.map((task) => {
                  const status = TASK_STATUS.find((o) => o.value === task.status)
                  return (
                    <Link prefetch={false} className="lrow" href={`/table/tasks?record=${task.id}`} key={task.id}>
                      {status ? (
                        <span className="pill" style={{ background: tint(status.color, 0.15), color: status.color }}>
                          {status.label}
                        </span>
                      ) : null}
                      <span className="lt">{task.title}</span>
                      {/* Blocked is the one thing worth interrupting the row for:
                          it means the next move is somebody else's. */}
                      {task.blocked ? (
                        <span className="flag" title={task.blockedReason ?? undefined}>Blocked</span>
                      ) : null}
                      <span className="ls" style={task.overdue ? { color: 'var(--danger)' } : undefined}>
                        {task.project ? `${task.project} · ` : ''}
                        {task.priority}
                        {task.dueDate ? ` · ${task.overdue ? 'overdue ' : ''}${shortDate(task.dueDate)}` : ''}
                      </span>
                    </Link>
                  )
                })
              )}
            </div>
          </div>

          <h3>My milestones</h3>
          <div className="pnl">
            <div className="pnl-b">
              {work.milestones.length === 0 ? (
                <p style={{ color: 'var(--ink-3)', fontSize: 12.5, margin: 0 }}>
                  No open milestones you own. Accepted and cancelled ones drop off this list.
                </p>
              ) : (
                work.milestones.map((m) => {
                  const status = MILESTONE_STATUS.find((o) => o.value === m.status)
                  return (
                    <Link prefetch={false} className="lrow" href={`/table/milestones?record=${m.id}`} key={m.id}>
                      {status ? (
                        <span className="pill" style={{ background: tint(status.color, 0.15), color: status.color }}>
                          {status.label}
                        </span>
                      ) : null}
                      <span className="lt">{m.name}</span>
                      {/* Slip is against the baseline, so it survives the date
                          being moved — which is exactly when it matters. */}
                      {m.slipDays > 0 ? <span className="flag">{m.slipDays}d late vs baseline</span> : null}
                      {m.signOffRequired ? <span className="flag">Client sign-off</span> : null}
                      <span className="ls" style={m.overdue ? { color: 'var(--danger)' } : undefined}>
                        {m.project ? `${m.project} · ` : ''}
                        {m.dueDate ? `${m.overdue ? 'overdue ' : 'due '}${shortDate(m.dueDate)}` : 'no date'}
                      </span>
                    </Link>
                  )
                })
              )}
            </div>
          </div>

          <h3>Projects I run</h3>
          <div className="pnl">
            <div className="pnl-b">
              {work.projects.length === 0 ? (
                <p style={{ color: 'var(--ink-3)', fontSize: 12.5, margin: 0 }}>
                  You are not the PM on any open project.
                </p>
              ) : (
                work.projects.map((p) => {
                  const status = PROJECT_STATUS.find((o) => o.value === p.status)
                  const health = HEALTH.find((o) => o.value === p.health)
                  return (
                    <Link prefetch={false} className="lrow" href={`/project/${p.id}`} key={p.id}>
                      {health ? (
                        <span className="pill" style={{ background: tint(health.color, 0.15), color: health.color }}>
                          {health.label}
                        </span>
                      ) : null}
                      <span className="lt">{p.name}</span>
                      {p.slipDays > 0 ? <span className="flag">{p.slipDays}d slip</span> : null}
                      <span className="ls" style={p.late ? { color: 'var(--danger)' } : undefined}>
                        {p.client ? `${p.client} · ` : ''}
                        {status?.label ?? p.status}
                        {p.targetLaunch ? ` · ${p.late ? 'was due ' : 'launch '}${shortDate(p.targetLaunch)}` : ''}
                      </span>
                    </Link>
                  )
                })
              )}
            </div>
          </div>

          <h3>My recent activity</h3>
          <div className="pnl">
            <div className="pnl-b">
              {work.activities.length === 0 ? (
                <p style={{ color: 'var(--ink-3)', fontSize: 12.5, margin: 0 }}>No activity logged yet.</p>
              ) : (
                work.activities.map((a) => (
                  <Link prefetch={false} className="lrow" href={`/table/activities?record=${a.id}`} key={a.id}>
                    <span className="lt">{a.subject}</span>
                    <span className="ls">
                      {a.org ? `${a.org} · ` : ''}
                      {shortDate(a.date)}
                      {a.nextStepDue ? ` · next ${shortDate(a.nextStepDue)}` : ''}
                    </span>
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
