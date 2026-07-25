# Atelier

The house workspace: sales and production for every product we build. **Phase 1 (sales) and Phase 2 (portfolio, delivery, production, capacity)** — eighteen tables working end to end against Postgres, with authentication, a ClickUp-style shell and an Airtable-style grid.

Built from the specification document (`PagaPRO-CRM-Spec.md`, written before the rename). Section references in the code comments point back at it.

---

## What works today

**Data model.** Eighteen tables in four groups. *Sales:* organizations, contacts, deals, line items, stage history, catalogue products, sources, activities, team, targets. *Portfolio:* the products we own and build. *Delivery:* projects, milestones, change requests, risks. *Production and capacity:* tasks, sprints, time entries, allocations, absences.

Three storage rules hold everywhere: money is integer **cents**, percentages are **basis points**, time is integer **minutes**. No floats anywhere in the money or time path.

**The portfolio spine.** The reason this is not just a CRM. A software house sells plans and services, but *owns and builds* products — and those are different things. Catalogue products, deals, projects and tasks all point at a portfolio product, so revenue on one side and delivery cost on the other meet in a single row:

```
portfolio product -> catalogue products -> deals    (what it earns)
portfolio product -> projects -> tasks -> time      (what it costs)
```

The home dashboard turns that into one number per product: **contribution** — closed-won value less the cost of the hours logged against it. It is the number that tells you whether PagaPRO is carrying the second product or the other way round.

**Views.** Every table renders as a grid (frozen first column, field-type icons, colored select pills, live summary row, search, sort, group, hide-fields, row height). Deals additionally get a drag-and-drop pipeline board and a close-forecast timeline. Organizations and products get boards too. Adding a table to `src/lib/tables.ts` gives you all of this without writing a component.

**Editing.** Click a select cell to change it. Click a link or owner cell to reassign it. Toggle checkboxes inline. Open the record panel for text, number, date and currency fields. Every write is optimistic and rolls back on failure.

**The Closed Won handoff, complete.** Moving a deal to Closed Won now does all of this in one transaction: stamps the close date and forecast; appends to `deal_stage_history` with the actor and days in the previous stage; promotes the account to Customer (appending the type rather than replacing it); and — for Project, Hybrid and Retainer deals — creates the delivery project with its budget hours summed from the line items' delivery estimates, its contract value from TCV, its portfolio product inherited from the deal, and the standard nine-milestone set with weights, baseline dates and invoice amounts on the payment-trigger milestones.

It is **idempotent**: a second Closed Won on the same deal creates nothing. Duplicate projects quietly corrupt every capacity and margin report downstream and nobody notices for a month. The template's weights are asserted to total exactly 10000 basis points before insert, because a project whose weights sum to 92% can never read as complete and the reason is invisible six weeks later.

`runHandoff(dealId)` runs it by hand for deals that closed before Phase 2 existed.

**Delivery maths.** Percent complete is the weighted sum of milestone completion. Budget burn is logged against budget. Margin is contract value less internal cost, where cost comes from time entries with rates **snapshotted at entry time** — looking them up live would silently restate last year's margin the day somebody gets a raise. Slip is always measured against a frozen baseline, never against a target that has already been moved.

**Capacity.** Planned hours against hours available, net of approved leave, so somebody on holiday does not read as idle. Anything over 100% is surfaced on the dashboard as a promise someone will have to break.

**Computed fields.** TCV, MRR, one-off value, stage probability, weighted value, days in stage, qualification score, hygiene flag, project rollups, budget warnings, risk severity, utilisation and cycle time are all derived in `src/server/compute.ts` — one definition each, so the grid, board, record panel and dashboard can never disagree about what a number means.

**Auth.** Magic link (Resend) and Google. Invite-only: your email must already exist in the Team table, otherwise sign-in is refused. Without that, anyone who finds the URL gets a full read of the pipeline.

**Home dashboard.** Open and weighted pipeline, coverage against the quarter's target, win rate, recurring revenue, customer count, deals failing a hygiene check, value by stage, and recent activity.

---

## Getting it running

You need Node 20+ and a Postgres database. Supabase's free tier is the shortest path.

### 1. Install

```bash
npm install
```

### 2. Database

Create a Supabase project, then in **Project Settings → Database → Connection string** copy both connection strings.

```bash
cp .env.example .env
```

