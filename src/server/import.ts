'use server'

import { revalidatePath } from 'next/cache'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import * as t from '@/db/schema'
import { auth } from '@/auth'
import { normaliseDomain } from '@/lib/format'
import { IMPORT_SHAPES, mapColumns, parseCsv, toObjects } from '@/lib/csv'

export type RowIssue = { row: number; message: string }

export type ImportPreview = {
  shape: string
  headers: string[]
  mapping: Record<string, string | null>
  missingRequired: string[]
  total: number
  valid: number
  sample: Record<string, string>[]
  issues: RowIssue[]
}

export type ImportResult = {
  inserted: number
  skipped: number
  failed: number
  issues: RowIssue[]
}

const ENUMS = {
  lifecycle: t.lifecycleStage.enumValues as readonly string[],
  segment: t.segment.enumValues as readonly string[],
  persona: t.persona.enumValues as readonly string[],
  stage: t.dealStage.enumValues as readonly string[],
  dealType: t.dealType.enumValues as readonly string[],
}

function cell(row: Record<string, string>, mapping: Record<string, string | null>, key: string): string {
  const column = mapping[key]
  return column ? (row[column] ?? '').trim() : ''
}

/**
 * Parse and validate without writing anything. The point is to show people
 * exactly what will happen before it happens — a half-imported pipeline is
 * far more work to clean up than a rejected file.
 */
export async function previewImport(shape: string, csv: string): Promise<ImportPreview | { error: string }> {
  const session = await auth()
  if (!session?.user) return { error: 'Not signed in' }
  if (!(shape in IMPORT_SHAPES)) return { error: 'Unknown import type' }

  const table = parseCsv(csv)
  if (table.length < 2) return { error: 'Need a header row and at least one data row.' }

  const { headers, rows } = toObjects(table)
  const mapping = mapColumns(headers, shape)
  const fields = IMPORT_SHAPES[shape].fields
  const missingRequired = fields.filter((f) => f.required && !mapping[f.key]).map((f) => f.label)

  // Look up what already exists so the preview can say "will be skipped"
  // rather than promising an import that silently dedupes on the way in.
  const existingDomains = shape === 'organizations'
    ? new Set((await db.select({ domain: t.organizations.domain }).from(t.organizations)).map((o) => o.domain))
    : new Set<string>()
  const existingEmails = shape === 'contacts'
    ? new Set((await db.select({ email: t.contacts.email }).from(t.contacts)).map((c) => c.email.toLowerCase()))
    : new Set<string>()
  const knownCompanies = shape === 'contacts' || shape === 'deals'
    ? await db.select({ name: t.organizations.name, domain: t.organizations.domain }).from(t.organizations)
    : []
  const companyDomains = new Set(knownCompanies.map((o) => o.domain))
  const companyNames = new Set(knownCompanies.map((o) => o.name.toLowerCase()))

  const issues: RowIssue[] = []
  const seenInFile = new Set<string>()
  let valid = 0

  rows.forEach((row, index) => {
    const rowNumber = index + 2 // +1 for the header, +1 because humans count from one
    const problems: string[] = []

    for (const field of fields) {
      const value = cell(row, mapping, field.key)
      if (field.required && !value) problems.push(`${field.label} is empty`)
      if (!value) continue

      if (field.key === 'lifecycle' && !ENUMS.lifecycle.includes(value)) problems.push(`Lifecycle "${value}" is not a valid value`)
      if (field.key === 'segment' && !ENUMS.segment.includes(value)) problems.push(`Segment "${value}" is not a valid value`)
      if (field.key === 'persona' && !ENUMS.persona.includes(value)) problems.push(`Persona "${value}" is not a valid value`)
      if (field.key === 'stage' && !ENUMS.stage.includes(value)) problems.push(`Stage "${value}" is not a valid value`)
      if (field.key === 'type' && !ENUMS.dealType.includes(value)) problems.push(`Deal type "${value}" is not a valid value`)
      if (field.key === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) problems.push(`"${value}" is not an email address`)
      if (field.key === 'value' && Number.isNaN(Number(value.replace(/[^0-9.-]/g, '')))) problems.push(`Value "${value}" is not a number`)
      if (field.key === 'expectedCloseDate' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) problems.push(`Date "${value}" must be YYYY-MM-DD`)
    }

    // Duplicates, both against the database and within the file itself.
    if (shape === 'organizations') {
      const domain = normaliseDomain(cell(row, mapping, 'domain'))
      if (domain && existingDomains.has(domain)) problems.push(`${domain} already exists — will be skipped`)
      else if (domain && seenInFile.has(domain)) problems.push(`${domain} appears twice in this file`)
      else if (domain) seenInFile.add(domain)
    }
    if (shape === 'contacts') {
      const email = cell(row, mapping, 'email').toLowerCase()
      if (email && existingEmails.has(email)) problems.push(`${email} already exists — will be skipped`)
      else if (email && seenInFile.has(email)) problems.push(`${email} appears twice in this file`)
      else if (email) seenInFile.add(email)
    }
    if (shape === 'contacts' || shape === 'deals') {
      const company = cell(row, mapping, 'company').trim()
      if (company && !companyDomains.has(normaliseDomain(company)) && !companyNames.has(company.toLowerCase())) {
        problems.push(`No company matches "${company}" — import companies first`)
      }
    }

    if (problems.length === 0) valid += 1
    else issues.push({ row: rowNumber, message: problems.join('; ') })
  })

  return {
    shape,
    headers,
    mapping,
    missingRequired,
    total: rows.length,
    valid,
    sample: rows.slice(0, 5),
    issues: issues.slice(0, 40),
  }
}

