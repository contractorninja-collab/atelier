# Deploying Atelier

**Just want to look at it first?** Skip all of this:

```bash
npm install && npm run local:setup && npm run local
```

That runs Atelier against a local WebAssembly Postgres with demo data and a
development sign-in button. Nothing below is needed until you want other
people to use it.

---

About an hour, most of it waiting for accounts to provision. Everything you paste is listed explicitly — you should not have to guess a single value.

At any point, open `https://your-app/health`. It tells you exactly which piece is missing and how to fix it, and it works before sign-in does, because the most common reason a fresh deployment is unusable is that sign-in itself is misconfigured.

---

## 1 — The database (Supabase, ~10 minutes)

Create a project at [supabase.com](https://supabase.com). Choose a region near your team — `eu-central-1` for Warsaw. Save the database password somewhere; it appears in the connection strings and Supabase will not show it again.

When the project finishes provisioning, go to **Project Settings → Database → Connection string** and copy two of them:

| Copy this | Into | Port | Used for |
|---|---|---|---|
| **Transaction pooler** | `DATABASE_URL` | 6543 | The app. Handles many short-lived serverless connections. |
| **Direct connection** | `DIRECT_URL` | 5432 | Migrations only. Pooled connections cannot run DDL. |

Append `?pgbouncer=true` to `DATABASE_URL` if Supabase has not already. Replace `[YOUR-PASSWORD]` in both with the real password.

Getting these the wrong way round is the single most common mistake. The app will appear to work and migrations will fail with an opaque error.

## 2 — Local setup and migrations (~10 minutes)

```bash
npm install
cp .env.example .env
```

Paste both connection strings into `.env`, then:

```bash
npx auth secret     # writes AUTH_SECRET
npm run db:migrate  # creates all 18 tables
npm run db:seed     # optional: demo data so the app is not empty
```

Before seeding, open `src/db/seed.ts` and change `FOUNDER_EMAIL` to the address you will sign in with. **Sign-in is invite-only** — it checks the `team_member` table, so an address that is not in there cannot get in, no matter which provider you use.

If you would rather start empty, skip the seed and insert one row by hand:

```sql
insert into team_member (id, name, email, role, department)
values (gen_random_uuid()::text, 'Your Name', 'you@yourcompany.com', 'Founder', 'Ops');
```

Then `npm run dev` and check `http://localhost:3000/health`.

## 3 — Sign-in providers (~15 minutes)

You need **one** of these. Both is better, neither means you cannot log in.

**Magic link.** Sign up at [resend.com](https://resend.com), create an API key, put it in `AUTH_RESEND_KEY`. Until you verify a sending domain, use `EMAIL_FROM="Atelier <onboarding@resend.dev>"` — Resend permits that for testing, and it only delivers to the address that owns the account.

**Google.** Google Cloud Console → **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**. Add authorised redirect URIs for both environments:

```
http://localhost:3000/api/auth/callback/google
https://your-production-domain/api/auth/callback/google
```

Copy the client ID and secret into `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`. If your team is on Google Workspace, also set `ALLOWED_EMAIL_DOMAINS=yourcompany.com` for a second lock on top of the Team-table check.

## 4 — GitHub (~5 minutes)

Create an **empty** repository — no README, no .gitignore, no licence, or the first push will be rejected for unrelated histories. Then:

```bash
./push-to-github.sh git@github.com:your-org/atelier.git
```

The commit history is already written. The script refuses to run if `.env` ever became tracked.

## 5 — Vercel (~15 minutes)

Import the repository at [vercel.com/new](https://vercel.com/new). Vercel detects Next.js; do not change the build settings.

Before the first deploy, add every one of these under **Environment Variables**:

```
DATABASE_URL         the pooled string, port 6543
DIRECT_URL           the direct string, port 5432
AUTH_SECRET          from npx auth secret
AUTH_URL             https://your-production-domain
AUTH_RESEND_KEY      if using magic link
EMAIL_FROM           if using magic link
AUTH_GOOGLE_ID       if using Google
AUTH_GOOGLE_SECRET   if using Google
ALLOWED_EMAIL_DOMAINS  optional
```

`AUTH_URL` must be the real URL you will visit. If it is wrong, sign-in redirects to the wrong host and fails with an error that does not mention `AUTH_URL`.

Deploy, then open `https://your-app/health`. Everything essential should be green.

## 6 — Your real data (~20 minutes)

Sign in, then go to **Import data** in the sidebar.

Import in this order — contacts and deals reference companies by domain or exact name, so companies must exist first:

1. **Companies** — deduplicated on domain. Re-running the same file imports nothing new.
2. **Contacts** — deduplicated on email.
3. **Deals** — no deduplication; every row becomes a deal.

Download the template CSV for each type; the column names are matched loosely, so your CRM's export headers will probably work unchanged. Paste or upload, press **Check the file**, and read the preview: it tells you exactly how many rows will import, how many will be skipped, and why, before writing anything.

When you are ready, the same page has a button to remove the twelve demo companies. It matches them by their exact seeded domains and leaves anything you imported alone.

---

## Afterwards

**Adding someone to the team.** Insert them into the Team table with their real email. They can then sign in. There is no invitation email yet — tell them the URL.

**Schema changes.** Edit `src/db/schema.ts`, then:

```bash
npm run db:generate   # writes a migration file
npm run db:deploy     # applies it (needs DIRECT_URL)
```

Commit the generated file in `drizzle/`. Never edit an applied migration.

**Backups.** Supabase takes daily backups on paid plans. On the free tier, take your own before anything destructive:

```bash
pg_dump "$DIRECT_URL" > atelier-$(date +%F).sql
```

**Rotating a secret.** Change it at the source (Supabase → Settings → Database → Reset password; Resend → API Keys → create new, delete old), paste the new value into `.env`, then:

```bash
bash scripts/sync-secrets.sh && npx vercel --prod
```

The script reads `.env` and pushes to Vercel over stdin — the value is never printed, never in your shell history, and never pasted into a chat window. It prints a short fingerprint instead so you can confirm the value actually changed. The redeploy matters: Vercel bakes environment variables in at build time, so the running deployment keeps the old secret until it rebuilds.

Rotate whenever a value has been somewhere it should not have been — a screenshot, a support thread, a chat with an assistant, a commit that was later amended. The old value keeps working until you change it at the source; removing it from a file changes nothing.

**Costs at your size.** Supabase free covers 500 MB, which is years of this data. Vercel Hobby is free for personal use but its licence does not cover commercial use — expect roughly $20 a month for Pro. Resend is free to 3,000 emails a month; magic links will not come close.

**Two failure modes worth recognising.** If the app renders with no styling at all, a `next dev` run has poisoned a production `.next` directory (or the reverse) — delete `.next` and rebuild, it is not a CSS bug. And if sign-in silently returns you to the login page, the address is not in the Team table; that is the invite-only check doing its job.

**Before a public domain.** Consider deleting `src/app/health/page.tsx`. It leaks no secrets, but it does advertise which parts of your stack are configured.
