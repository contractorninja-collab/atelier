import { sql } from 'drizzle-orm'
import { db } from '@/db'
import * as t from '@/db/schema'
import { Mark } from '@/components/Mark'
import { BRAND } from '@/lib/brand'

export const dynamic = 'force-dynamic'

/**
 * Deployment health check.
 *
 * Deliberately NOT behind auth: the most common reason a fresh deployment is
 * unusable is that auth itself is misconfigured, and a diagnostic page you
 * cannot reach until you have signed in is worthless.
 *
 * It never prints a secret. Only whether one is present, and — for values that
 * are safe to show, like the sign-in URL — what it is set to.
 */

type Check = {
  label: string
  state: 'ok' | 'warn' | 'fail'
  detail: string
  fix?: string
}

async function runChecks(): Promise<Check[]> {
  const checks: Check[] = []
  const present = (name: string) => Boolean(process.env[name]?.trim())

  checks.push(
    present('DATABASE_URL')
      ? { label: 'DATABASE_URL', state: 'ok', detail: 'Set' }
      : { label: 'DATABASE_URL', state: 'fail', detail: 'Missing', fix: 'Supabase → Project Settings → Database → Connection string → use the pooled one, port 6543.' },
  )

  checks.push(
    present('DIRECT_URL')
      ? { label: 'DIRECT_URL', state: 'ok', detail: 'Set' }
      : { label: 'DIRECT_URL', state: 'warn', detail: 'Missing', fix: 'Only needed to run migrations. Use the direct connection, port 5432.' },
  )

  const secret = process.env.AUTH_SECRET ?? ''
  checks.push(
    secret.length >= 32
      ? { label: 'AUTH_SECRET', state: 'ok', detail: `Set (${secret.length} characters)` }
      : secret.length > 0
        ? { label: 'AUTH_SECRET', state: 'warn', detail: `Only ${secret.length} characters`, fix: 'Regenerate with: npx auth secret' }
        : { label: 'AUTH_SECRET', state: 'fail', detail: 'Missing', fix: 'Generate with: npx auth secret' },
  )

  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? ''
  checks.push(
    authUrl
      ? { label: 'AUTH_URL', state: authUrl.startsWith('http') ? 'ok' : 'warn', detail: authUrl, fix: authUrl.startsWith('http') ? undefined : 'Must include the scheme, e.g. https://atelier.yourcompany.com' }
      : { label: 'AUTH_URL', state: 'warn', detail: 'Not set', fix: 'Vercel usually infers this, but set it explicitly for a custom domain.' },
  )

  const resend = present('AUTH_RESEND_KEY')
  const from = process.env.EMAIL_FROM ?? ''
  checks.push(
    resend && from
      ? { label: 'Magic link (Resend)', state: 'ok', detail: `Sending as ${from}` }
      : resend
        ? { label: 'Magic link (Resend)', state: 'warn', detail: 'Key set, EMAIL_FROM missing', fix: 'Set EMAIL_FROM, e.g. "Atelier <onboarding@resend.dev>" while testing.' }
        : { label: 'Magic link (Resend)', state: 'warn', detail: 'Not configured', fix: 'Optional if Google sign-in works. Free key at resend.com.' },
  )

  const google = present('AUTH_GOOGLE_ID') && present('AUTH_GOOGLE_SECRET')
  checks.push(
    google
      ? { label: 'Google sign-in', state: 'ok', detail: 'Client ID and secret set' }
      : { label: 'Google sign-in', state: 'warn', detail: 'Not configured', fix: `Optional if magic link works. Redirect URI must be ${authUrl || 'YOUR_URL'}/api/auth/callback/google` },
  )

  if (!present('DATABASE_URL')) {
    checks.push({ label: 'Database connection', state: 'fail', detail: 'Skipped — no DATABASE_URL' })
    return checks
  }

  try {
    const tables = await db.execute<{ count: string }>(
      sql`select count(*)::text as count from information_schema.tables where table_schema = 'public'`,
    )
    const tableCount = Number(tables[0]?.count ?? 0)
    checks.push({ label: 'Database connection', state: 'ok', detail: `Connected · ${tableCount} tables` })

    if (tableCount < 18) {
      checks.push({
        label: 'Migrations', state: 'fail',
        detail: `Only ${tableCount} tables — expected at least 18`,
        fix: 'Run: npm run db:deploy (with DIRECT_URL pointing at this database)',
      })
      return checks
    }
    checks.push({ label: 'Migrations', state: 'ok', detail: 'All tables present' })

    // The single most common lockout: a working deployment nobody can enter,
    // because sign-in requires a matching Team row and the table is empty.
    const members = await db.select({ email: t.teamMembers.email }).from(t.teamMembers)
    checks.push(
      members.length > 0
        ? { label: 'Team members', state: 'ok', detail: `${members.length} people can sign in` }
        : {
            label: 'Team members', state: 'fail',
            detail: 'No team members — nobody can sign in',
            fix: 'Sign-in is invite-only and checks this table. Run npm run db:seed, or insert a row into team_member with your email.',
          },
    )

    const [deals, orgs] = await Promise.all([
      db.select({ id: t.deals.id }).from(t.deals),
      db.select({ id: t.organizations.id }).from(t.organizations),
    ])
    checks.push({
      label: 'Data', state: 'ok',
      detail: `${orgs.length} companies · ${deals.length} deals`,
    })
  } catch (error) {
    checks.push({
      label: 'Database connection', state: 'fail',
      detail: error instanceof Error ? error.message.slice(0, 160) : 'Failed',
      fix: 'Check the password in DATABASE_URL, and that the connection string is the pooled one (port 6543).',
    })
  }

  return checks
}

