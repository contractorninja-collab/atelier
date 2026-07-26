/**
 * The Atelier mark (Aperture) — a single-storey `a` reduced to a ring and a stem.
 *
 * The stem is deliberately not centred on the ring and must not be moved; the
 * ring must never close into an `o`. Minimum size 16px, and at 24px or below use
 * `variant="small"`, which shortens the stem and thickens both strokes so the
 * shape survives at favicon scale.
 *
 * variant:
 *   'brand'    petrol ring, saffron stem   — light backgrounds
 *   'onBrand'  white ring, saffron stem    — inside a petrol tile (.ws-mark)
 *   'reversed' tint ring, saffron stem     — on ink
 *   'mono'     inherits currentColor       — one-colour contexts
 */
export function Mark({
  size = 18,
  variant = 'brand',
  small = false,
}: {
  size?: number
  variant?: 'brand' | 'onBrand' | 'reversed' | 'mono'
  small?: boolean
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
      <path
        d={small ? 'M26.5 12.5v7' : 'M26.5 12.5v14'}
        stroke={stem}
        strokeWidth={small ? 6 : 5}
        strokeLinecap="round"
      />
    </svg>
  )
}
