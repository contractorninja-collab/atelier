/** Formatting helpers. Money is cents in, string out — never the reverse. */

const EUR = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})
const NUM = new Intl.NumberFormat('en-IE')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  return EUR.format(cents / 100)
}

export function number(n: number | null | undefined): string {
  if (n === null || n === undefined) return ''
  return NUM.format(n)
}

/** Basis points to a display percentage. 1250 -> "12.5%" */
export function bps(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const pct = value / 100
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`
}

/** Minutes to a readable hour figure: 450 -> "7.5 h" */
export function hours(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return ''
  const h = minutes / 60
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`
}

export function shortDate(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(`${value.slice(0, 10)}T00:00:00`) : value
  if (Number.isNaN(d.getTime())) return ''
  const thisYear = new Date().getFullYear()
  const year = d.getFullYear() === thisYear ? '' : ` ${String(d.getFullYear()).slice(2)}`
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year}`
}

export function daysBetween(from: string | Date, to: string | Date = new Date()): number {
  const a = typeof from === 'string' ? new Date(from) : from
  const b = typeof to === 'string' ? new Date(to) : to
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

export function toISODate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/** Split a CamelCase enum value into words: "SolutionFit" -> "Solution Fit" */
export function humanise(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2')
}

export function initials(name: string): string {
  return name
    .split(/[\s—-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

const AVATAR_COLORS = ['#7c6cf0', '#0e9f6e', '#e0a020', '#3b93e0', '#e2597a', '#12a5a5', '#d97757', '#8b5cf6']

export function avatarColor(name: string): string {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

/** Translate a hex colour into a translucent background of the same hue. */
export function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** Normalise a domain for deduplication: strip protocol, www and trailing slash. */
export function normaliseDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
}
