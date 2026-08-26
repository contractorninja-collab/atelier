/**
 * The money math.
 *
 * These are the numbers the business is run on: cents, basis points, aged debt
 * and margin. Every function here is pure, so the tests need no database and no
 * fixtures — which is exactly why there is no excuse for not having them.
 *
 *   npm test
 *
 * `today` is passed explicitly wherever a function accepts it. A test that reads
 * the clock passes in July and fails in September.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  accountHealth, addMonths, agingBucket, averageRating, dealMoney, daysUntilRenewal, hygieneFlag,
  formatInvoiceNumber, invoiceState, measurableOnTrack, milestoneCompletionBps, mondayOf,
  nextInvoiceNumber, nextRenewalDate, projectFinancials, projectRollup,
  qualificationScore, quarterEndDate, quarterOf, rockCompletionBps, scorecardHitRateBps,
  scorecardWeeks, timeIsInvoiced, todoCompletionBps, utilisationBps,
} from './compute'
import { MILESTONE_TEMPLATE, TARGET_METRIC_UNIT } from '@/lib/tables'

const TODAY = '2026-07-26'
const euros = (n: number) => n * 100

/* ------------------------------------------------------------------ deals */

describe('dealMoney', () => {
  const deal = (lineItems: Parameters<typeof dealMoney>[0]['lineItems'], over?: Partial<Parameters<typeof dealMoney>[0]>) => ({
    stage: 'Proposal', contractMonths: 12, probabilityOverrideBps: null, lineItems, ...over,
  })
  const line = (over: Partial<Parameters<typeof dealMoney>[0]['lineItems'][0]>) => ({
    quantity: 1, unitPriceCents: euros(100), discountBps: 0, billing: 'Monthly' as const, ...over,
  })

  test('TCV is one-off plus monthly across the contract term', () => {
    const m = dealMoney(deal([
      line({ billing: 'OneOff', unitPriceCents: euros(5_000) }),
      line({ billing: 'Monthly', unitPriceCents: euros(1_000) }),
    ]))
    assert.equal(m.oneOffCents, euros(5_000))
    assert.equal(m.mrrCents, euros(1_000))
    assert.equal(m.tcvCents, euros(5_000) + euros(1_000) * 12)
  })

  test('annual lines are normalised to a monthly figure so MRR means one thing', () => {
    const m = dealMoney(deal([line({ billing: 'Annual', unitPriceCents: euros(1_200) })]))
    assert.equal(m.mrrCents, euros(100))
  })

  test('usage-based lines are excluded — they are not contracted value', () => {
    const m = dealMoney(deal([line({ billing: 'UsageBased', unitPriceCents: euros(9_999) })]))
    assert.equal(m.tcvCents, 0)
    assert.equal(m.mrrCents, 0)
  })

  test('discount is basis points, applied per line', () => {
    // 12.5% off 100.00 leaves 87.50 — and must stay an integer number of cents.
    const m = dealMoney(deal([line({ billing: 'OneOff', unitPriceCents: euros(100), discountBps: 1250 })]))
    assert.equal(m.oneOffCents, 8_750)
    assert.equal(Number.isInteger(m.oneOffCents), true)
  })

  test('quantity multiplies before the discount', () => {
    const m = dealMoney(deal([line({ billing: 'OneOff', quantity: 3, unitPriceCents: euros(100), discountBps: 5000 })]))
    assert.equal(m.oneOffCents, euros(150))
  })

  test('probability comes from the stage unless overridden', () => {
    assert.equal(dealMoney(deal([], { stage: 'Negotiation' })).probabilityBps, 7500)
    assert.equal(dealMoney(deal([], { stage: 'Negotiation', probabilityOverrideBps: 2000 })).probabilityBps, 2000)
  })

  test('an override of zero is respected, not treated as absent', () => {
    // `?? ` rather than `||` matters here: 0 is a legitimate probability.
    assert.equal(dealMoney(deal([], { stage: 'Negotiation', probabilityOverrideBps: 0 })).probabilityBps, 0)
  })

  test('weighted value is TCV times probability, in whole cents', () => {
    const m = dealMoney(deal([line({ billing: 'OneOff', unitPriceCents: 3_333 })], { stage: 'Proposal' }))
    assert.equal(m.weightedCents, Math.round((3_333 * 5000) / 10_000))
    assert.equal(Number.isInteger(m.weightedCents), true)
  })
})

