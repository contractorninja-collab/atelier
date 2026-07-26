import { ImageResponse } from 'next/og'

/**
 * Apple touch icon.
 *
 * Generated rather than shipped as a file because Next's `apple-icon` convention
 * accepts PNG and JPEG only — an `apple-icon.svg` is silently ignored and the
 * route 404s. ImageResponse is part of Next, so this costs no new dependency.
 *
 * The mark is drawn with boxes rather than an SVG path: Satori's SVG support is
 * partial, and a ring is a bordered circle and a stem is a rounded rectangle.
 * Geometry is the 32×32 mark scaled by 180/32 — ring centre (14.5, 16) r 9.5,
 * stem x 26.5 from y 12.5 to 26.5, both stroke 5.
 */
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

const S = 180 / 32
const STROKE = 5 * S
const RING_OUTER = (9.5 + 2.5) * 2 * S

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: '#0f6b73',
        }}
      >
        {/* ring */}
        <div
          style={{
            position: 'absolute',
            left: 14.5 * S - RING_OUTER / 2,
            top: 16 * S - RING_OUTER / 2,
            width: RING_OUTER,
            height: RING_OUTER,
            borderRadius: RING_OUTER,
            border: `${STROKE}px solid #f2f7f8`,
          }}
        />
        {/* stem — the round cap extends half a stroke past each endpoint */}
        <div
          style={{
            position: 'absolute',
            left: 26.5 * S - STROKE / 2,
            top: 12.5 * S - STROKE / 2,
            width: STROKE,
            height: (26.5 - 12.5) * S + STROKE,
            borderRadius: STROKE,
            background: '#e2a63a',
          }}
        />
      </div>
    ),
    size,
  )
}
