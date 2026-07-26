'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from './Icon'
import { Avatar, SpaceDot } from './ui'
import { Mark } from './Mark'
import { UserMenu } from './UserMenu'
import { usePrefs } from './Prefs'
import { SPACES, TABLES } from '@/lib/tables'
import { resolveTheme } from '@/lib/prefs'
import type { SettingsSection } from './SettingsDialog'
import type { MyProfile } from '@/server/queries'
import type { TableId } from '@/lib/types'

export function Sidebar({
  counts, memberName, profile, onOpenPalette, onOpenSettings,
}: {
  counts: Partial<Record<TableId, number>>
  memberName: string
  profile: MyProfile | null
  onOpenPalette: () => void
  onOpenSettings: (section: SettingsSection) => void
}) {
  const pathname = usePathname()
  const { prefs, set, ready } = usePrefs()
  const [collapsed, setCollapsed] = useState(false)
  const [open, setOpen] = useState<string[]>(['sales'])
  const [menuOpen, setMenuOpen] = useState(false)

  // The stored preference is the starting state, not a lock: collapsing the
  // sidebar for one screen should not rewrite the default.
  useEffect(() => {
    if (ready) setCollapsed(prefs.sidebarCollapsed)
  }, [ready, prefs.sidebarCollapsed])

  const toggleSpace = (id: string) =>
    setOpen((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const dark = resolveTheme(prefs.theme) === 'dark'
  const toggleTheme = () => set('theme', dark ? 'light' : 'dark')

  return (
    <aside className={`sb ${collapsed ? 'collapsed' : ''}`}>
      <div className="ws">
        <div className="ws-mark"><Mark size={18} variant="onBrand" /></div>
        <div className="hide-c" style={{ minWidth: 0 }}>
          <div className="ws-name">Atelier</div>
          <div className="ws-plan">Workspace</div>
        </div>
        <button className="ws-more hide-c" onClick={toggleTheme} title="Toggle theme">
          <Icon name={dark ? 'sun' : 'moon'} size={15} />
        </button>
      </div>

      <button className="sb-search hide-c" onClick={onOpenPalette}>
        <Icon name="search" size={14} />
        <span>Search…</span>
        <span className="kbd">⌘K</span>
      </button>

      <div className="sb-scroll">
        <Link href="/home" className={`nav-i ${pathname === '/home' ? 'active' : ''}`}>
          <span className="ic"><Icon name="home" size={15} /></span>
          <span className="hide-c">Home</span>
        </Link>
        <Link href="/my-work" className={`nav-i ${pathname === '/my-work' ? 'active' : ''}`}>
          <span className="ic"><Icon name="check" size={15} /></span>
          <span className="hide-c">My work</span>
        </Link>

        <Link href="/import" className={`nav-i ${pathname === '/import' ? 'active' : ''}`}>
          <span className="ic"><Icon name="arrow" size={15} /></span>
          <span className="hide-c">Import data</span>
        </Link>

        <div className="sb-sec hide-c">Spaces</div>

        {SPACES.map((space) => (
          <div className={`space ${open.includes(space.id) ? 'open' : ''}`} key={space.id}>
            <button className="space-h" onClick={() => toggleSpace(space.id)}>
              <span className="space-c"><Icon name="chev" size={13} /></span>
              <SpaceDot color={space.color} icon={space.icon} letter={space.abbr} />
              <span className="space-n hide-c">{space.name}</span>
            </button>
            <div className="space-body">
              {space.tables.map((id) => {
                const table = TABLES[id as TableId]
                const href = `/table/${id}`
                return (
                  <Link href={href} key={id} className={`nav-i ${pathname === href ? 'active' : ''}`}>
                    <span className="ic"><Icon name={table.icon} size={14} /></span>
                    <span className="hide-c">{table.name}</span>
                    {counts[id as TableId] !== undefined ? (
                      <span className="cnt hide-c">{counts[id as TableId]}</span>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="sb-foot">
        <button
          className="sb-me"
          onClick={() => setMenuOpen((v) => !v)}
          title="Profile and settings"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <Avatar name={memberName} size={24} />
          <span className="nm hide-c">{memberName}</span>
          <span className="hide-c" style={{ marginLeft: 'auto', color: 'var(--nav-ink-2)' }}>
            <Icon name="chev" size={13} />
          </span>
        </button>
        <button className="icon-btn" onClick={() => setCollapsed((c) => !c)} title="Collapse sidebar">
          <Icon name="panelL" size={15} />
        </button>

        {menuOpen ? (
          <UserMenu
            profile={profile}
            memberName={memberName}
            onClose={() => setMenuOpen(false)}
            onOpenSettings={(section) => {
              setMenuOpen(false)
              onOpenSettings(section)
            }}
          />
        ) : null}
      </div>
    </aside>
  )
}
