'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from './Icon'
import { IMPORT_SHAPES } from '@/lib/csv'
import { BRAND } from '@/lib/brand'
import { deleteSeedData, previewImport, runImport, templateFor, type ImportPreview, type ImportResult } from '@/server/import'

const SHAPES = ['organizations', 'contacts', 'deals'] as const

export function ImportWorkspace({ counts }: { counts: Record<string, number> }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [shape, setShape] = useState<(typeof SHAPES)[number]>('organizations')
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const shapeInfo = IMPORT_SHAPES[shape]

  const reset = () => { setPreview(null); setResult(null); setError(null) }

  function check() {
    reset()
    startTransition(async () => {
      const out = await previewImport(shape, csv)
      if ('error' in out) setError(out.error)
      else setPreview(out)
    })
  }

  function commit() {
    startTransition(async () => {
      const out = await runImport(shape, csv)
      if ('error' in out) setError(out.error)
      else { setResult(out); setPreview(null); router.refresh() }
    })
  }

  async function downloadTemplate() {
    const text = await templateFor(shape)
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `atelier-${shape}-template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then((text) => { setCsv(text); reset() })
  }

  return (
    <div className="content">
      <div className="dash" style={{ maxWidth: 1080 }}>
        <h3>What to import</h3>
        <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
          {SHAPES.map((id) => (
            <button
              key={id}
              className="kpi"
              onClick={() => { setShape(id); reset() }}
              style={{
                textAlign: 'left',
                borderColor: shape === id ? 'var(--brand)' : 'var(--line)',
                boxShadow: shape === id ? '0 0 0 3px var(--brand-ring)' : undefined,
              }}
            >
              <div className="l">{IMPORT_SHAPES[id].label}</div>
              <div className="v" style={{ fontSize: 21 }}>{counts[id] ?? 0}</div>
              <div className="d">already in Atelier</div>
            </button>
          ))}
        </div>

        <h3>Columns {shapeInfo.label.toLowerCase()} accepts</h3>
        <div className="pnl">
          <div className="pnl-b">
            <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
              {shapeInfo.note} Column order does not matter and headers are matched loosely, so
              “Company Name”, “company_name” and “companyname” all work.
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              {shapeInfo.fields.map((f) => (
                <div key={f.key} style={{ display: 'flex', gap: 12, alignItems: 'baseline', fontSize: 12.5 }}>
                  <code style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 11.5, background: 'var(--bg-3)',
                    padding: '2px 7px', borderRadius: 5, minWidth: 150,
                  }}>
                    {f.aliases[0]}
                  </code>
                  <span style={{ fontWeight: 570, minWidth: 110 }}>
                    {f.label}
                    {f.required ? <span style={{ color: 'var(--danger)' }}> *</span> : null}
                  </span>
                  <span style={{ color: 'var(--ink-3)' }}>{f.hint ?? ''}</span>
                </div>
              ))}
            </div>
            <button className="btn out sm" style={{ marginTop: 16 }} onClick={downloadTemplate}>
              <Icon name="arrow" size={14} />Download a template CSV
            </button>
          </div>
        </div>

        <h3>Paste or upload</h3>
        <div className="pnl">
          <div className="pnl-b">
            <textarea
              value={csv}
              onChange={(e) => { setCsv(e.target.value); reset() }}
              placeholder={'name,domain,lifecycle\nAcme Logistics,acme.com,Lead'}
              spellCheck={false}
              style={{
                width: '100%', minHeight: 170, fontFamily: 'ui-monospace, monospace', fontSize: 12,
                padding: 12, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg-2)',
                color: 'var(--ink)', outline: 'none', resize: 'vertical', lineHeight: 1.6,
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
              <button className="btn out sm" onClick={() => fileRef.current?.click()}>
                <Icon name="plus" size={14} />Choose a .csv file
              </button>
              <button className="btn pri sm" onClick={check} disabled={pending || csv.trim().length === 0}>
                {pending ? 'Checking…' : 'Check the file'}
              </button>
              {csv ? (
                <button className="btn sm" onClick={() => { setCsv(''); reset() }}>Clear</button>
              ) : null}
            </div>
          </div>
        </div>

        {error ? (
          <div className="pnl" style={{ marginTop: 13, borderColor: 'rgba(226,89,122,0.4)' }}>
            <div className="pnl-b" style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>
          </div>
        ) : null}

        {preview ? (
          <>
            <h3>What will happen</h3>
            <div className="pnl">
              <div className="pnl-b">
                <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 16 }}>
                  <div className="kpi"><div className="l">Rows found</div><div className="v" style={{ fontSize: 22 }}>{preview.total}</div></div>
                  <div className="kpi"><div className="l">Will import</div><div className="v" style={{ fontSize: 22, color: 'var(--brand)' }}>{preview.valid}</div></div>
                  <div className="kpi"><div className="l">Will be skipped</div><div className="v" style={{ fontSize: 22, color: preview.total - preview.valid > 0 ? 'var(--accent-600)' : undefined }}>{preview.total - preview.valid}</div></div>
                </div>

                {preview.missingRequired.length > 0 ? (
                  <p style={{ color: 'var(--danger)', fontSize: 12.5, margin: '0 0 14px' }}>
                    Missing required columns: <b>{preview.missingRequired.join(', ')}</b>. Nothing can be imported until
                    those are present.
                  </p>
                ) : null}

                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                  Column mapping
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                  {shapeInfo.fields.map((f) => (
                    <span
                      key={f.key}
                      className="pill"
                      style={
                        preview.mapping[f.key]
                          ? { background: 'rgba(28,140,90,0.15)', color: BRAND.success }
                          : { background: 'var(--bg-3)', color: 'var(--ink-3)' }
                      }
                    >
                      {f.label}
                      {preview.mapping[f.key] ? ' ✓' : f.required ? ' — missing' : ' — not in file'}
                    </span>
                  ))}
                </div>

                {preview.issues.length > 0 ? (
                  <>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                      Rows that will be skipped
                    </div>
                    <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 18 }}>
                      {preview.issues.map((issue) => (
                        <div key={issue.row} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--line-2)', fontSize: 12.5 }}>
                          <span style={{ color: 'var(--ink-3)', minWidth: 56 }}>Row {issue.row}</span>
                          <span style={{ color: 'var(--ink-2)' }}>{issue.message}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: 12.5, color: 'var(--brand)', margin: '0 0 18px' }}>
                    Every row passed validation.
                  </p>
                )}

                <button
                  className="btn pri"
                  onClick={commit}
                  disabled={pending || preview.valid === 0 || preview.missingRequired.length > 0}
                >
                  {pending ? 'Importing…' : `Import ${preview.valid} ${shapeInfo.label.toLowerCase()}`}
                </button>
              </div>
            </div>
          </>
        ) : null}

        {result ? (
          <>
            <h3>Done</h3>
            <div className="pnl">
              <div className="pnl-b">
                <p style={{ fontSize: 14, margin: '0 0 14px' }}>
                  Imported <b style={{ color: 'var(--brand)' }}>{result.inserted}</b>
                  {result.skipped > 0 ? <>, skipped <b>{result.skipped}</b></> : null}.
                </p>
                {result.issues.length > 0 ? (
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {result.issues.map((issue, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--line-2)', fontSize: 12.5 }}>
                        <span style={{ color: 'var(--ink-3)', minWidth: 56 }}>Row {issue.row}</span>
                        <span style={{ color: 'var(--ink-2)' }}>{issue.message}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        <h3>Clearing the demo data</h3>
        <div className="pnl">
          <div className="pnl-b">
            <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: '0 0 14px', lineHeight: 1.6 }}>
              Removes only the twelve demo companies the seed created, matched by their exact domains, along with
              their contacts, deals and projects. Anything you imported or typed yourself is untouched, as are your
              team members, products and sources.
            </p>
            <button
              className="btn out sm"
              onClick={() => startTransition(async () => {
                const out = await deleteSeedData()
                setError(out.ok ? null : out.message)
                if (out.ok) { setResult(null); router.refresh(); alert(out.message) }
              })}
              disabled={pending}
            >
              <Icon name="x" size={14} />Remove the demo companies
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
