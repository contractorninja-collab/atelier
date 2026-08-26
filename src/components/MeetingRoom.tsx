'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { concludeMeeting, createRecord, resolveIssue, startMeeting, updateCell } from '@/server/actions'
import { TODO_COMPLETION_BAR_BPS } from '@/server/compute'

/**
 * The interactive half of the meeting page.
 *
 * Everything here follows the RenewButton plumbing — useTransition, the server
 * action, then router.refresh() so the server component re-renders with the
 * new state. Errors surface inline beside whatever was clicked: in a running
 * meeting a toast in the corner is where messages go to be missed.
 */

function useAction() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) setError(result.error ?? 'Something went wrong')
      else router.refresh()
    })
  }

  return { pending, error, run }
}

/* ------------------------------------------------------------------- start */

export function StartMeetingButton({ id }: { id: string }) {
  const { pending, error, run } = useAction()
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <button className="btn pri" disabled={pending} onClick={() => run(() => startMeeting({ id }))}>
        {pending ? 'Starting…' : 'Start meeting'}
      </button>
      {error ? <span className="mtg-err">{error}</span> : null}
    </span>
  )
}

/* ---------------------------------------------------------------- conclude */

export function ConcludeForm({ id, openTodoCount }: { id: string; openTodoCount: number }) {
  const { pending, error, run } = useAction()
  const [rating, setRating] = useState('')
  const [messages, setMessages] = useState('')

  return (
    <form
      className="mtg-conclude"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => concludeMeeting({ id, rating: Number(rating), cascadingMessages: messages || undefined }))
      }}
    >
      <p className="mtg-hint">
        {openTodoCount === 0
          ? 'Every to-do is closed.'
          : `${openTodoCount} to-do${openTodoCount === 1 ? '' : 's'} still open — they carry to next week.`}
      </p>
      <label htmlFor="mtg-messages">Cascading messages</label>
      <textarea
        id="mtg-messages" rows={2} value={messages}
        onChange={(e) => setMessages(e.target.value)}
        placeholder="What does everyone outside this room need to hear?"
      />
      <div className="mtg-rate">
        <label htmlFor="mtg-rating">Rate it (1–10)</label>
        <input
          id="mtg-rating" type="number" min={1} max={10} step={1} required
          value={rating} onChange={(e) => setRating(e.target.value)}
        />
        <button className="btn pri" type="submit" disabled={pending || rating === ''}>
          {pending ? 'Concluding…' : 'Conclude meeting'}
        </button>
      </div>
      {error ? <p className="mtg-err">{error}</p> : null}
    </form>
  )
}

/* --------------------------------------------------------------- headlines */

/**
 * Persists on blur through the ordinary cell write — headlines is a writable
 * field, so the grid, the record panel and this box all agree on the rules.
 */
export function HeadlinesEditor({ id, initial }: { id: string; initial: string | null }) {
  const { pending, error, run } = useAction()
  const [text, setText] = useState(initial ?? '')

  return (
    <div>
      <textarea
        className="mtg-headlines" rows={3} value={text}
        placeholder="Customer and employee headlines — one sentence each."
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text !== (initial ?? '')) {
            run(() => updateCell({ table: 'meetings', id, field: 'headlines', value: text || null }))
          }
        }}
      />
      <p className="mtg-hint">{pending ? 'Saving…' : 'Saved when you click away.'}</p>
      {error ? <p className="mtg-err">{error}</p> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ to-dos */

type Person = { id: string; name: string }

export function MeetingTodos({
  meetingId, todos, team,
}: {
  meetingId: string
  todos: { id: string; title: string; dueDate: string; overdue: boolean; owner: Person | null }[]
  team: Person[]
}) {
  const { pending, error, run } = useAction()
  const [title, setTitle] = useState('')
  const [ownerId, setOwnerId] = useState(team[0]?.id ?? '')

  return (
    <div>
      {todos.length === 0 ? <p className="mtg-hint">Nothing open. Either a great week or a quiet list.</p> : null}
      {todos.map((todo) => (
        <label key={todo.id} className="mtg-todo">
          <input
            type="checkbox"
            disabled={pending}
            checked={false}
            onChange={() => run(() => updateCell({ table: 'todos', id: todo.id, field: 'done', value: true }))}
          />
          <span className="mtg-todo-t">{todo.title}</span>
          {todo.owner ? <span className="mtg-who">{todo.owner.name}</span> : null}
          <span className={`mtg-due ${todo.overdue ? 'late' : ''}`}>
            {todo.overdue ? 'overdue ' : ''}{todo.dueDate}
          </span>
        </label>
      ))}

      <form
        className="mtg-add"
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim()) return
          run(() => createRecord({ table: 'todos', values: { title, ownerId, meetingId } }))
          setTitle('')
        }}
      >
        <input
          type="text" value={title} placeholder="New to-do — due in 7 days"
          onChange={(e) => setTitle(e.target.value)}
        />
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
          {team.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button className="btn out sm" type="submit" disabled={pending || !title.trim()}>Add</button>
      </form>
      {error ? <p className="mtg-err">{error}</p> : null}
    </div>
  )
}