/* ------------------------------------------------------------- receivables */

describe('invoiceState', () => {
  const inv = (over: Partial<Parameters<typeof invoiceState>[0]> = {}) => ({
    status: 'Sent', dueDate: '2026-07-01', amountCents: euros(1_000), taxCents: euros(230), ...over,
  })

  test('total is net plus tax', () => {
    assert.equal(invoiceState(inv(), [], TODAY).totalCents, euros(1_230))
  })

  test('an exact payment settles it and it stops ageing', () => {
    const s = invoiceState(inv(), [{ amountCents: euros(1_230) }], TODAY)
    assert.equal(s.state, 'Paid')
    assert.equal(s.outstandingCents, 0)
    assert.equal(s.daysOverdue, 0)
    assert.equal(s.agingBucket, '')
  })

  test('overpayment clamps at zero rather than going negative', () => {
    const s = invoiceState(inv(), [{ amountCents: euros(5_000) }], TODAY)
    assert.equal(s.outstandingCents, 0)
    assert.equal(s.state, 'Paid')
  })

  test('overdue beats part paid — a late part-payment is still late', () => {
    const s = invoiceState(inv({ dueDate: '2026-07-01' }), [{ amountCents: euros(500) }], TODAY)
    assert.equal(s.state, 'Overdue')
    assert.equal(s.outstandingCents, euros(730))
    assert.equal(s.daysOverdue, 25)
  })

  test('part paid and not yet due reads as part paid', () => {
    const s = invoiceState(inv({ dueDate: '2026-08-30' }), [{ amountCents: euros(500) }], TODAY)
    assert.equal(s.state, 'Part paid')
    assert.equal(s.daysOverdue, 0)
  })

  test('void owes nothing and never ages, however old', () => {
    const s = invoiceState(inv({ status: 'Void', dueDate: '2020-01-01' }), [], TODAY)
    assert.equal(s.state, 'Void')
    assert.equal(s.outstandingCents, 0)
    assert.equal(s.daysOverdue, 0)
    assert.equal(s.agingBucket, '')
  })

  test('a draft is never overdue — an unposted invoice is our failing, not theirs', () => {
    const s = invoiceState(inv({ status: 'Draft', dueDate: '2020-01-01' }), [], TODAY)
    assert.equal(s.state, 'Draft')
    assert.equal(s.daysOverdue, 0)
    assert.equal(s.outstandingCents, euros(1_230))
  })

  test('settlement is derived from payments, not from a stored flag', () => {
    // The whole reason invoice_status has no Paid member.
    const s = invoiceState(inv({ status: 'Sent' }), [{ amountCents: euros(600) }, { amountCents: euros(630) }], TODAY)
    assert.equal(s.state, 'Paid')
    assert.equal(s.paidCents, euros(1_230))
  })

  test('due today is not yet overdue', () => {
    assert.equal(invoiceState(inv({ dueDate: TODAY }), [], TODAY).state, 'Sent')
  })
})

describe('agingBucket', () => {
  test('boundaries land in the bucket a finance person would expect', () => {
    assert.equal(agingBucket(0), 'Current')
    assert.equal(agingBucket(1), '1–30')
    assert.equal(agingBucket(30), '1–30')
    assert.equal(agingBucket(31), '31–60')
    assert.equal(agingBucket(60), '31–60')
    assert.equal(agingBucket(61), '61–90')
    assert.equal(agingBucket(90), '61–90')
    assert.equal(agingBucket(91), '90+')
  })
})

/* ---------------------------------------------------------- account health */

