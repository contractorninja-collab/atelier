'use client'

import { useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { CommandPalette } from './CommandPalette'
import { PrefsProvider } from './Prefs'
import { SettingsDialog, type SettingsSection } from './SettingsDialog'
import type { MyProfile } from '@/server/queries'
import type { TableId } from '@/lib/types'

export function Shell({
  counts, memberName, profile, index, children,
}: {
  counts: Partial<Record<TableId, number>>
  memberName: string
  profile: MyProfile | null
  index: Record<string, { id: string; label: string }[]>
  children: React.ReactNode
}) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settings, setSettings] = useState<SettingsSection | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
      // Comma is the settings shortcut everywhere else; match it.
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setSettings((s) => s ?? 'profile')
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <PrefsProvider>
      <div className="app">
        <Sidebar
          counts={counts}
          memberName={memberName}
          profile={profile}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenSettings={setSettings}
        />
        <main className="main">{children}</main>
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} index={index} />
        {settings ? (
          <SettingsDialog
            profile={profile}
            section={settings}
            onSection={setSettings}
            onClose={() => setSettings(null)}
          />
        ) : null}
      </div>
    </PrefsProvider>
  )
}
