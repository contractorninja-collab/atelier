'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Icon } from './Icon'
import { Avatar } from './ui'
import { usePrefs } from './Prefs'
import { updateMyProfile } from '@/server/actions'
import { TABLES } from '@/lib/tables'
import { ROW_HEIGHTS, type ThemeChoice } from '@/lib/prefs'
import type { MyProfile } from '@/server/queries'
import { attempt } from '@/lib/attempt'

export type SettingsSection = 'profile' | 'preferences' | 'account'

const SECTIONS: { id: SettingsSection; label: string; icon: string }[] = [
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'preferences', label: 'Preferences', icon: 'sel' },
  { id: 'account', label: 'Account', icon: 'bolt' },
]

/** Role, department and status come from the Team table config, not a second list. */
const teamOptions = (fieldId: string) =>
  TABLES.team.fields.find((f) => f.id === fieldId)?.options ?? []

export function SettingsDialog({
  profile, section, onSection, onClose,
}: {
  profile: MyProfile | null
  section: SettingsSection
  onSection: (s: SettingsSection) => void
  onClose: () => void
}) {
  return (
    <>
      <div className="scrim on" onClick={onClose} />
      <div className="settings" role="dialog" aria-label="Settings">
        <nav className="st-nav">
          <div className="st-title">Settings</div>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`st-navi ${section === s.id ? 'on' : ''}`}
              onClick={() => onSection(s.id)}
            >
              <Icon name={s.icon} size={14} />
              <span>{s.label}</span>
            </button>
          ))}
          <div style={{ marginTop: 'auto', padding: 10 }}>
            <Link prefetch={false} className="st-link" href="/table/team" onClick={onClose}>
              Manage the whole team →
            </Link>
          </div>
        </nav>

        <div className="st-body">
          <button className="icon-btn st-x" onClick={onClose} title="Close">
            <Icon name="x" size={15} />
          </button>
          {section === 'profile' ? <ProfileSection profile={profile} /> : null}
          {section === 'preferences' ? <PreferencesSection /> : null}
          {section === 'account' ? <AccountSection profile={profile} /> : null}
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ profile */

