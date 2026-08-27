'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { renewSubscription } from '@/server/actions'
import { attempt } from '@/lib/attempt'

/**
 * Records a renewal from the dashboard, which is where you notice one is due.
 *
 * The result is shown inline rather than as a toast: this list is the only place
 * the button appears, and the new date is the answer to the question you asked.
 */
export function RenewButton({ id, label }: { id: string; label: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  if (result) {
    return (
      <span
        style={{
          fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
          color: result.ok ? 'var(--brand)' : 'var(--danger)',
        }}
      >
        {result.text}
      </span>
    )
  }

  return (
    <button
      className="btn out sm"
      disabled={pending}
      title={`Record a renewal for ${label}`}
      onClick={(e) => {
        // The row is a link to the record; renewing is not navigation.
        e.preventDefault()
        e.stopPropagation()
        startTransition(async () => {
          const r = await attempt(() => renewSubscription(id))
          setResult(r.ok ? { ok: true, text: r.detail ?? 'Renewed' } : { ok: false, text: r.error })
          if (r.ok) router.refresh()
        })
      }}
    >
      {pending ? 'Renewing…' : 'Renew'}
    </button>
  )
}
