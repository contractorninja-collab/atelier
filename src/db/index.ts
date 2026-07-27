import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { PGlite } from '@electric-sql/pglite'
import postgres from 'postgres'
import * as schema from './schema'

/**
 * Two ways to get a database.
 *
 * ATELIER_LOCAL_DB=true runs PGlite — real Postgres compiled to WebAssembly,
 * kept in a folder beside the project. No install, no Docker, no account. It
 * exists so you can clone this and see it running in two minutes.
 *
 * Anything else opens a normal Postgres connection, which is what production
 * is. Local mode is refused in a production build on purpose: PGlite is a
 * single-process file store, so a deployment pointed at it would give every
 * serverless instance its own private copy of the company's data.
 */
const useLocal = process.env.ATELIER_LOCAL_DB === 'true'

if (useLocal && process.env.NODE_ENV === 'production' && !process.env.ATELIER_ALLOW_LOCAL_DB_IN_PROD) {
  throw new Error(
    'ATELIER_LOCAL_DB is set in a production build. PGlite is for local development only — ' +
    'point DATABASE_URL at a real Postgres instead.',
  )
}

// Next reloads modules on every save in development. Without these globals the
// connection count climbs until Postgres refuses new clients, and PGlite would
// open a second handle to the same directory.
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>
  pgliteClient?: PGlite
}

function makeDb() {
  if (useLocal) {
    const client = globalForDb.pgliteClient ?? new PGlite(process.env.ATELIER_LOCAL_DB_PATH ?? '.atelier-local')
    if (process.env.NODE_ENV !== 'production') globalForDb.pgliteClient = client
    return drizzlePglite(client, { schema })
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Either copy .env.example to .env and fill in a Postgres connection ' +
      'string, or run `npm run local` to use the built-in local database.',
    )
  }

  const client =
    globalForDb.pgClient ??
    postgres(connectionString, {
      // Supabase's pooler does not support prepared statements.
      prepare: false,
      /**
       * Small, but not one.
       *
       * On Vercel each request may be its own instance, so the pool size is
       * multiplied by concurrency — ten was enough to make Supabase's pooler
       * refuse connections under the burst Next fires when it prefetches the
       * sidebar links. One is the opposite mistake: a single page calls
       * getLookups, which issues a dozen queries in parallel, and they would
       * queue behind each other on the only connection.
       *
       * Five lets that fan-out pipeline while keeping the per-instance
       * footprint low enough for the transaction pooler to absorb.
       */
      max: process.env.NODE_ENV === 'production' ? 5 : 3,
      /**
       * Recycle sockets aggressively, because serverless instances get frozen.
       *
       * Vercel can suspend an instance mid-request. The socket dies with it, but
       * Postgres does not know that — the backend sits in `ClientRead` waiting
       * for a client that is never coming back, holding a pooler slot. Enough of
       * those and every new query queues until it times out, which is what made
       * the deployed app hang on any page that touched the database.
       *
       * A short idle timeout and a capped lifetime mean an abandoned connection
       * is measured in seconds rather than hours.
       */
      idle_timeout: 10,
      max_lifetime: 60 * 5,
      connect_timeout: 10,
    })
  // Reused across hot reloads in dev; in production each instance is short-lived
  // and Vercel may freeze it, so caching a socket on globalThis is not safe.
  if (process.env.NODE_ENV !== 'production') globalForDb.pgClient = client
  return drizzlePostgres(client, { schema })
}

// Both drivers expose the same query surface; the cast keeps every call site
// written against one type rather than a union of two.
export const db = makeDb() as unknown as ReturnType<typeof drizzlePostgres<typeof schema>>

/**
 * Rows out of `db.execute`, whichever driver is underneath.
 *
 * The two disagree: postgres-js hands back the row array itself, PGlite hands
 * back `{ rows, fields }`. Code written against one silently reads nothing on
 * the other — no error, just an empty result, which is far worse than a crash
 * because it looks like an empty database.
 *
 * Only raw `execute` needs this. Drizzle's query builder and relational API
 * normalise the shape themselves.
 */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  const rows = (result as { rows?: unknown } | null)?.rows
  return Array.isArray(rows) ? (rows as T[]) : []
}
export { schema, useLocal }
