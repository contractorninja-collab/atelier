/**
 * Brand colours as literals, for the few places that cannot use a CSS variable:
 * `tint()` parses hex, and a couple of colours are chosen in JS before they
 * reach a style attribute.
 *
 * Everywhere else use the tokens — var(--brand), var(--accent), var(--danger).
 * Keep this in step with the ramp at the top of globals.css.
 */
export const BRAND = {
  petrol: '#0f6b73',
  petrolTint: '#7fd0cb',
  saffron: '#e2a63a',
  saffron600: '#c68a24',
  danger: '#c2415f',
  /**
   * Healthy / positive status. Deliberately a true green rather than petrol, so
   * a "good" pill reads as a status and not as brand chrome — petrol is doing
   * enough work carrying every interactive state.
   */
  success: '#1c8c5a',
  ink: '#0a1618',
} as const

/** Project health is a traffic light; the enum names are Green / Amber / Red. */
export const HEALTH_COLOUR: Record<string, string> = {
  Green: BRAND.success,
  Amber: BRAND.saffron,
  Red: BRAND.danger,
}
