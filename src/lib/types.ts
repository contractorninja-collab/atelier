export type FieldType =
  | 'text'
  | 'longtext'
  | 'select'
  | 'multi'
  | 'link'
  | 'user'
  | 'currency'
  | 'number'
  | 'percent'
  | 'date'
  | 'check'
  | 'flag'
  | 'progress'
  /** Integer minutes in the database, rendered as hours. */
  | 'duration'

export type Option = { value: string; label: string; color: string }

export type Field = {
  id: string
  label: string
  type: FieldType
  width: number
  /** The record title. Exactly one per table. Rendered in the frozen column. */
  primary?: boolean
  options?: Option[]
  /** For link fields: which table the reference points at. */
  linkTo?: TableId
  /** Computed fields are read-only in the UI. */
  computed?: boolean
  /** Hidden from the grid by default but present in the record panel. */
  secondary?: boolean
}

export type ViewType = 'grid' | 'board' | 'timeline'

export type View = {
  id: string
  name: string
  type: ViewType
  icon: string
  /** Board views: the select field whose options become columns. */
  groupBy?: string
  /** Board views: the currency field summed per column. */
  sumBy?: string
  /** Timeline views. */
  startField?: string
  endField?: string
  colorField?: string
  labelField?: string
}

export type TableId =
  // Phase 1 — sales
  | 'deals'
  | 'organizations'
  | 'contacts'
  | 'activities'
  | 'products'
  | 'team'
  | 'sources'
  | 'targets'
  // Phase 2 — portfolio, delivery, production, capacity
  | 'portfolio'
  | 'projects'
  | 'milestones'
  | 'tasks'
  | 'sprints'
  | 'timeEntries'
  | 'allocations'
  | 'absences'
  | 'changeRequests'
  | 'risks'
  // Revenue — what we billed, what came back, what is still running
  | 'clients'
  | 'subscriptions'
  | 'invoices'
  | 'payments'
  | 'audit'
  // Traction — the EOS operating cadence
  | 'meetings'
  | 'rocks'
  | 'measurables'
  | 'scorecardEntries'
  | 'todos'
  | 'issues'

export type TableConfig = {
  id: TableId
  name: string
  singular: string
  icon: string
  color: string
  space: string
  fields: Field[]
  views: View[]
}

export type LinkRef = { id: string; label: string; table: TableId }

export type CellValue = string | number | boolean | null | string[] | LinkRef | LinkRef[]

export type Row = { id: string } & Record<string, CellValue>

export type ActionResult = { ok: true; detail?: string } | { ok: false; error: string }
