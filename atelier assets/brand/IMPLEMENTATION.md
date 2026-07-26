# Atelier brand implementation — handoff spec

Apply the new identity (mark **Aperture**, colourway **petrol & saffron**) to the Atelier
Next.js app. Everything below is scoped to files that already exist. No new dependencies,
no component API changes.

Assets ship in `brand/`:

```
atelier-mark.svg              ring #0F6B73 / stem #E2A63A     primary, light backgrounds
atelier-mark-reversed.svg     ring #7FD0CB / stem #E2A63A     on ink / petrol
atelier-mark-mono-ink.svg     all #0A1618                      one-colour
atelier-mark-mono-white.svg   all #FFFFFF                      knockout
atelier-logo-horizontal.svg   mark + wordmark, live text
atelier-logo-stacked.svg      mark over wordmark, live text
atelier-icon-app.svg          256px petrol tile, white ring, saffron stem
atelier-favicon-32.svg        32px tile, shortened stem (small-size variant)
atelier-tokens.css            replacement token ramp for globals.css
```

## The mark

32×32 box. Ring: `circle cx=14.5 cy=16 r=9.5`, stroke width 5. Stem: `path M26.5 12.5v14`,
stroke width 5, round cap. The stem is deliberately **not** centred on the ring and must not be
moved; the ring must never close into an `o`. Minimum size 16px — at ≤24px use the
favicon variant (stem halved to `M26.5 12.5v7`, stroke 6).

---

## 1. Tokens — `src/app/globals.css`

Replace the `:root { … }` and `[data-theme='dark'] { … }` blocks at the top of the file
(everything from `:root {` down to the closing brace of `[data-theme='dark']`) with the
contents of `brand/atelier-tokens.css`. Variable names are unchanged, so no other rule in the
file needs editing.

What changes:

| Token | Was | Now |
| --- | --- | --- |
| `--brand` | `#0e9f6e` | `#0f6b73` petrol |
| `--brand-600` | `#0b8a5e` | `#0c565d` |
| `--brand-700` | `#097a53` | `#094449` |
| `--brand-soft` | rgba green .12 | `rgba(15,107,115,0.12)` |
| `--brand-ring` | rgba green .35 | `rgba(15,107,115,0.32)` |
| `--brand-tint` | — (new) | `#7fd0cb` |
| `--accent` | — (new) | `#e2a63a` saffron |
| `--accent-600` / `--accent-soft` | — (new) | `#c68a24` / `rgba(226,166,58,0.15)` |
| `--nav-bg` / `--nav-bg-2` / `--nav-active` / `--nav-border` | slate | `#0a1618` / `#0f2023` / `#163034` / `#16272a` |
| `--bg-2` / `--bg-3` / `--line` / `--line-2` / `--row-hover` | neutral grey | `#f5f8f8` / `#e9f0f0` / `#dfe8e9` / `#edf2f2` / `#f5faf9` |
| `--ink` / `--ink-2` / `--ink-3` | `#101418` / `#5a6773` / `#8b98a5` | `#0a1618` / `#55666a` / `#86999d` |
| `--danger` | — (new, was inline `#e2597a`) | `#c2415f` |
| `--font-display` | — (new) | `'Plus Jakarta Sans', …` |

The tokens file also redefines `.ws-mark` (solid petrol tile, no gradient, sized `svg` child)
and `.ws-name` (display font). Delete the old `.ws-mark` and `.ws-name` rules from
`globals.css` so the new ones are not overridden by later cascade — or keep them and rely on the
import order, but do not leave two competing `.ws-mark` definitions.

**Accent rule (enforce in review):** saffron `--accent` signals attention only — hygiene flags,
over-capacity, budget warnings, risk severity, slip. It is never a button fill, never a link
colour, never a stage pill for a healthy stage. Petrol carries every interactive state.

Colours currently hard-coded in components that should move to tokens while you are in there:
`#e0a020` (`.flag`), `#e2597a` (`.tl-today`, `.down`), `#7f1d3a` (`.toast.err`) → `--accent-600`,
`--danger`, and a `color-mix` of `--danger` respectively.

## 2. New component — `src/components/Mark.tsx`

