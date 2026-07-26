'use client'

/**
 * The last line before a raw Next.js stack trace.
 *
 * Deliberately says nothing about what broke: the real error is already in the
 * server log with its stack, and a database message rendered on the page tells
 * the reader nothing useful while telling everyone else the column names.
 */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: 'var(--bg-2)', padding: 24,
    }}>
      <div style={{
        maxWidth: 460, background: 'var(--bg)', border: '1px solid var(--line)',
        borderRadius: 14, padding: 28, textAlign: 'center',
      }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700,
          letterSpacing: '-0.02em', margin: '0 0 8px',
        }}>
          Something went wrong
        </h1>
        <p style={{ color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.6, margin: '0 0 20px' }}>
          Nothing was saved. Try again, and if it keeps happening the details are in the server log.
        </p>
        <button className="btn pri" onClick={reset}>Try again</button>
      </div>
    </div>
  )
}
