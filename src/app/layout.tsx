import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Atelier — Workspace',
  description: 'The house workspace: sales and production for every product we build.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  )
}
