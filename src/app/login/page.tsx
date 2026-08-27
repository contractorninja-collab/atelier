import { redirect } from 'next/navigation'
import { auth, signIn } from '@/auth'
import { Icon } from '@/components/Icon'
import { Mark } from '@/components/Mark'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>
}) {
  const session = await auth()
  if (session?.user) redirect('/home')

  const { sent, error } = await searchParams
  const devLogin = process.env.ATELIER_DEV_LOGIN === 'true' && process.env.NODE_ENV !== 'production'

  /**
   * Say what actually failed. One hardcoded message here blamed the Team table
   * for every error — including the mail service refusing to send, which reads
   * as "you are not invited" to a person who very much is. Somebody stared at
   * their own row in the grid because of this.
   */
  const errorMessage =
    error === 'AccessDenied'
      ? 'That address is not on the team yet. Ask an admin to add you to the Team table first.'
      : error === 'EmailSignin'
        ? 'You are on the team, but the sign-in email could not be sent — the mail service refused it. Tell an admin; this is a configuration problem, not something you did.'
        : 'Sign-in failed for a technical reason. Try again, and tell an admin if it keeps happening.'

  return (
    <div className="login-wrap">
      <div className="login">
        <div className="ws-mark" style={{ width: 40, height: 40, flexBasis: 40, borderRadius: 11 }}>
          <Mark size={26} variant="onBrand" />
        </div>
        <h1>Atelier</h1>
        <p className="sub">
          The house workspace. Sign in with the address your team invited.
        </p>

        {sent ? (
          <div
            style={{
              background: 'var(--brand-soft)', border: '1px solid var(--brand-ring)', color: 'var(--brand-700)',
              padding: '11px 13px', borderRadius: 8, fontSize: 12.5, marginBottom: 18, lineHeight: 1.5,
            }}
          >
            Check your inbox — the sign-in link is valid for 24 hours.
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              background: 'color-mix(in srgb, var(--danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)', color: 'var(--danger)',
              padding: '11px 13px', borderRadius: 8, fontSize: 12.5, marginBottom: 18, lineHeight: 1.5,
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        <form
          action={async (formData: FormData) => {
            'use server'
            await signIn('resend', {
              email: String(formData.get('email') ?? '').toLowerCase().trim(),
              redirectTo: '/home',
            })
          }}
        >
          <label htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" required placeholder="you@yourcompany.com" autoComplete="email" />
          <button className="btn pri full" type="submit">
            <Icon name="mail" size={15} />
            Email me a sign-in link
          </button>
        </form>

        {devLogin ? (
          <>
            <div className="or">local development</div>
            <a className="btn out full" href="/api/dev-login" style={{ textDecoration: 'none' }}>
              <Icon name="bolt" size={15} />
              Sign in as the founder
            </a>
            <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '10px 0 0', lineHeight: 1.6 }}>
              Available because ATELIER_DEV_LOGIN is set and this is not a production build.
              The route returns 404 in production.
            </p>
          </>
        ) : null}

        <div className="or">or</div>

        <form
          action={async () => {
            'use server'
            await signIn('google', { redirectTo: '/home' })
          }}
        >
          <button className="btn out full" type="submit">
            <Icon name="google" size={15} />
            Continue with Google
          </button>
        </form>

        <p className="note">
          Access is invite-only: your email must already exist in the Team table. This is deliberate — without it,
          anyone who finds the URL gets a full read of the pipeline.
        </p>
      </div>
    </div>
  )
}
