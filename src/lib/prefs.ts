/**
 * Per-person, per-browser display preferences.
 *
 * The split that matters: anything describing *the person* — their name, role,
 * capacity, timezone — is a Team row and goes through a server action, because
 * the rest of the house needs to see it. Anything describing *how this browser
 * renders the workspace* lives here, in localStorage. A theme choice that needs
 * a migration and a round trip to change is a theme choice nobody changes.
 *
 * Consequence worth knowing: these do not follow you to another machine.
 */

export type ThemeChoice = 'light' | 'dark' | 'system'

export type Prefs = {
  theme: ThemeChoice
  /** Grid row height in px. Matches the options in the Height menu. */
  rowHeight: number
  /** Where the workspace opens. */
  landing: '/home' | '/my-work'
  sidebarCollapsed: boolean
  /** Ask before a bulk delete. Off is for people who know what they are doing. */
  confirmDeletes: boolean
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'system',
  rowHeight: 36,
  landing: '/home',
  sidebarCollapsed: false,
  confirmDeletes: true,
}

export const PREFS_KEY = 'atelier.prefs'

export const ROW_HEIGHTS = [
  { value: 32, label: 'Short' },
  { value: 36, label: 'Medium' },
  { value: 46, label: 'Tall' },
  { value: 60, label: 'Extra tall' },
]

export function readPrefs(): Prefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    // Spread over the defaults so a preference added in a later release does not
    // arrive as undefined for everyone who already has a stored blob.
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) }
  } catch {
    // Private browsing, a full quota or a corrupt blob must not take the app
    // down over a row height.
    return DEFAULT_PREFS
  }
}

export function writePrefs(prefs: Prefs): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* Preferences are a nicety; failing to store them is not an error. */
  }
}

export function resolveTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice !== 'system') return choice
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(choice: ThemeChoice): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', resolveTheme(choice))
}

/**
 * Runs in <head> before first paint, so a dark-theme user does not get a white
 * flash on every navigation. Inlined as a string because it has to execute
 * before React hydrates — the same reason it duplicates the small amount of
 * logic above rather than importing it.
 */
export const THEME_BOOTSTRAP = `(function(){try{
var p=JSON.parse(localStorage.getItem('${PREFS_KEY}')||'{}');
var t=p.theme||'${DEFAULT_PREFS.theme}';
if(t==='system'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
document.documentElement.setAttribute('data-theme',t);
}catch(e){}})();`
