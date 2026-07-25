'use client'

import { useEffect, useRef } from 'react'
import { Icon } from './Icon'
import { tint } from '@/lib/format'

export type MenuItem = {
  value: string
  label: string
  color?: string
  checked?: boolean
  icon?: string
}

export type MenuState = {
  x: number
  y: number
  title?: string
  items: MenuItem[]
  onPick: (value: string) => void
} | null

export function Menu({ state, onClose }: { state: MenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!state) return
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
  }, [state, onClose])

  if (!state) return null

  const left = Math.min(state.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 240)
  const top = Math.min(state.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 300)

  return (
    <div className="menu" ref={ref} style={{ left, top }}>
      {state.title ? <div className="menu-l">{state.title}</div> : null}
      {state.items.map((item) => (
        <button
          key={item.value}
          className={`menu-i ${item.checked ? 'on' : ''}`}
          onClick={() => {
            state.onPick(item.value)
            onClose()
          }}
        >
          {item.color ? (
            <span className="pill" style={{ background: tint(item.color, 0.15), color: item.color }}>
              {item.label}
            </span>
          ) : (
            <>
              {item.icon ? <Icon name={item.icon} size={13} /> : null}
              <span>{item.label}</span>
            </>
          )}
          {item.checked ? (
            <span style={{ marginLeft: 'auto' }}><Icon name="check" size={12} /></span>
          ) : null}
        </button>
      ))}
      {state.items.length === 0 ? <div className="menu-l">No options</div> : null}
    </div>
  )
}