export default async function HealthPage() {
  const checks = await runChecks()
  const failing = checks.filter((c) => c.state === 'fail').length
  const warning = checks.filter((c) => c.state === 'warn').length

  const colour = { ok: BRAND.success, warn: BRAND.saffron, fail: BRAND.danger }
  const mark = { ok: '✓', warn: '!', fail: '✕' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', padding: '48px 20px', overflowY: 'auto' }}>
      <div style={{
        maxWidth: 660, margin: '0 auto', background: 'var(--bg)', border: '1px solid var(--line)',
        borderRadius: 14, padding: 30,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div className="ws-mark" style={{ width: 34, height: 34, flexBasis: 34, borderRadius: 10 }}>
            <Mark size={22} variant="onBrand" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 680, letterSpacing: '-0.02em', margin: 0 }}>Atelier — deployment check</h1>
        </div>
        <p style={{ color: 'var(--ink-2)', fontSize: 13, margin: '0 0 24px', lineHeight: 1.6 }}>
          {failing > 0
            ? `${failing} thing${failing === 1 ? '' : 's'} will stop this deployment working.`
            : warning > 0
              ? `Everything essential is in place. ${warning} optional item${warning === 1 ? '' : 's'} not configured.`
              : 'Everything is configured. You are ready to sign in.'}
          {' '}No secret values are shown on this page.
        </p>

        <div style={{ display: 'grid', gap: 2 }}>
          {checks.map((check) => (
            <div
              key={check.label}
              style={{
                display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0',
                borderBottom: '1px solid var(--line-2)',
              }}
            >
              <span style={{
                width: 20, height: 20, flex: '0 0 20px', borderRadius: '50%', display: 'grid',
                placeItems: 'center', fontSize: 11, fontWeight: 800, marginTop: 1,
                background: `${colour[check.state]}22`, color: colour[check.state],
              }}>
                {mark[check.state]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{check.label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2, wordBreak: 'break-word' }}>
                  {check.detail}
                </div>
                {check.fix ? (
                  <div style={{
                    fontSize: 12, color: 'var(--ink-3)', marginTop: 6, background: 'var(--bg-2)',
                    padding: '8px 10px', borderRadius: 6, lineHeight: 1.55,
                  }}>
                    {check.fix}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 22, lineHeight: 1.6 }}>
          Once everything above is green, go to <a href="/login" style={{ color: 'var(--brand)' }}>/login</a>.
          Delete this route before you put Atelier on a public domain if you would rather not advertise
          which parts of the stack are configured.
        </p>
      </div>
    </div>
  )
}
