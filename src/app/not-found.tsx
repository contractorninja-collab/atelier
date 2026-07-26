import Link from 'next/link'

export default function NotFound() {
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
          Not found
        </h1>
        <p style={{ color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.6, margin: '0 0 20px' }}>
          That page does not exist. It may have been a table that has since been renamed.
        </p>
        <Link className="btn pri" href="/home">Back to Home</Link>
      </div>
    </div>
  )
}
