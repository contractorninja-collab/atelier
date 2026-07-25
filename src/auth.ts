import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Resend from 'next-auth/providers/resend'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { accounts, sessions, teamMembers, users, verificationTokens } from '@/db/schema'

const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? '')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean)

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM ?? 'Atelier <onboarding@resend.dev>',
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: '/login',
    verifyRequest: '/login?sent=1',
    error: '/login',
  },
  callbacks: {
    /**
     * The CRM is invite-only: you must already exist in the Team table.
     * This is deliberate. Without it, anyone with a Google account who finds
     * the URL gets a seat and full read access to the pipeline.
     */
    async signIn({ user }) {
      const email = user.email?.toLowerCase()
      if (!email) return false

      if (allowedDomains.length > 0) {
        const domain = email.split('@')[1]
        if (!allowedDomains.includes(domain)) return false
      }

      const member = await db.query.teamMembers.findFirst({
        where: eq(teamMembers.email, email),
      })
      return Boolean(member)
    },

    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
        const member = await db.query.teamMembers.findFirst({
          where: eq(teamMembers.email, user.email.toLowerCase()),
        })
        session.user.memberId = member?.id ?? null
        session.user.memberName = member?.name ?? user.name ?? user.email
        session.user.role = member?.role ?? null
      }
      return session
    },
  },
})

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      memberId: string | null
      memberName: string
      role: string | null
    }
  }
}
