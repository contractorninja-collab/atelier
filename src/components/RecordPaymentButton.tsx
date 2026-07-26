'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NewRecordDialog, type PaymentPrefill } from './NewRecordDialog'

/**
 * Record money received, from wherever the unpaid invoice is showing.
 *
 * The outstanding figure is already on screen when you click, so the form opens
 * with it filled in — the overwhelmingly common case is a client paying exactly
 * what was asked, and that should not require typing a number you can already see.
 */
export function RecordPaymentButton({
  prefill, label = 'Record payment',
}: {
  prefill: PaymentPrefill
  label?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  if (done) return <span className="pj-raised">{done}</span>

  return (
    <>
      <button
        className="btn out sm"
        style={{ marginLeft: 8 }}
        onClick={(e) => {
          // These buttons sit inside rows that are themselves links.
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
      >
        {label}
      </button>
      {open ? (
        <NewRecordDialog
          table="payments"
          lookups={{}}
          prefill={prefill}
          onClose={() => setOpen(false)}
          onDone={(message) => {
            setOpen(false)
            setDone(message)
            router.refresh()
          }}
        />
      ) : null}
    </>
  )
}
