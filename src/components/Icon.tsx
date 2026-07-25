const PATHS: Record<string, string> = {
  search: 'M7 1a6 6 0 104.47 10.03l3.25 3.25a.75.75 0 101.06-1.06l-3.25-3.25A6 6 0 007 1zM2.5 7a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0z',
  chev: 'M6 3.5L10.5 8 6 12.5',
  plus: 'M8 3v10M3 8h10',
  home: 'M8 1.7L1.8 6.5V14h4.4v-3.8h3.6V14h4.4V6.5z',
  grid: 'M2 2.5h12v11H2zM2 6h12M2 9.75h12M6.2 2.5v11',
  board: 'M2 2.5h3.4v11H2zM6.3 2.5h3.4v7.6H6.3zM10.6 2.5H14v9.4h-3.4z',
  timeline: 'M2 4h7M2 8h11M2 12h5',
  filter: 'M2 3.5h12l-4.6 5.2V13l-2.8 1.3V8.7z',
  sort: 'M4 12.5V3.5M4 3.5L1.8 5.8M4 3.5l2.2 2.3M12 3.5v9M12 12.5l-2.2-2.3M12 12.5l2.2-2.3',
  group: 'M2 3.5h12M4.5 8h9.5M7 12.5h7',
  hide: 'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z|M8 6a2 2 0 100 4 2 2 0 000-4z',
  rowh: 'M2 3h12M2 8h12M2 13h12',
  x: 'M4 4l8 8M12 4l-8 8',
  check: 'M3 8.2l3.2 3.3L13 4.5',
  expand: 'M9.5 2.5H13.5V6.5M6.5 13.5H2.5V9.5M13.5 2.5L9 7M2.5 13.5L7 9',
  bolt: 'M9 1.5L3.5 9h4l-.5 5.5L13 7H9z',
  users: 'M6 7.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4M11 3.2a2.3 2.3 0 010 4.6M12.2 10.3c1.5.5 2.3 1.7 2.3 3.7',
  moon: 'M13.5 9.4A5.8 5.8 0 016.6 2.5a5.8 5.8 0 106.9 6.9z',
  sun: 'M8 4.7a3.3 3.3 0 100 6.6 3.3 3.3 0 000-6.6zM8 .8v1.6M8 13.6v1.6M2.9 2.9l1.1 1.1M12 12l1.1 1.1M.8 8h1.6M13.6 8h1.6M2.9 13.1L4 12M12 4l1.1-1.1',
  panelL: 'M2 2.5h12v11H2zM6 2.5v11',
  link: 'M6.5 9.5a2.8 2.8 0 004 0l2-2a2.8 2.8 0 10-4-4l-1 1M9.5 6.5a2.8 2.8 0 00-4 0l-2 2a2.8 2.8 0 104 4l1-1',
  text: 'M3 4V2.8h10V4M8 2.8V13M6 13h4',
  sel: 'M8 1.5l6 3.2v6.6L8 14.5l-6-3.2V4.7z',
  num: 'M2.5 5.5h11M2.5 10.5h11M6.5 2l-1.5 12M11.5 2L10 14',
  date: 'M2.5 3.5h11v10.5h-11zM2.5 6.5h11M5.5 1.8v3M10.5 1.8v3',
  user: 'M8 8a3 3 0 100-6 3 3 0 000 6zM2.5 14.5c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8',
  pct: 'M3.5 12.5l9-9M4.8 6.3a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zM11.2 13.3a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z',
  chk: 'M2.5 2.5h11v11h-11zM5 8.2l2.2 2.3L11 5.8',
  bell: 'M8 1.8a4.2 4.2 0 00-4.2 4.2c0 4-1.8 5.2-1.8 5.2h12s-1.8-1.2-1.8-5.2A4.2 4.2 0 008 1.8zM9.2 13.5a1.4 1.4 0 01-2.4 0',
  arrow: 'M3 8h10M9.5 4.5L13 8l-3.5 3.5',
  clock: 'M8 1.8a6.2 6.2 0 100 12.4A6.2 6.2 0 008 1.8zM8 4.5V8l2.5 1.5',
  warn: 'M8 1.8L14.7 13.5H1.3zM8 6.2v3.4M8 11.5h.01',
  target: 'M8 1.8a6.2 6.2 0 100 12.4A6.2 6.2 0 008 1.8zM8 5.2a2.8 2.8 0 100 5.6 2.8 2.8 0 000-5.6z',
  euro: 'M12 3.6A4.7 4.7 0 004.6 8 4.7 4.7 0 0012 12.4M2.6 6.6h5M2.6 9.4h5',
  logout: 'M6 14H3.5a1 1 0 01-1-1V3a1 1 0 011-1H6M10.5 11L14 8l-3.5-3M14 8H6',
  google: 'M15 8.16c0-.51-.05-1-.13-1.48H8v2.8h3.93a3.36 3.36 0 01-1.46 2.2v1.83h2.36C14.21 12.2 15 10.36 15 8.16z|M8 15.5c1.97 0 3.63-.65 4.83-1.77l-2.36-1.83c-.65.44-1.49.7-2.47.7-1.9 0-3.5-1.28-4.08-3H1.48v1.89A7.5 7.5 0 008 15.5z|M3.92 9.6a4.5 4.5 0 010-2.87V4.84H1.48a7.5 7.5 0 000 6.65L3.92 9.6z|M8 3.4c1.07 0 2.03.37 2.79 1.09l2.09-2.09C11.62.87 9.96.17 8 .17a7.5 7.5 0 00-6.52 3.8L3.92 5.86C4.5 4.13 6.1 3.4 8 3.4z',
  mail: 'M1.8 4.2h12.4v8H1.8zM1.8 4.6l6.2 4.3 6.2-4.3',
}

export const FIELD_ICON: Record<string, string> = {
  text: 'text', longtext: 'text', select: 'sel', multi: 'sel', link: 'link', user: 'user',
  currency: 'euro', number: 'num', percent: 'pct', date: 'date', check: 'chk',
  flag: 'warn', progress: 'pct', duration: 'clock',
}

export function Icon({ name, size = 15 }: { name: string; size?: number }) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg
      width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden
    >
      {d.split('|').map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  )
}
