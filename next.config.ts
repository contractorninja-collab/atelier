import type { NextConfig } from 'next'

const config: NextConfig = {
  // postgres.js uses Node APIs; keep it out of the bundler.
  serverExternalPackages: ['postgres'],
}

export default config