describe('accountHealth', () => {
  const base = {
    lastActivityAt: '2026-07-20', openDeals: [] as { stage: string }[], maxDaysOverdue: 0,
    overdueCents: 0, daysToRenewal: null as number | null, hasRedProject: false,
    hasActiveSubscription: false, today: TODAY,
  }

  test('long-overdue debt outranks a recent conversation', () => {
    // The case a naive recency score rates healthiest right before it goes wrong.
    const h = accountHealth({ ...base, lastActivityAt: TODAY, maxDaysOverdue: 66, overdueCents: euros(20_000) })
    assert.equal(h.temperature, 'AtRisk')
    assert.match(h.reasons[0], /66 days overdue/)
  })

  test('a red project puts the account at risk', () => {
    assert.equal(accountHealth({ ...base, hasRedProject: true }).temperature, 'AtRisk')
  })

  test('an imminent renewal with no recent contact is at risk', () => {
    const h = accountHealth({ ...base, lastActivityAt: '2026-05-01', hasActiveSubscription: true, daysToRenewal: 10 })
    assert.equal(h.temperature, 'AtRisk')
  })

  test('an imminent renewal you are actively talking to is not', () => {
    const h = accountHealth({ ...base, lastActivityAt: TODAY, hasActiveSubscription: true, daysToRenewal: 10 })
    assert.equal(h.temperature, 'Hot')
  })

  test('hot needs recent contact AND something in play', () => {
    const quiet = accountHealth({ ...base, lastActivityAt: TODAY })
    assert.equal(quiet.temperature, 'Warm', 'recent contact alone is only warm')

    const inPlay = accountHealth({ ...base, lastActivityAt: TODAY, openDeals: [{ stage: 'Negotiation' }] })
    assert.equal(inPlay.temperature, 'Hot')
  })

  test('an early-stage deal is not "in play" for the hot test', () => {
    const h = accountHealth({ ...base, lastActivityAt: TODAY, openDeals: [{ stage: 'Qualifying' }] })
    assert.equal(h.temperature, 'Warm')
  })

  test('silence beyond the warm window is cold', () => {
    const h = accountHealth({ ...base, lastActivityAt: '2026-05-01' })
    assert.equal(h.temperature, 'Cold')
  })

  test('never contacted is cold and says so', () => {
    const h = accountHealth({ ...base, lastActivityAt: null })
    assert.equal(h.temperature, 'Cold')
    assert.equal(h.daysSinceActivity, null)
    assert.match(h.reasons[0], /No activity ever logged/)
  })

  test('the verdict always carries a reason', () => {
    for (const input of [base, { ...base, hasRedProject: true }, { ...base, lastActivityAt: null }]) {
      assert.ok(accountHealth(input).reasons.length > 0)
    }
  })

  test('a cancelled subscription does not drag the account to at-risk on renewal date', () => {
    const h = accountHealth({ ...base, lastActivityAt: '2026-05-01', hasActiveSubscription: false, daysToRenewal: -300 })
    assert.equal(h.temperature, 'Cold')
  })
})

/* ------------------------------------------------------------------ delivery */

describe('projectRollup', () => {
  const project = (over: Partial<Parameters<typeof projectRollup>[0]> = {}) => ({
    budgetMinutes: 60 * 100, contractValueCents: euros(50_000),
    baselineLaunch: '2026-09-01', targetLaunch: '2026-09-01', actualLaunch: null,
    milestones: [] as Parameters<typeof projectRollup>[0]['milestones'],
    timeEntries: [] as Parameters<typeof projectRollup>[0]['timeEntries'],
    tasks: [] as Parameters<typeof projectRollup>[0]['tasks'],
    ...over,
  })

  test('percent complete is milestone weight times completion', () => {
    const r = projectRollup(project({
      milestones: [
        { status: 'Accepted', weightBps: 5000, dueDate: null },
        { status: 'InProgress', weightBps: 5000, dueDate: null },
      ],
    }))
    assert.equal(r.percentCompleteBps, 7500)
  })

  test('a cancelled milestone counts as complete so a descoped project can reach 100%', () => {
    const r = projectRollup(project({
      milestones: [
        { status: 'Accepted', weightBps: 5000, dueDate: null },
        { status: 'Cancelled', weightBps: 5000, dueDate: null },
      ],
    }))
    assert.equal(r.percentCompleteBps, 10_000)
  })

  test('burn is null without a budget rather than dividing by zero', () => {
    assert.equal(projectRollup(project({ budgetMinutes: 0 })).burnBps, null)
  })

  test('margin is null without a contract value', () => {
    assert.equal(projectRollup(project({ contractValueCents: 0 })).marginBps, null)
  })

  test('cost uses the rate snapshotted on the entry', () => {
    const r = projectRollup(project({
      timeEntries: [{ minutes: 120, billable: true, costRateCents: euros(50) }],
    }))
    assert.equal(r.internalCostCents, euros(100))
    assert.equal(r.billableMinutes, 120)
  })

  test('slip is measured against the frozen baseline, never the moved target', () => {
    const r = projectRollup(project({ baselineLaunch: '2026-09-01', targetLaunch: '2026-09-15' }))
    assert.equal(r.slipDays, 14)
  })

  test('once launched, slip is what actually happened', () => {
    const r = projectRollup(project({ baselineLaunch: '2026-09-01', targetLaunch: '2026-09-15', actualLaunch: '2026-09-08' }))
    assert.equal(r.slipDays, 7)
  })

  test('the next due date ignores finished milestones', () => {
    const r = projectRollup(project({
      milestones: [
        { status: 'Accepted', weightBps: 0, dueDate: '2026-08-01' },
        { status: 'NotStarted', weightBps: 0, dueDate: '2026-08-20' },
      ],
    }))
    assert.equal(r.nextDueDate, '2026-08-20')
  })

  test('blocked counts exclude finished work', () => {
    const r = projectRollup(project({
      tasks: [
        { blocked: true, status: 'InProgress' },
        { blocked: true, status: 'Done' },
        { blocked: true, status: 'WontDo' },
      ],
    }))
    assert.equal(r.openBlockers, 1)
  })
})

