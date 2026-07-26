'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NewRecordDialog, type InvoicePrefill } from './NewRecordDialog'

/**
 * Raise the invoice an accepted milestone was supposed to trigger, without
 * leaving the project.
 *
 * The cockpit can already tell you that €2,900 of accepted work was never
 * billed; making you go and re-enter the client, the project and the amount
 * somewhere else is how that figure stays true for another month.
 */
export function RaiseInvoiceButton({ prefill }: { prefill: InvoicePrefill }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  if (done) {
    return <span className="pj-raised">{done}</span>
  }

  return (
    <>
      <button className="btn out sm" style={{ marginLeft: 8 }} onClick={() => setOpen(true)}>
        Raise invoice
      </button>
      {open ? (
        <NewRecordDialog
          table="invoices"
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