/**
 * Import the valid rows and report on the rest. Rows that fail validation are
 * skipped rather than aborting the whole file: a 400-row export with three bad
 * dates should not be an all-or-nothing decision.
 */
export async function runImport(shape: string, csv: string): Promise<ImportResult | { error: string }> {
  const session = await auth()
  if (!session?.user) return { error: 'Not signed in' }

  const preview = await previewImport(shape, csv)
  if ('error' in preview) return preview
  if (preview.missingRequired.length > 0) {
    return { error: `Missing required columns: ${preview.missingRequired.join(', ')}` }
  }

  const table = parseCsv(csv)
  const { rows } = toObjects(table)
  const mapping = preview.mapping
  const badRows = new Set(preview.issues.map((i) => i.row))

  const members = await db.select({ id: t.teamMembers.id, email: t.teamMembers.email }).from(t.teamMembers)
  const memberByEmail = new Map(members.map((m) => [m.email.toLowerCase(), m.id]))
  const fallbackOwner = session.user.memberId ?? members[0]?.id ?? null

  const issues: RowIssue[] = []
  let inserted = 0
  let skipped = 0

  const ownerFor = (row: Record<string, string>) => {
    const email = cell(row, mapping, 'ownerEmail').toLowerCase()
    return (email && memberByEmail.get(email)) || fallbackOwner
  }

  if (shape === 'organizations') {
    const existing = await db.select({ domain: t.organizations.domain }).from(t.organizations)
    const seen = new Set(existing.map((o) => o.domain))

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2
      if (badRows.has(rowNumber)) { skipped += 1; continue }

      const domain = normaliseDomain(cell(row, mapping, 'domain'))
      if (seen.has(domain)) {
        skipped += 1
        issues.push({ row: rowNumber, message: `${domain} already exists — skipped` })
        continue
      }
      seen.add(domain)

      const employees = Number(cell(row, mapping, 'employeeCount').replace(/[^0-9]/g, ''))
      await db.insert(t.organizations).values({
        name: cell(row, mapping, 'name'),
        domain,
        lifecycle: (cell(row, mapping, 'lifecycle') || 'Lead') as 'Lead',
        segment: (cell(row, mapping, 'segment') || null) as 'SMB' | null,
        country: cell(row, mapping, 'country') || null,
        city: cell(row, mapping, 'city') || null,
        industry: cell(row, mapping, 'industry') || null,
        employeeCount: Number.isFinite(employees) && employees > 0 ? employees : null,
        notes: cell(row, mapping, 'notes') || null,
        ownerId: ownerFor(row),
      })
      inserted += 1
    }
  }

  if (shape === 'contacts' || shape === 'deals') {
    // Companies are referenced by domain or exact name; resolve both up front.
    const orgs = await db.select({
      id: t.organizations.id, name: t.organizations.name, domain: t.organizations.domain,
    }).from(t.organizations)
    const byDomain = new Map(orgs.map((o) => [o.domain, o.id]))
    const byName = new Map(orgs.map((o) => [o.name.toLowerCase(), o.id]))

    const resolveOrg = (raw: string): string | null => {
      const value = raw.trim()
      if (!value) return null
      return byDomain.get(normaliseDomain(value)) ?? byName.get(value.toLowerCase()) ?? null
    }

    if (shape === 'contacts') {
      const existing = await db.select({ email: t.contacts.email }).from(t.contacts)
      const seen = new Set(existing.map((c) => c.email.toLowerCase()))

      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2
        if (badRows.has(rowNumber)) { skipped += 1; continue }

        const email = cell(row, mapping, 'email').toLowerCase()
        if (seen.has(email)) {
          skipped += 1
          issues.push({ row: rowNumber, message: `${email} already exists — skipped` })
          continue
        }
        const organizationId = resolveOrg(cell(row, mapping, 'company'))
        if (!organizationId) {
          skipped += 1
          issues.push({ row: rowNumber, message: `No company matches "${cell(row, mapping, 'company')}" — import companies first` })
          continue
        }
        seen.add(email)

        await db.insert(t.contacts).values({
          firstName: cell(row, mapping, 'firstName'),
          lastName: cell(row, mapping, 'lastName'),
          email,
          organizationId,
          title: cell(row, mapping, 'title') || null,
          phone: cell(row, mapping, 'phone') || null,
          persona: (cell(row, mapping, 'persona') || null) as 'Champion' | null,
          ownerId: ownerFor(row),
        })
        inserted += 1
      }
    }

    if (shape === 'deals') {
      // One-off value lines need a product to hang off. Reuse or create one.
      let placeholder = await db.query.products.findFirst({
        where: eq(t.products.name, 'Imported value'),
      })
      if (!placeholder) {
        const [created] = await db.insert(t.products).values({
          name: 'Imported value',
          type: 'OneOff',
          listPriceCents: 0,
          billing: 'OneOff',
          description: 'Placeholder for values brought in by CSV import. Replace with real line items when you can.',
          active: false,
        }).returning()
        placeholder = created
      }

      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2
        if (badRows.has(rowNumber)) { skipped += 1; continue }

        const organizationId = resolveOrg(cell(row, mapping, 'company'))
        if (!organizationId) {
          skipped += 1
          issues.push({ row: rowNumber, message: `No company matches "${cell(row, mapping, 'company')}" — import companies first` })
          continue
        }

        const stage = (cell(row, mapping, 'stage') || 'Qualifying') as 'Qualifying'
        const [deal] = await db.insert(t.deals).values({
          name: cell(row, mapping, 'name'),
          organizationId,
          stage,
          type: (cell(row, mapping, 'type') || 'Subscription') as 'Subscription',
          expectedCloseDate: cell(row, mapping, 'expectedCloseDate') || null,
          nextStep: cell(row, mapping, 'nextStep') || null,
          notes: cell(row, mapping, 'notes') || null,
          ownerId: ownerFor(row),
        }).returning({ id: t.deals.id })

        await db.insert(t.dealStageHistory).values({
          dealId: deal.id, fromStage: null, toStage: stage, changedById: session.user.memberId,
        })

        const amount = Number(cell(row, mapping, 'value').replace(/[^0-9.-]/g, ''))
        if (Number.isFinite(amount) && amount > 0) {
          await db.insert(t.dealLineItems).values({
            dealId: deal.id,
            productId: placeholder.id,
            quantity: 1,
            unitPriceCents: Math.round(amount * 100),
            billing: 'OneOff',
          })
        }
        inserted += 1
      }
    }
  }

  revalidatePath('/', 'layout')
  return { inserted, skipped, failed: preview.issues.length, issues: issues.slice(0, 40) }
}