describe('projectFinancials', () => {
  const inv = (over: Partial<Parameters<typeof projectFinancials>[0]['invoices'][0]> = {}) => ({
    status: 'Sent', dueDate: '2026-08-30', amountCents: euros(10_000), taxCents: 0,
    payments: [] as { amountCents: number }[], ...over,
  })
  const fin = (over: Partial<Parameters<typeof projectFinancials>[0]> = {}) =>
    projectFinancials({
      contractValueCents: euros(50_000), internalCostCents: euros(20_000),
      invoices: [], today: TODAY, ...over,
    })

  test('contracted margin is what the deal promised', () => {
    // (50,000 - 20,000) / 50,000 = 60%
    assert.equal(fin().contractedMarginBps, 6_000)
  })

  test('collected margin is null until money actually arrives', () => {
    assert.equal(fin().collectedMarginBps, null)
  })

  test('a fully sold, fully unpaid project has a healthy contracted margin and no collected one', () => {
    // The exact case that keeps a dashboard green while the studio runs dry.
    const f = fin({ invoices: [inv({ amountCents: euros(50_000) })] })
    assert.equal(f.contractedMarginBps, 6_000)
    assert.equal(f.collectedMarginBps, null)
    assert.equal(f.outstandingCents, euros(50_000))
  })

  test('collected margin goes negative while cost exceeds what came in', () => {
    const f = fin({ invoices: [inv({ payments: [{ amountCents: euros(10_000) }] })] })
    // (10,000 collected - 20,000 cost) / 10,000 = -100%
    assert.equal(f.collectedMarginBps, -10_000)
    assert.equal(f.collectedCents, euros(10_000))
  })

  test('the two margins agree once everything is billed and paid', () => {
    const f = fin({
      invoices: [inv({ amountCents: euros(50_000), payments: [{ amountCents: euros(50_000) }] })],
    })
    assert.equal(f.contractedMarginBps, f.collectedMarginBps)
    assert.equal(f.outstandingCents, 0)
  })

  test('void invoices count as neither billed nor owed', () => {
    const f = fin({ invoices: [inv({ status: 'Void', amountCents: euros(9_999) })] })
    assert.equal(f.invoicedCents, 0)
    assert.equal(f.outstandingCents, 0)
    assert.equal(f.overdueCents, 0)
  })

  test('tax is billed and collected like anything else', () => {
    const f = fin({ invoices: [inv({ amountCents: euros(1_000), taxCents: euros(230) })] })
    assert.equal(f.invoicedCents, euros(1_230))
  })

  test('uninvoiced is the contract not yet billed, and goes negative when over-billed', () => {
    assert.equal(fin({ invoices: [inv({ amountCents: euros(20_000) })] }).uninvoicedCents, euros(30_000))
    assert.equal(fin({ invoices: [inv({ amountCents: euros(60_000) })] }).uninvoicedCents, euros(-10_000))
  })

  test('only past-due invoices count as overdue', () => {
    const f = fin({
      invoices: [
        inv({ dueDate: '2026-07-01', amountCents: euros(3_000) }),
        inv({ dueDate: '2026-12-01', amountCents: euros(4_000) }),
      ],
    })
    assert.equal(f.overdueCents, euros(3_000))
    assert.equal(f.outstandingCents, euros(7_000))
  })

  test('margins are null rather than dividing by zero on an unpriced project', () => {
    const f = fin({ contractValueCents: 0 })
    assert.equal(f.contractedMarginBps, null)
    assert.equal(f.collectedMarginBps, null)
  })
})

