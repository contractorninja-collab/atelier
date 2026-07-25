/**
 * A small RFC 4180 CSV parser.
 *
 * Written by hand rather than pulled in as a dependency because the whole
 * surface we need is: quoted fields, escaped quotes, embedded commas and
 * newlines, and both CRLF and LF line endings. Everything else a CSV library
 * gives you is weight we would never use.
 */

export function parseCsv(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  // A leading byte-order mark turns the first header into "﻿Name" and
  // silently breaks column mapping. Excel adds one on export.
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input

  const endField = () => { row.push(field); field = '' }
  const endRow = () => {
    endField()
    // Skip rows that are entirely empty — trailing newlines are normal.
    if (row.some((cell) => cell.trim() !== '')) rows.push(row)
    row = []
  }

  while (i < text.length) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i += 1; continue
      }
      field += char; i += 1; continue
    }

    if (char === '"') { inQuotes = true; i += 1; continue }
    if (char === ',') { endField(); i += 1; continue }
    if (char === '\r') { i += 1; continue }
    if (char === '\n') { endRow(); i += 1; continue }

    field += char
    i += 1
  }

  if (field !== '' || row.length > 0) endRow()
  return rows
}

/** Loose header matching: "Company Name", "company_name" and "companyname" all match. */
export function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export type ParsedSheet = {
  headers: string[]
  rows: Record<string, string>[]
}

export function toObjects(table: string[][]): ParsedSheet {
  if (table.length === 0) return { headers: [], rows: [] }
  const headers = table[0].map((h) => h.trim())
  const rows = table.slice(1).map((cells) => {
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      record[normaliseHeader(header)] = (cells[index] ?? '').trim()
    })
    return record
  })
  return { headers, rows }
}

/**
 * What each importable table accepts. `aliases` are the header spellings we
 * recognise; the first one is what we show as the canonical name.
 */
export type ImportField = {
  key: string
  label: string
  required?: boolean
  aliases: string[]
  hint?: string
}

export const IMPORT_SHAPES: Record<string, { label: string; fields: ImportField[]; note: string }> = {
  organizations: {
    label: 'Companies',
    note: 'Deduplicated on domain. A row whose domain already exists is skipped, not overwritten.',
    fields: [
      { key: 'name', label: 'Name', required: true, aliases: ['name', 'company', 'companyname', 'organisation', 'organization', 'account'] },
      { key: 'domain', label: 'Domain', required: true, aliases: ['domain', 'website', 'url', 'site'], hint: 'Stored bare — acme.com, not https://www.acme.com/' },
      { key: 'lifecycle', label: 'Lifecycle', aliases: ['lifecycle', 'stage', 'status'], hint: 'Lead, MQL, SQL, Opportunity, Customer, Churned, Disqualified' },
      { key: 'segment', label: 'Segment', aliases: ['segment', 'size'], hint: 'Micro, SMB, MidMarket, Enterprise' },
      { key: 'country', label: 'Country', aliases: ['country'] },
      { key: 'city', label: 'City', aliases: ['city', 'town'] },
      { key: 'industry', label: 'Industry', aliases: ['industry', 'vertical', 'sector'] },
      { key: 'employeeCount', label: 'Employees', aliases: ['employees', 'employeecount', 'headcount', 'size'] },
      { key: 'ownerEmail', label: 'Owner email', aliases: ['owner', 'owneremail', 'accountowner'], hint: 'Must match a Team member email' },
      { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'description'] },
    ],
  },
  contacts: {
    label: 'Contacts',
    note: 'Deduplicated on email. The company is matched by domain first, then by exact name.',
    fields: [
      { key: 'firstName', label: 'First name', required: true, aliases: ['firstname', 'first', 'givenname'] },
      { key: 'lastName', label: 'Last name', required: true, aliases: ['lastname', 'last', 'surname', 'familyname'] },
      { key: 'email', label: 'Email', required: true, aliases: ['email', 'emailaddress', 'mail'] },
      { key: 'company', label: 'Company', required: true, aliases: ['company', 'organisation', 'organization', 'account', 'companydomain', 'domain'], hint: 'Domain or exact company name' },
      { key: 'title', label: 'Title', aliases: ['title', 'jobtitle', 'role', 'position'] },
      { key: 'phone', label: 'Phone', aliases: ['phone', 'telephone', 'mobile'] },
      { key: 'persona', label: 'Persona', aliases: ['persona', 'buyerrole'], hint: 'Champion, EconomicBuyer, TechnicalEvaluator, EndUser, Blocker, Introducer' },
      { key: 'ownerEmail', label: 'Owner email', aliases: ['owner', 'owneremail'] },
    ],
  },
  deals: {
    label: 'Deals',
    note: 'No deduplication — every row becomes a deal. Value is entered as a single one-off amount; add line items afterwards for anything more precise.',
    fields: [
      { key: 'name', label: 'Deal name', required: true, aliases: ['name', 'deal', 'dealname', 'opportunity', 'title'] },
      { key: 'company', label: 'Company', required: true, aliases: ['company', 'organisation', 'organization', 'account', 'domain'], hint: 'Domain or exact company name' },
      { key: 'stage', label: 'Stage', aliases: ['stage', 'dealstage', 'status'], hint: 'Qualifying, Discovery, SolutionFit, Proposal, Negotiation, ClosedWon, ClosedLost, Nurture' },
      { key: 'type', label: 'Deal type', aliases: ['type', 'dealtype'], hint: 'Subscription, Project, Hybrid, Retainer' },
      { key: 'value', label: 'Value', aliases: ['value', 'amount', 'tcv', 'dealvalue'], hint: 'Whole currency units, e.g. 24000' },
      { key: 'expectedCloseDate', label: 'Expected close', aliases: ['expectedclose', 'expectedclosedate', 'closedate', 'close'], hint: 'YYYY-MM-DD' },
      { key: 'ownerEmail', label: 'Owner email', aliases: ['owner', 'owneremail', 'salesrep'] },
      { key: 'nextStep', label: 'Next step', aliases: ['nextstep', 'next'] },
      { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'description'] },
    ],
  },
}

/** Map a sheet's normalised headers onto our field keys. */
export function mapColumns(headers: string[], shape: keyof typeof IMPORT_SHAPES): Record<string, string | null> {
  const normalised = headers.map(normaliseHeader)
  const mapping: Record<string, string | null> = {}
  for (const field of IMPORT_SHAPES[shape].fields) {
    const hit = field.aliases.find((alias) => normalised.includes(alias))
    mapping[field.key] = hit ?? null
  }
  return mapping
}
