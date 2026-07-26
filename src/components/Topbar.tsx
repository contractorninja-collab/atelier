import { Icon } from './Icon'
import { SpaceDot } from './ui'

export function Topbar({
  crumbs = [], title, right,
}: {
  crumbs?: { label: string; color?: string; abbr?: string; icon?: string }[]
  title: string
  right?: React.ReactNode
}) {
  return (
    <div className="topbar">
      <div className="crumb">
        {crumbs.map((c) => (
          <span key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {c.color && (c.icon || c.abbr) ? <SpaceDot color={c.color} icon={c.icon} letter={c.abbr} /> : null}
            <span>{c.label}</span>
            <Icon name="chev" size={12} />
          </span>
        ))}
        <span className="cur">{title}</span>
      </div>
      {right ? <div className="tb-r">{right}</div> : null}
    </div>
  )
}
