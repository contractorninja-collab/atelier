'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { Icon } from './Icon'
import { Avatar, Pill } from './ui'
import { usePrefs } from './Prefs'
import { TABLES, optionFor } from '@/lib/tables'
import type { ThemeChoice } from '@/lib/prefs'
import type { MyProfile } from '@/server/queries'

const THEMES: { value: ThemeChoice; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'Auto', icon: 'bolt' },
]

export function UserMenu({
  profile, memberName, onOpenSettings, onClose,
}: {
  profile: MyProfile | null
  memberName: string
  onOpenSettings: (section: 'profile' | 'preferences' | 'account') => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { prefs, set } = usePrefs()

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    // Defer so the click that opened the menu does not immediately close it.
    const id = setTimeout(() => document.addEventListener('mousedown', onDocClick), 0)
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const roleOption = profile
    ? optionFor({ options: TABLES.team.fields.find((f) => f.id === 'role')?.options }, profile.role)
    : undefined

  return (
    <div className="usermenu" ref={ref}>
      <div className="um-head">
        <Avatar name={memberName} size={38} />
        <div style={{ minWidth: 0 }}>
          <div className="um-name">{memberName}</div>
          <div className="um-mail">{profile?.email ?? ''}</div>
        </div>
      </div>

      {roleOption ? (
        <div style={{ padding: '0 12px 10px' }}>
          <Pill option={roleOption} />
        </div>
      ) : null}

      <div className="um-sep" />

      <button className="menu-i" onClick={() => onOpenSettings('profile')}>
        <Icon name="user" size={14} />
        <span>Profile</span>
      </button>
      <button className="menu-i" onClick={() => onOpenSettings('preferences')}>
        <Icon name="sel" size={14} />
        <span>Preferences</span>
      </button>
      <button className="menu-i" onClick={() => onOpenSettings('account')}>
        <Icon name="bolt" size={14} />
        <span>Account</span>
      </button>

      <div className="um-sep" />

      <div className="menu-l">Theme</div>
      <div className="um-seg">
        {THEMES.map((t) => (
          <button
            key={t.value}
            className={`um-segbtn ${prefs.theme === t.value ? 'on' : ''}`}
            onClick={() => set('theme', t.value)}
            title={t.value === 'system' ? 'Follow the operating system' : t.label}
          >
            <Icon name={t.icon} size={13} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="um-sep" />

      <Link className="menu-i" href="/table/team" onClick={onClose}>
        <Icon name="users" size={14} />
        <span>Manage team</span>
      </Link>
      <Link className="menu-i" href="/health" onClick={onClose}>
        <Icon name="warn" size={14} />
        <span>Health check</span>
      </Link>

      <div className="um-sep" />

      <button className="menu-i danger" onClick={() => signOut({ callbackUrl: '/login' })}>
        <Icon name="logout" size={14} />
        <span>Sign out</span>
      </button>
    </div>
  )
}
