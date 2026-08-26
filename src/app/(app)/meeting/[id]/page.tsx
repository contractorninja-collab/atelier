import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Topbar } from '@/components/Topbar'
import { getMeeting } from '@/server/queries'
import { tint } from '@/lib/format'
import { MEETING_STATUS, ROCK_STATUS } from '@/lib/tables'
import {
  ConcludeForm, DropToIssuesButton, HeadlinesEditor, MeetingIssues, MeetingTodos,
  StartMeetingButton, TodoCompletionBadge,
} from '@/components/MeetingRoom'

export const dynamic = 'force-dynamic'

/**
 * The meeting, run from one page in agenda order.
 *
 * The page walks the agenda for the meeting's type and lights up the segments
 * it knows how to run — the scorecard matrix, the rock review, to-dos, IDS,
 * conclude. A segment it does not recognise renders its hint as an instruction
 * card, which is how the Quarterly and Annual agendas mostly work: the room
 * does the talking, the page keeps the order and the clock honest.
 */
export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const m = await getMeeting(id)
  if (!m) notFound()

  const { meeting } = m
  const status = MEETING_STATUS.find((o) => o.value === meeting.status)
  const concluded = meeting.status === 'Concluded'
  const monthDay = (isoDate: string) => isoDate.slice(5)

  return (
    <>
      <Topbar
        crumbs={[{ label: 'Traction', color: '#c2415f', abbr: 'E', icon: 'compass' }]}
        title={`${meeting.type} · ${meeting.heldOn}`}
      />
      <div className="content">
        <div className="dash">
          {/* ------------------------------------------------------ header */}
          <div className="pj-head">
            {status ? (
              <span className="pill" style={{ background: tint(status.color, 0.15), color: status.color }}>
                {status.label}
              </span>
            ) : null}
            {meeting.owner ? <span className="pj-meta">Run by {meeting.owner.name}</span> : null}
            {meeting.durationMinutes ? (
              <span className="pj-meta">{Math.round(meeting.durationMinutes / 60 * 10) / 10}h planned</span>
            ) : null}
            {m.averageRating !== null ? (
              <span className="pj-meta">last 10 average {m.averageRating}/10</span>
            ) : null}
            <span style={{ marginLeft: 'auto' }}>
              {meeting.status === 'Scheduled' ? <StartMeetingButton id={meeting.id} /> : null}
              {concluded ? <span className="mtg-bar ok">Rated {meeting.rating}/10</span> : null}
            </span>
          </div>

          {concluded ? (
            <div className="pnl">
              <div className="pnl-b">
                {meeting.headlines ? <p className="mtg-recap"><strong>Headlines.</strong> {meeting.headlines}</p> : null}
                {meeting.cascadingMessages ? (
                  <p className="mtg-recap"><strong>Cascading messages.</strong> {meeting.cascadingMessages}</p>
                ) : null}
                {!meeting.headlines && !meeting.cascadingMessages ? (
                  <p className="mtg-hint">Concluded without recorded headlines or cascading messages.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* ------------------------------------------------------ agenda */}
          {m.agenda.map((segment, index) => (
            <section key={segment.id} className="mtg-seg">
              <h3>
                <span className="mtg-n">{index + 1}</span>
                {segment.name}
                <span className="mtg-min">{segment.minutes} min</span>
              </h3>

              {segment.id === 'scorecard' && m.scorecard.length > 0 ? (
                <div className="pnl">
                  <div className="pnl-b" style={{ overflowX: 'auto' }}>
                    <table className="sc-matrix">
                      <thead>
                        <tr>
                          <th className="sc-name">Measurable</th>
                          <th>Goal</th>
                          {m.weeks.map((w) => <th key={w}>{monthDay(w)}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {m.scorecard.map((row) => (
                          <tr key={row.id}>
                            <td className="sc-name">
                              {row.name}
                              {row.offTrack ? <div style={{ marginTop: 4 }}><DropToIssuesButton title={`Scorecard: ${row.name} off track`} /></div> : null}
                            </td>
                            <td className="sc-goal">
                              {row.direction === 'AtMost' ? '≤ ' : '≥ '}{row.goalDisplay}
                            </td>
                            {row.cells.map((cell) => (
                              <td key={cell.week} className={cell.onTrack === false ? 'sc-miss' : cell.onTrack ? 'sc-hit' : 'sc-empty'}>
                                {cell.display || '·'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : segment.id === 'rocks' && m.rocks.length > 0 ? (
                <div className="pnl">
                  <div className="pnl-b">
                    {m.rocks.map((rock) => {
                      const rs = ROCK_STATUS.find((o) => o.value === rock.status)
                      return (
                        <div className="lrow" key={rock.id} style={{ cursor: 'default' }}>
                          {rs ? (
                            <Link
                              className="pill" href={`/table/rocks?record=${rock.id}`}
                              style={{ background: tint(rs.color, 0.15), color: rs.color }}
                            >
                              {rs.label}
                            </Link>
                          ) : null}
                          <span className="lt">{rock.title}</span>
                          {rock.status === 'OffTrack' ? <DropToIssuesButton title={`Rock off track: ${rock.title}`} /> : null}
                          <span className="ls">
                            {rock.scope === 'Company' ? 'Company · ' : ''}
                            {rock.owner?.name ?? 'Unowned'}
                            {rock.dueDate ? ` · ${rock.dueDate}` : ''}
                          </span>
                        </div>
                      )
                    })}
                    {m.rockCompletionBps !== null ? (
                      <p className="mtg-hint" style={{ marginTop: 8 }}>
                        {Math.round(m.rockCompletionBps / 100)}% of this quarter&apos;s rocks are done.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : segment.id === 'headlines' && !concluded ? (
                <div className="pnl"><div className="pnl-b">
                  <HeadlinesEditor id={meeting.id} initial={meeting.headlines} />
                </div></div>
              ) : segment.id === 'todos' ? (
                <div className="pnl"><div className="pnl-b">
                  <p style={{ margin: '0 0 10px' }}><TodoCompletionBadge bps={m.todos.completionBps} /></p>
                  <MeetingTodos meetingId={meeting.id} todos={m.todos.open} team={m.team} />
                </div></div>
              ) : segment.id === 'ids' ? (
                <div className="pnl"><div className="pnl-b">
                  <MeetingIssues meetingId={meeting.id} issues={m.issues.open} />
                  {m.issues.solvedHere.length > 0 ? (
                    <p className="mtg-hint" style={{ marginTop: 10 }}>
                      Solved here: {m.issues.solvedHere.map((issue) => issue.title).join(' · ')}
                    </p>
                  ) : null}
                </div></div>
              ) : segment.id === 'conclude' && meeting.status === 'InProgress' ? (
                <div className="pnl"><div className="pnl-b">
                  <ConcludeForm id={meeting.id} openTodoCount={m.todos.open.length} />
                </div></div>
              ) : (
                <p className="mtg-hint">{segment.hint}</p>
              )}
            </section>
          ))}
        </div>
      </div>
    </>
  )
}