function ProfileSection({ profile }: { profile: MyProfile | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Plain strings rather than the column's enum union: the <select> hands back a
  // string, and the server validates it against the same option set anyway.
  const [form, setForm] = useState<{
    name: string
    role: string
    department: string
    status: string
    weeklyCapacityHours: number
    timezone: string
    squad: string
    startDate: string
  }>({
    name: profile?.name ?? '',
    role: profile?.role ?? 'Engineer',
    department: profile?.department ?? 'Delivery',
    status: profile?.status ?? 'Active',
    weeklyCapacityHours: profile?.weeklyCapacityHours ?? 40,
    timezone: profile?.timezone ?? '',
    squad: profile?.squad ?? '',
    startDate: profile?.startDate ?? '',
  })

  if (!profile) {
    return (
      <Section title="Profile" hint="Your row in the Team table.">
        <p className="st-note">
          Your sign-in is not linked to a team member, so there is no profile to edit.
          That happens when the Team row's email no longer matches the address you
          signed in with.
        </p>
      </Section>
    )
  }

  const field = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  const save = () => {
    setError(null)
    startTransition(async () => {
      const result = await attempt(() => updateMyProfile({
        name: form.name,
        role: form.role,
        department: form.department,
        status: form.status,
        weeklyCapacityHours: Number(form.weeklyCapacityHours),
        timezone: form.timezone.trim() || null,
        squad: form.squad.trim() || null,
        startDate: form.startDate || null,
      }))
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSaved(true)
      // The sidebar name and every owner cell read this row, so refresh the tree.
      router.refresh()
    })
  }

  return (
    <Section title="Profile" hint="Your row in the Team table. The whole house sees this.">
      <div className="st-avrow">
        <Avatar name={form.name || profile.name} size={54} />
        <div>
          <div className="st-avname">{form.name || profile.name}</div>
          <div className="st-note" style={{ margin: 0 }}>
            Initials and colour are derived from your name — there is no avatar
            upload, because nothing here stores files yet.
          </div>
        </div>
      </div>

      <Row label="Full name">
        <input
          type="text" value={form.name} maxLength={80}
          onChange={(e) => field('name', e.target.value)}
        />
      </Row>

      <Row label="Role">
        <select value={form.role} onChange={(e) => field('role', e.target.value)}>
          {teamOptions('role').map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Row>

      <Row label="Department">
        <select value={form.department} onChange={(e) => field('department', e.target.value)}>
          {teamOptions('department').map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Row>

      <Row label="Status">
        <select value={form.status} onChange={(e) => field('status', e.target.value)}>
          {teamOptions('status').map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Row>

      <Row label="Capacity" hint="Hours a week. Every utilisation figure divides by this.">
        <input
          type="number" min={0} max={80} value={form.weeklyCapacityHours}
          onChange={(e) => field('weeklyCapacityHours', Number(e.target.value))}
        />
      </Row>

      <Row label="Timezone">
        <input
          type="text" value={form.timezone} placeholder="Europe/Warsaw"
          onChange={(e) => field('timezone', e.target.value)}
        />
      </Row>

      <Row label="Squad" hint="Free text until there are enough people for squads to mean something.">
        <input
          type="text" value={form.squad} placeholder="—"
          onChange={(e) => field('squad', e.target.value)}
        />
      </Row>

      <Row label="Start date">
        <input
          type="date" value={form.startDate}
          onChange={(e) => field('startDate', e.target.value)}
        />
      </Row>

      {error ? <p className="st-err">{error}</p> : null}

      <div className="st-actions">
        <button className="btn pri" onClick={save} disabled={pending || form.name.trim().length < 2}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        {saved && !pending ? (
          <span className="st-ok"><Icon name="check" size={13} /> Saved</span>
        ) : null}
      </div>
    </Section>
  )
}

/* -------------------------------------------------------------- preferences */

function PreferencesSection() {
  const { prefs, set, reset } = usePrefs()

  return (
    <Section
      title="Preferences"
      hint="How this browser draws the workspace. Stored locally, so they do not follow you to another machine."
    >
      <Row label="Theme">
        <div className="st-choice">
          {(['light', 'dark', 'system'] as ThemeChoice[]).map((t) => (
            <button
              key={t}
              className={`chipbtn ${prefs.theme === t ? 'on' : ''}`}
              onClick={() => set('theme', t)}
            >
              {t === 'system' ? 'Match system' : t === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
      </Row>

      <Row label="Row height" hint="The default every grid opens at.">
        <div className="st-choice">
          {ROW_HEIGHTS.map((h) => (
            <button
              key={h.value}
              className={`chipbtn ${prefs.rowHeight === h.value ? 'on' : ''}`}
              onClick={() => set('rowHeight', h.value)}
            >
              {h.label}
            </button>
          ))}
        </div>
      </Row>

      <Row label="Sidebar" hint="Start collapsed to give the grid more room.">
        <Toggle
          on={prefs.sidebarCollapsed}
          onChange={(v) => set('sidebarCollapsed', v)}
          label="Start collapsed"
        />
      </Row>

      <Row label="Bulk delete" hint="Ask before deleting more than one record at a time.">
        <Toggle
          on={prefs.confirmDeletes}
          onChange={(v) => set('confirmDeletes', v)}
          label="Confirm first"
        />
      </Row>

      <div className="st-actions">
        <button className="btn out" onClick={reset}>Reset to defaults</button>
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ account */

function AccountSection({ profile }: { profile: MyProfile | null }) {
  return (
    <Section title="Account" hint="Who the app thinks you are, and how you got in.">
      <Row label="Email">
        <input type="text" value={profile?.email ?? '—'} readOnly disabled />
      </Row>
      <p className="st-note">
        Not editable here, on purpose. This address is the join between your
        sign-in and your Team row — change it and the session stops finding you.
        Because sign-in is invite-only, on a deployed instance that locks you out
        rather than just logging you out. If it genuinely has to change, edit the
        Team row and the address you sign in with together.
      </p>

      <Row label="Member ID">
        <input type="text" value={profile?.id ?? '—'} readOnly disabled />
      </Row>

      <div className="st-actions">
        <button className="btn out" onClick={() => signOut({ callbackUrl: '/login' })}>
          <Icon name="logout" size={14} /> Sign out
        </button>
      </div>

      <p className="st-note">
        There is no password to change: Atelier signs you in with a magic link or
        Google, so credentials live with those providers. <Link prefetch={false} className="st-link" href="/health">
        The health check</Link> reports which providers are actually configured.
      </p>
    </Section>
  )
}

/* -------------------------------------------------------------------- parts */

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="st-sec">
      <h2 className="st-h">{title}</h2>
      <p className="st-hint">{hint}</p>
      {children}
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="st-row">
      <div className="st-lab">
        {label}
        {hint ? <span className="st-labhint">{hint}</span> : null}
      </div>
      <div className="st-ctl">{children}</div>
    </div>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button className="st-toggle" onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className={`st-track ${on ? 'on' : ''}`}><span className="st-knob" /></span>
      <span>{label}</span>
    </button>
  )
}
