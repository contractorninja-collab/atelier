import type { NextConfig } from 'next'

const config: NextConfig = {
  // Both database drivers use Node APIs and, in PGlite's case, load a WASM
  // bundle from disk. Bundling either one breaks that lookup.
  serverExternalPackages: ['postgres', '@electric-sql/pglite'],
}

export default config
