'use client'

import { useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { CommandPalette } from './CommandPalette'
import type { TableId } from '@/lib/types'

export function Shell({
  counts, memberName, index, children,
}: {
  counts: Partial<Record<TableId, number>>
  memberName: string
  index: Record<string, { id: string; label: string }[]>
  children: React.ReactNode
}) {
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <Sidebar counts={counts} memberName={memberName} onOpenPalette={() => setPaletteOpen(true)} />
      <main className="main">{children}</main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} index={index} />
    </div>
  )
}
