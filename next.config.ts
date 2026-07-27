import type { NextConfig } from 'next'

const config: NextConfig = {
  // Both database drivers use Node APIs and, in PGlite's case, load a WASM
  // bundle from disk. Bundling either one breaks that lookup.
  serverExternalPackages: ['postgres', '@electric-sql/pglite'],

  /**
   * Lets a second instance keep its build output somewhere else.
   *
   * `next dev` and `next build` write to the same `.next` by default, so
   * running a build while a dev server is up leaves that server serving a
   * production directory it cannot read — the app answers every request with
   * a 500 and nothing in the logs points at the cause. Setting this is the
   * escape hatch: NEXT_DIST_DIR=.next-verify npm run local.
   */
  distDir: process.env.NEXT_DIST_DIR || '.next',
}

export default config
