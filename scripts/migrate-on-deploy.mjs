/**
 * Runs pending migrations before the production build, using the credentials
 * the build environment already holds.
 *
 * This exists because the database secrets are stored in Vercel as sensitive
 * values: deployments can use them but nobody can read them back out, so
 * `npm run db:deploy` cannot be run from a laptop that does not know the
 * password. The build environment is the one place the real values exist —
 * so the build migrates. drizzle-kit is journal-based and applies only what
 * has not run yet, which makes this safe to execute on every deployment.
 *
 * A build with no database configured (a preview, a fork, CI) skips rather
 * than fails: the code must still build where the database is not reachable.
 * If the migration itself fails, the build fails with it — the previous
 * deployment stays live, which is exactly what you want.
 */
import { execSync } from 'node:child_process'

if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  console.log('migrate-on-deploy: no DIRECT_URL or DATABASE_URL — skipping migrations.')
  process.exit(0)
}

console.log('migrate-on-deploy: applying pending migrations…')
execSync('npx drizzle-kit migrate', { stdio: 'inherit' })
console.log('migrate-on-deploy: done.')
