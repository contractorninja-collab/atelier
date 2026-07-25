import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and fill in your Supabase connection string.',
  )
}

/**
 * Next dev reloads modules on every save; without this the connection count
 * climbs until Postgres refuses new clients.
 */
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> }

const client =
  globalForDb.pgClient ??
  postgres(connectionString, {
    // Supabase's pooler does not support prepared statements.
    prepare: false,
    max: process.env.NODE_ENV === 'production' ? 10 : 3,
  })

if (process.env.NODE_ENV !== 'production') globalForDb.pgClient = client

export const db = drizzle(client, { schema })
export { schema }