describe('timeIsInvoiced', () => {
  test('unlinked hours are not invoiced', () => {
    assert.equal(timeIsInvoiced({ invoiceId: null }), false)
  })

  test('hours on a live invoice are invoiced', () => {
    assert.equal(timeIsInvoiced({ invoiceId: 'inv1', invoiceStatus: 'Sent' }), true)
    assert.equal(timeIsInvoiced({ invoiceId: 'inv1', invoiceStatus: 'Draft' }), true)
  })

  test('voiding the invoice releases the hours back to billable', () => {
    // The whole reason this is derived and not a stored flag.
    assert.equal(timeIsInvoiced({ invoiceId: 'inv1', invoiceStatus: 'Void' }), false)
  })
})

describe('nextInvoiceNumber', () => {
  test('starts at 001 for a year with nothing issued', () => {
    assert.equal(nextInvoiceNumber([], 2026), 'INV-2026-001')
    assert.equal(nextInvoiceNumber(['INV-2025-099'], 2026), 'INV-2026-001')
  })

  test('counts up from the highest, not the count', () => {
    assert.equal(nextInvoiceNumber(['INV-2026-041', 'INV-2026-047', 'INV-2026-033'], 2026), 'INV-2026-048')
  })

  test('never reuses a number left behind by a gap', () => {
    // 042 might be voided. Reissuing it would give two invoices one reference.
    assert.equal(nextInvoiceNumber(['INV-2026-041', 'INV-2026-043'], 2026), 'INV-2026-044')
  })

  test('numbering restarts each year', () => {
    assert.equal(nextInvoiceNumber(['INV-2026-500'], 2027), 'INV-2027-001')
  })

  test('ignores references that do not match the format', () => {
    assert.equal(nextInvoiceNumber(['CREDIT-NOTE-9', '', 'INV-2026-2', 'INV-XX-4'], 2026), 'INV-2026-003')
  })

  test('pads to three digits but does not truncate beyond them', () => {
    assert.equal(formatInvoiceNumber(2026, 7), 'INV-2026-007')
    assert.equal(formatInvoiceNumber(2026, 1234), 'INV-2026-1234')
  })
})

describe('milestoneCompletionBps', () => {
  test('half credit for in progress, full for anything finished', () => {
    assert.equal(milestoneCompletionBps('InProgress'), 5_000)
    for (const s of ['Accepted', 'Delivered', 'Cancelled']) {
      assert.equal(milestoneCompletionBps(s), 10_000)
    }
    for (const s of ['NotStarted', 'Blocked']) {
      assert.equal(milestoneCompletionBps(s), 0)
    }
  })
})

test('the milestone template weights total exactly 10000 basis points', () => {
  // A project whose weights sum to 92% can never read as complete, and the
  // reason is invisible six weeks later.
  const total = MILESTONE_TEMPLATE.reduce((sum, m) => sum + m.weightBps, 0)
  assert.equal(total, 10_000)
})

/* -------------------------------------------------------------- pipeline hygiene */

describe('hygieneFlag', () => {
  const deal = (over: Partial<Parameters<typeof hygieneFlag>[0]> = {}) => ({
    stage: 'Proposal', nextStepDate: '2099-01-01', expectedCloseDate: '2099-01-01',
    stageEnteredAt: new Date(), ...over,
  })

  test('a missing next step outranks having merely sat a while', () => {
    const stale = new Date(Date.now() - 90 * 86_400_000)
    assert.equal(hygieneFlag(deal({ nextStepDate: null, stageEnteredAt: stale })), '⚠ No next step')
  })

  test('closed and nurtured deals are never flagged', () => {
    for (const stage of ['ClosedWon', 'ClosedLost', 'Nurture']) {
      assert.equal(hygieneFlag(deal({ stage, nextStepDate: null })), '')
    }
  })

  test('a healthy deal has no flag', () => {
    assert.equal(hygieneFlag(deal()), '')
  })
})

test('qualificationScore is the fraction of gates satisfied', () => {
  assert.equal(qualificationScore({
    championIdentified: true, economicBuyerIdentified: true,
    painDocumented: false, decisionProcessDocumented: false,
  }), 0.5)
})