/** A ready-made template so nobody has to guess the column names. */
export async function templateFor(shape: string): Promise<string> {
  const fields = IMPORT_SHAPES[shape]?.fields ?? []
  const header = fields.map((f) => f.aliases[0]).join(',')
  const example = fields.map((f) => {
    switch (f.key) {
      case 'name': return shape === 'deals' ? 'Acme — Payments — 2026-Q4' : 'Acme Logistics'
      case 'domain': case 'company': return 'acme.com'
      case 'lifecycle': return 'Lead'
      case 'segment': return 'SMB'
      case 'country': return 'Poland'
      case 'city': return 'Warsaw'
      case 'industry': return 'Logistics'
      case 'employeeCount': return '120'
      case 'firstName': return 'Anna'
      case 'lastName': return 'Kowalska'
      case 'email': return 'anna@acme.com'
      case 'title': return 'Head of Finance'
      case 'phone': return '+48 500 000 000'
      case 'persona': return 'Champion'
      case 'stage': return 'Discovery'
      case 'type': return 'Subscription'
      case 'value': return '24000'
      case 'expectedCloseDate': return '2026-11-30'
      case 'nextStep': return 'Book the technical call'
      case 'ownerEmail': return 'you@yourcompany.com'
      default: return ''
    }
  }).join(',')
  return `${header}\n${example}\n`
}

export async function existingCounts(): Promise<Record<string, number>> {
  const [orgs, people, dealRows] = await Promise.all([
    db.select({ id: t.organizations.id }).from(t.organizations),
    db.select({ id: t.contacts.id }).from(t.contacts),
    db.select({ id: t.deals.id }).from(t.deals),
  ])
  return { organizations: orgs.length, contacts: people.length, deals: dealRows.length }
}

export async function deleteSeedData(): Promise<{ ok: boolean; message: string }> {
  const session = await auth()
  if (!session?.user) return { ok: false, message: 'Not signed in' }

  // Only ever removes the demo companies the seed created, matched by their
  // exact domains. Anything you imported or typed is untouched.
  const seedDomains = [
    'aurorabank.no', 'vantisretail.nl', 'nordwind-log.de', 'cafemilano.it', 'bergstrom.se',
    'lumenhealth.pl', 'balticcommerce.lt', 'toroventures.es', 'helios-energy.gr',
    'deltafoods.pl', 'meridianpay.pt', 'kwiatstudio.pl',
  ]
  const removed = await db.delete(t.organizations)
    .where(inArray(t.organizations.domain, seedDomains))
    .returning({ id: t.organizations.id })

  revalidatePath('/', 'layout')
  return {
    ok: true,
    message: `Removed ${removed.length} demo companies and everything linked to them. Team members, products and sources were left in place.`,
  }
}
