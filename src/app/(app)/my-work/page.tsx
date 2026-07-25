import Link from 'next/link'
import { auth } from '@/auth'
import { Topbar } from '@/components/Topbar'
import { getMyWork } from '@/server/queries'
import { money, shortDate, tint } from '@/lib/format'
import { DEAL_STAGE_OPTIONS } from '@/lib/tables'

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
                    <Link className="lrow" href={`/table/deals?record=${deal.id}`} key={deal.id}>
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

          <h3>My recent activity</h3>
          <div className="pnl">
            <div className="pnl-b">
              {work.activities.length === 0 ? (
                <p style={{ color: 'var(--ink-3)', fontSize: 12.5, margin: 0 }}>No activity logged yet.</p>
              ) : (
                work.activities.map((a) => (
                  <Link className="lrow" href={`/table/activities?record=${a.id}`} key={a.id}>
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
