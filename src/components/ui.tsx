import { avatarColor, initials, tint } from '@/lib/format'
import type { Option } from '@/lib/types'

export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <span
      className="av"
      style={{
        background: avatarColor(name),
        width: size,
        height: size,
        flexBasis: size,
        fontSize: Math.round(size * 0.42),
      }}
      title={name}
    >
      {initials(name)}
    </span>
  )
}

export function Pill({ option }: { option: Option }) {
  return (
    <span className="pill" style={{ background: tint(option.color, 0.15), color: option.color }}>
      {option.label}
    </span>
  )
}

export function SpaceDot({ color, letter, size = 16 }: { color: string; letter: string; size?: number }) {
  return (
    <span
      className="space-dot"
      style={{ background: color, width: size, height: size, flexBasis: size, fontSize: size * 0.6 }}
    >
      {letter}
    </span>
  )
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty">
      <div className="et">{title}</div>
      <div className="ed">{body}</div>
    </div>
  )
}
