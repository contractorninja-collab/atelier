import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { sessions, teamMembers, users } from '@/db/schema'

/**
 * Development-only sign-in.
 *
 * Atelier is invite-only and needs an email provider or Google configured to
 * let anyone in. That is correct for a real deployment and a wall when you just
 * want to look at the thing on your own machine. This creates a session for a
 * team member directly, skipping the provider entirely.
 *
 * It is fenced three ways, all of which must pass:
 *   - ATELIER_DEV_LOGIN must be exactly "true"
 *   - NODE_ENV must not be production
 *   - the email must already exist in the Team table
 *
 * `npm run local` sets the flag. `npm run dev` and every production build do
 * not, so this route answers 404 there.
 */
export async function GET(request: Request) {
  const enabled = process.env.ATELIER_DEV_LOGIN === 'true' && process.env.NODE_ENV !== 'production'
  if (!enabled) {
    return new NextResponse('Not found', { status: 404 })
  }

  const url = new URL(request.url)
  const requested = url.searchParams.get('email')?.toLowerCase().trim()

  const member = requested
    ? await db.query.teamMembers.findFirst({ where: eq(teamMembers.email, requested) })
    : await db.query.teamMembers.findFirst()

  if (!member) {
    return new NextResponse(
      requested
        ? `No team member with the email ${requested}. Sign-in is invite-only.`
        : 'No team members exist yet. Run: npm run local:setup',
      { status: 400 },
    )
  }

  // Auth.js keys sessions off the User table, so mirror the member into it.
  let user = await db.query.users.findFirst({ where: eq(users.email, member.email) })
  if (!user) {
    const [created] = await db
      .insert(users)
      .values({ email: member.email, name: member.name, emailVerified: new Date() })
      .returning()
    user = created
  }

  const token = crypto.randomUUID()
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await db.insert(sessions).values({ sessionToken: token, userId: user.id, expires })

  const response = NextResponse.redirect(new URL('/home', request.url))
  response.cookies.set('authjs.session-token', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires,
    // Never `secure` here: this route only runs outside production, which means
    // plain http on localhost, where a secure cookie would silently not be set.
    secure: false,
  })
  return response
}