Fill in `DATABASE_URL` with the **pooled** connection (port 6543) and `DIRECT_URL` with the **direct** one (port 5432). Migrations need the direct connection; the app uses the pooled one.

```bash
npx auth secret          # writes AUTH_SECRET into .env
npm run db:migrate       # creates the tables
npm run db:seed          # loads a realistic starting pipeline
```

The seed sets the founder's email to `florianthegooat@gmail.com` and the rest of the team to `@atelier.studio` — change both at the top of `src/db/seed.ts` to your real house domain before seeding. The PagaPRO product names in the catalogue are deliberate: PagaPRO is something you sell, Atelier is the system you sell it from. **You can only sign in as an address that exists in the Team table.**

### 3. Sign-in providers

**Magic link.** Create a free account at [resend.com](https://resend.com), make an API key, put it in `AUTH_RESEND_KEY`. Until you verify a sending domain, set `EMAIL_FROM="Atelier <onboarding@resend.dev>"` — Resend allows that for testing.

**Google.** Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Web application. Authorised redirect URI: `http://localhost:3000/api/auth/callback/google` (and your production URL later). Put the client ID and secret in `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

Either provider alone is enough to get in — you do not need both configured to start.

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000. You will land on the login page.

---

## Deploying

Push to GitHub, import the repo in Vercel, and add every variable from `.env` to the Vercel project. Change `AUTH_URL` to your real URL and add that callback URL to the Google OAuth client. Then:

```bash
npm run db:deploy   # applies migrations against production
```

Vercel runs `npm run build` automatically. The app is entirely server-rendered on demand, so there is no static export step to worry about.

---

## How it is put together

```
src/
  db/
    schema.ts        Drizzle schema — the tables, enums and relations
    index.ts         connection (singleton, so dev reloads don't exhaust Postgres)
    seed.ts          realistic starting data
  lib/
    tables.ts        THE IMPORTANT FILE — field, view and option config per table
    format.ts        money, dates, percentages, avatars, domain normalisation
    types.ts         Field, View, Row, TableConfig
  server/
    compute.ts       TCV, probability, hygiene flag, qualification score
    queries.ts       one loader per table, returning flat rows with resolved links
    actions.ts       writes: updateCell, moveDealStage, createDeal, createOrganization
    related.ts       walks the config to find records pointing at this one
  components/        Shell, Sidebar, GridView, BoardView, TimelineView, RecordPanel…
  app/
    (app)/           authenticated routes: home, my-work, table/[table]
    login/           magic link and Google
```

**To add a field:** add the column in `src/db/schema.ts`, run `npm run db:generate && npm run db:migrate`, add it to the field list in `src/lib/tables.ts`, map it in the relevant loader in `queries.ts`, and add its id to the `WRITABLE` allow-list in `actions.ts` if it should be editable. Five small edits, no new components.

**To add a whole table:** the same five steps plus a `views` array. The grid, board, timeline, record panel, related-records tab and command palette all pick it up automatically.

**Security note.** `WRITABLE` in `actions.ts` is an allow-list, not a deny-list: a new column is read-only until you deliberately open it, and select values are validated against the configured options server-side rather than trusting the client.

---

## Deliberately not here yet

Subscriptions and the revenue-event ledger, invoices, partners and deal registration, and epics/releases/roadmap. The spec phases these for good reasons — see section 13.

Also absent: inline editing of text directly in grid cells (it happens in the record panel, where there is room for a real input), filters beyond search, bulk actions on selected rows, CSV import/export, and a form for logging time (the `logTime` action exists and is tested; it has no UI yet).

---

## Verification done before delivery

Type-checks clean, production build succeeds, and all eighteen tables plus every view were exercised against a live Postgres instance with zero client or server errors and no failed network requests.

The Closed Won handoff was verified at the database level, not just by the toast: project created with the right type, 140 budget hours summed from line items, €57,360 contract value matching TCV, portfolio product inherited, nine milestones whose weights total exactly 10000 basis points, and invoice amounts on the payment-trigger milestones. Toggling the deal out of Closed Won and back produced no second project.

Two notes on things that look like bugs and are not. Automated browser tools drive HTML5 drag unreliably — the board's drag path was verified by confirming the correct record id reaches the server action and persists, not by simulating a mouse. And if you ever run `next dev` against a `.next` directory that holds a production build (or the reverse), the asset manifest goes stale and the app renders unstyled; delete `.next` and rebuild rather than hunting for a CSS bug.
