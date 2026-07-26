import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { THEME_BOOTSTRAP } from '@/lib/prefs'
import './globals.css'

/**
 * Display face for the wordmark and headings only. Body copy stays on the
 * system stack — the grid's column widths are tuned to it.
 */
const display = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display-family',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Atelier — Workspace',
  description: 'The house workspace: sales and production for every product we build.',
}

/**
 * themeColor lives here rather than in `metadata` — Next 15 moved it, and
 * leaving it in the metadata export logs a warning and drops the value.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0f6b73' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1618' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={display.variable} suppressHydrationWarning>
      <head>
        {/* Sets data-theme from the stored preference before first paint. Without
            it, a dark-theme user gets a white flash on every navigation. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