/** The 90% bar, said as a sentence rather than a gauge. */
export function TodoCompletionBadge({ bps }: { bps: number | null }) {
  if (bps === null) return <span className="mtg-hint">Nothing was due yet.</span>
  const pct = Math.round(bps / 100)
  const onBar = bps >= TODO_COMPLETION_BAR_BPS
  return (
    <span className={`mtg-bar ${onBar ? 'ok' : 'miss'}`}>
      {pct}% done{onBar ? '' : ' — the bar is 90%'}
    </span>
  )
}

/* ------------------------------------------------------------------ issues */

export function MeetingIssues({
  meetingId, issues,
}: {
  meetingId: string
  issues: { id: string; title: string; ageDays: number; owner: Person | null }[]
}) {
  const { pending, error, run } = useAction()
  const [title, setTitle] = useState('')

  return (
    <div>
      {issues.length === 0 ? <p className="mtg-hint">The issues list is empty. Enjoy it while it lasts.</p> : null}
      {issues.map((issue) => (
        <div key={issue.id} className="mtg-issue">
          <span className="mtg-todo-t">{issue.title}</span>
          {issue.owner ? <span className="mtg-who">{issue.owner.name}</span> : null}
          <span className="mtg-age">{issue.ageDays}d</span>
          <button
            className="btn out sm" disabled={pending}
            onClick={() => run(() => resolveIssue({ issueId: issue.id, outcome: 'Solved', meetingId }))}
          >
            Solved
          </button>
          <button
            className="btn out sm" disabled={pending}
            onClick={() => run(() => resolveIssue({ issueId: issue.id, outcome: 'Dropped' }))}
          >
            Drop
          </button>
        </div>
      ))}

      <form
        className="mtg-add"
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim()) return
          run(() => createRecord({ table: 'issues', values: { title } }))
          setTitle('')
        }}
      >
        <input
          type="text" value={title} placeholder="New issue — a sentence is enough"
          onChange={(e) => setTitle(e.target.value)}
        />
        <button className="btn out sm" type="submit" disabled={pending || !title.trim()}>Add</button>
      </form>
      {error ? <p className="mtg-err">{error}</p> : null}
    </div>
  )
}

/* ---------------------------------------------------------- drop to issues */

/** Off-track scorecard rows and rocks become issues — that is the whole loop. */
export function DropToIssuesButton({ title }: { title: string }) {
  const { pending, error, run } = useAction()
  const [dropped, setDropped] = useState(false)

  if (dropped && !error) return <span className="mtg-hint">On the list.</span>

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button
        className="btn out sm" disabled={pending}
        onClick={() => {
          setDropped(true)
          run(() => createRecord({ table: 'issues', values: { title } }))
        }}
      >
        {pending ? 'Adding…' : 'Drop to issues'}
      </button>
      {error ? <span className="mtg-err">{error}</span> : null}
    </span>
  )
}