/* ------------------------------------------------------------------ capacity */

describe('utilisationBps', () => {
  test('leave reduces availability, so somebody on holiday does not read as idle', () => {
    const full = utilisationBps({ billableMinutes: 1_200, weeklyCapacityHours: 40, weeks: 1, absenceMinutes: 0 })
    const onLeave = utilisationBps({ billableMinutes: 1_200, weeklyCapacityHours: 40, weeks: 1, absenceMinutes: 1_200 })
    assert.equal(full, 5_000)
    assert.equal(onLeave, 10_000)
  })

  test('null rather than a divide-by-zero when nobody was available', () => {
    assert.equal(utilisationBps({ billableMinutes: 60, weeklyCapacityHours: 40, weeks: 1, absenceMinutes: 2_400 }), null)
  })
})

test('daysUntilRenewal goes negative once the date has passed', () => {
  assert.equal(daysUntilRenewal('2026-08-05', TODAY), 10)
  assert.equal(daysUntilRenewal('2026-07-16', TODAY), -10)
})

describe('addMonths', () => {
  test('the ordinary case keeps the day of the month', () => {
    assert.equal(addMonths('2026-06-21', 12), '2027-06-21')
    assert.equal(addMonths('2026-06-21', 24), '2028-06-21')
  })

  test('rolls over the year boundary', () => {
    assert.equal(addMonths('2026-12-15', 1), '2027-01-15')
    assert.equal(addMonths('2026-11-30', 3), '2027-02-28')
  })

  test('clamps to the end of a shorter month instead of overflowing', () => {
    // Date.setMonth would give 2026-03-03 here, which is the bug this exists for.
    assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
    assert.equal(addMonths('2026-08-31', 3), '2026-11-30')
    assert.equal(addMonths('2026-05-31', 1), '2026-06-30')
  })

  test('knows about leap years', () => {
    assert.equal(addMonths('2028-01-31', 1), '2028-02-29')
    assert.equal(addMonths('2028-02-29', 12), '2029-02-28')
  })

  test('always returns a zero-padded ISO date', () => {
    assert.match(addMonths('2026-01-05', 1), /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(addMonths('2026-01-05', 1), '2026-02-05')
  })
})

describe('nextRenewalDate', () => {
  test('counts from the renewal date, not from today', () => {
    // Renewing five weeks late must not move the anniversary five weeks later.
    assert.equal(nextRenewalDate('2026-06-21', 12), '2027-06-21')
  })

  test('a 24-month term advances two years', () => {
    assert.equal(nextRenewalDate('2026-06-21', 24), '2028-06-21')
  })

  test('a nonsensical term still advances by at least a month', () => {
    // A zero-month term would otherwise return the same date forever and the
    // renewal would never clear.
    assert.equal(nextRenewalDate('2026-06-21', 0), '2026-07-21')
    assert.notEqual(nextRenewalDate('2026-06-21', 0), '2026-06-21')
  })
})

/* -------------------------------------------------------------------- targets */

describe('target units', () => {
  test('every metric declares a unit — an unmapped one would silently store a raw count', () => {
    for (const metric of ['NewBusinessTCV', 'NetNewMRR', 'ClosedWonCount', 'BillableUtilization', 'GrossMargin']) {
      assert.ok(TARGET_METRIC_UNIT[metric], `${metric} has no unit`)
    }
  })

  test('money and percent round-trip through the stored integer', () => {
    // €250,000 entered -> 25,000,000 cents stored -> €250,000 displayed.
    const storedMoney = Math.round(250_000 * 100)
    assert.equal(Math.round(storedMoney / 100), 250_000)

    // 75% entered -> 7500 bps stored -> 75% displayed.
    const storedPercent = Math.round(75 * 100)
    assert.equal(storedPercent / 100, 75)
  })
})

/* ------------------------------------------------------------------ traction */

describe('quarterOf / quarterEndDate', () => {
  test('maps months to their quarters at the boundaries', () => {
    assert.equal(quarterOf('2026-01-01'), '2026-Q1')
    assert.equal(quarterOf('2026-03-31'), '2026-Q1')
    assert.equal(quarterOf('2026-04-01'), '2026-Q2')
    assert.equal(quarterOf('2026-12-31'), '2026-Q4')
  })

  test('quarter ends land on the real last day, leap February included', () => {
    assert.equal(quarterEndDate('2026-Q1'), '2026-03-31')
    assert.equal(quarterEndDate('2026-Q2'), '2026-06-30')
    assert.equal(quarterEndDate('2026-Q4'), '2026-12-31')
    // 2028 is a leap year; Q1 still ends in March, but the month arithmetic
    // must not be fooled by February having 29 days.
    assert.equal(quarterEndDate('2028-Q1'), '2028-03-31')
  })

  test('a malformed quarter throws rather than returning nonsense', () => {
    assert.throws(() => quarterEndDate('2026-Q5'))
    assert.throws(() => quarterEndDate('Q3-2026'))
  })
})

describe('mondayOf / scorecardWeeks', () => {
  test('a Monday maps to itself', () => {
    assert.equal(mondayOf('2026-08-24'), '2026-08-24')
  })

  test('every other weekday walks back to its Monday, Sunday furthest', () => {
    assert.equal(mondayOf('2026-08-26'), '2026-08-24') // Wednesday
    assert.equal(mondayOf('2026-08-29'), '2026-08-24') // Saturday
    assert.equal(mondayOf('2026-08-30'), '2026-08-24') // Sunday — 6 back, not 1 forward
  })

  test('crosses a year boundary without flinching', () => {
    // 2026-01-01 is a Thursday; its Monday is 2025-12-29.
    assert.equal(mondayOf('2026-01-01'), '2025-12-29')
  })

  test('scorecardWeeks ends at the anchor week and counts backwards', () => {
    const weeks = scorecardWeeks('2026-08-26', 3)
    assert.deepEqual(weeks, ['2026-08-10', '2026-08-17', '2026-08-24'])
    assert.equal(scorecardWeeks('2026-08-26').length, 13)
  })
})

describe('measurableOnTrack / scorecardHitRateBps', () => {
  test('AtLeast wants the value at or above goal, AtMost at or below', () => {
    assert.equal(measurableOnTrack(12_000_00, 12_000_00, 'AtLeast'), true)
    assert.equal(measurableOnTrack(11_999_99, 12_000_00, 'AtLeast'), false)
    assert.equal(measurableOnTrack(15, 15, 'AtMost'), true)
    assert.equal(measurableOnTrack(16, 15, 'AtMost'), false)
  })

  test('hit rate is over recorded weeks only, and no data is null not zero', () => {
    assert.equal(scorecardHitRateBps([10, 20, 5, 30], 15, 'AtLeast'), 5_000)
    assert.equal(scorecardHitRateBps([], 15, 'AtLeast'), null)
  })
})

describe('todoCompletionBps', () => {
  test('only to-dos whose due date has arrived count as due', () => {
    const todos = [
      { done: true, dueDate: '2026-08-20' },   // due, done
      { done: false, dueDate: '2026-08-25' },  // due, not done
      { done: false, dueDate: '2026-09-01' },  // not yet due — must not count
    ]
    assert.equal(todoCompletionBps(todos, '2026-08-26'), 5_000)
  })

  test('nothing due yet is null, not a perfect score and not a zero', () => {
    assert.equal(todoCompletionBps([{ done: false, dueDate: '2026-09-01' }], '2026-08-26'), null)
    assert.equal(todoCompletionBps([], '2026-08-26'), null)
  })
})

describe('rockCompletionBps', () => {
  test('dropped rocks were descoped, not failed — they leave the denominator', () => {
    const rocks = [
      { status: 'Done' }, { status: 'OnTrack' }, { status: 'OffTrack' }, { status: 'Dropped' },
    ]
    assert.equal(rockCompletionBps(rocks), Math.round((1 / 3) * 10_000))
  })

  test('no rocks — or only dropped ones — is null', () => {
    assert.equal(rockCompletionBps([]), null)
    assert.equal(rockCompletionBps([{ status: 'Dropped' }]), null)
  })
})

describe('averageRating', () => {
  test('averages what exists, to one decimal', () => {
    assert.equal(averageRating([8, 7, 9]), 8)
    assert.equal(averageRating([8, null, 7]), 7.5)
    assert.equal(averageRating([7, 8, 8]), 7.7)
  })

  test('no ratings is null', () => {
    assert.equal(averageRating([]), null)
    assert.equal(averageRating([null, null]), null)
  })
})