```tsx
/**
 * The Atelier mark (Aperture). Ring + stem, currentColor-free: the two strokes are
 * brand colours, so callers only choose a size and a variant.
 *
 * variant:
 *   'brand'    petrol ring, saffron stem      — light backgrounds
 *   'onBrand'  white ring, saffron stem       — inside a petrol tile (.ws-mark)
 *   'reversed' tint ring, saffron stem        — on ink
 *   'mono'     inherits currentColor          — one-colour contexts
 */
export function Mark({
  size = 18,
  variant = 'brand',
}: {
  size?: number
  variant?: 'brand' | 'onBrand' | 'reversed' | 'mono'
}) {
  const ring =
    variant === 'onBrand' ? '#f2f7f8'
    : variant === 'reversed' ? 'var(--brand-tint)'
    : variant === 'mono' ? 'currentColor'
    : 'var(--brand)'
  const stem = variant === 'mono' ? 'currentColor' : 'var(--accent)'

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="14.5" cy="16" r="9.5" stroke={ring} strokeWidth={5} />
      <path d="M26.5 12.5v14" stroke={stem} strokeWidth={5} strokeLinecap="round" />
    </svg>
  )
}
```

## 3. Replace the letter mark in three places

**`src/components/Sidebar.tsx`** — line 36:

```diff
-        <div className="ws-mark">A</div>
+        <div className="ws-mark"><Mark size={18} variant="onBrand" /></div>
```

plus `import { Mark } from './Mark'`.

**`src/app/login/page.tsx`** — lines 21-23:

```diff
-        <div className="ws-mark" style={{ width: 40, height: 40, flexBasis: 40, fontSize: 18, borderRadius: 11 }}>
-          P
-        </div>
+        <div className="ws-mark" style={{ width: 40, height: 40, flexBasis: 40, borderRadius: 11 }}>
+          <Mark size={26} variant="onBrand" />
+        </div>
```

plus `import { Mark } from '@/components/Mark'`. (Note the current letter is `P`, left over from
the PagaPRO rename — it goes away with this change.)

**`src/app/health/page.tsx`** — line 143: same substitution, `size={22}`, `borderRadius: 10`.

## 4. Wordmark type

Add Plus Jakarta Sans and point the display font at it. In `src/app/layout.tsx`:

```diff
 import type { Metadata } from 'next'
+import { Plus_Jakarta_Sans } from 'next/font/google'
 import { THEME_BOOTSTRAP } from '@/lib/prefs'
 import './globals.css'

+const display = Plus_Jakarta_Sans({
+  subsets: ['latin'],
+  weight: ['600', '700', '800'],
+  variable: '--font-display-family',
+  display: 'swap',
+})
```

and put `className={display.variable}` on `<html>`. Then in `atelier-tokens.css` change
`--font-display` to `var(--font-display-family), -apple-system, …`.

Type rules:

- Wordmark / `.ws-name`: display font, 700–800, letter-spacing `-0.03em` (`-0.045em` at ≥24px).
- Headings — `.dash h3`, `.kpi .v`, `.over-top .tt`, `.crumb .cur`: display font 700.
- Everything else: the existing system stack at 13.5px, unchanged. The grid's column
  widths are tuned to it; do not restyle body type.
- All numerics keep `font-variant-numeric: tabular-nums`.

## 5. Favicon and metadata — `src/app/layout.tsx`

Copy `atelier-favicon-32.svg` to `src/app/icon.svg` and `atelier-icon-app.svg` to
`src/app/apple-icon.svg`; Next picks both up by convention. Then:

```diff
 export const metadata: Metadata = {
   title: 'Atelier — Workspace',
   description: 'The house workspace: sales and production for every product we build.',
+  themeColor: [
+    { media: '(prefers-color-scheme: light)', color: '#0f6b73' },
+    { media: '(prefers-color-scheme: dark)', color: '#0a1618' },
+  ],
 }
```

## 6. Acceptance checks

1. `--brand` appears nowhere as a literal hex in components — grep for `0e9f6e`, `12c489`,
   `0b8a5e`, `097a53`; all must be gone.
2. Sidebar, login and health all render the mark, not a letter. No `P` anywhere.
3. Light and dark themes both pass 4.5:1 for body text and 3:1 for the mark strokes against
   their backgrounds (`--brand` on `--bg`, `--brand-tint` on `--nav-bg`).
4. Saffron appears only on: hygiene flag, budget warning, over-100% utilisation, risk severity
   high, milestone slip. No saffron buttons, links or healthy-state pills.
5. Favicon legible at 16px in a browser tab (the shortened-stem variant, not the full mark).
6. `npm run build` clean; no visual regression in the grid's frozen first column, the board
   drag affordance, or the record panel's focus rings (all use `--brand-ring`).

Reference: the visual sheet is in `Atelier Logo.dc.html`, turn 5 — lockups, clear space, icon
sizes, don't-list, token swatches and the whole shell in petrol & saffron.
