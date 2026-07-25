'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Icon } from './Icon'
import { Avatar, SpaceDot } from './ui'
import { SPACES, TABLES } from '@/lib/tables'
import type { TableId } from '@/lib/types'

export function Sidebar({
  counts, memberName, onOpenPalette,
}: {
  counts: Partial<Record<TableId, number>>
  memberName: string
  onOpenPalette: () => void
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [open, setOpen] = useState<string[]>(['sales'])
  const [dark, setDark] = useState(false)

  const toggleSpace = (id: string) =>
    setOpen((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
  }

  return (
    <aside className={`sb ${collapsed ? 'collapsed' : ''}`}>
      <div className="ws">
        <div className="ws-mark">A</div>
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
              <SpaceDot color={space.color} letter={space.abbr} />
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
        <Avatar name={memberName} size={24} />
        <div className="nm hide-c">{memberName}</div>
        <button
          className="icon-btn hide-c"
          style={{ marginLeft: 'auto' }}
          onClick={() => signOut({ callbackUrl: '/login' })}
          title="Sign out"
        >
          <Icon name="logout" size={15} />
        </button>
        <button className="icon-btn" onClick={() => setCollapsed((c) => !c)} title="Collapse sidebar">
          <Icon name="panelL" size={15} />
        </button>
      </div>
    </aside>
  )
}
