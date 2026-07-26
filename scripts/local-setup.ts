/**
 * Prepares the built-in local database.
 *
 * PGlite is real Postgres compiled to WebAssembly, stored in `.atelier-local`
 * beside the project. Nothing to install, no Docker, no account — the point is
 * that `npm run local` works on a machine that has only Node on it.
 *
 * Delete the `.atelier-local` folder to start over.
 */
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from '../src/db/schema'

const path = process.env.ATELIER_LOCAL_DB_PATH ?? '.atelier-local'

async function main() {
  console.log(`Preparing the local database in ./${path} …`)
  const client = new PGlite(path)
  const db = drizzle(client, { schema })

  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('Migrations applied.')

  await client.close()
}

main().catch((error) => {
  console.error('\nLocal setup failed:\n', error)
  process.exit(1)
})
