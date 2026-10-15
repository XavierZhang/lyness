/**
 * "Daily" means daily where the deployment is, not where UTC is.
 */

import { expect, it } from 'vitest'
import { nextPeriodStart, periodStart } from '../src/period.ts'

/** UTC+8, the clock this deployment's grants are counted against. */
const CST = 8

it('starts the day at local midnight, not at UTC midnight', () => {
  // 2026-10-15T02:00Z is 10:00 in UTC+8, so that local day began at 16:00Z.
  expect(periodStart(new Date('2026-10-15T02:00:00Z'), 'daily', CST).toISOString())
    .toBe('2026-10-14T16:00:00.000Z')
})

it('puts an instant just before local midnight in the previous day', () => {
  // 15:59Z is 23:59 local, still the previous local day.
  expect(periodStart(new Date('2026-10-14T15:59:00Z'), 'daily', CST).toISOString())
    .toBe('2026-10-13T16:00:00.000Z')
})

it('rolls to the next local midnight', () => {
  expect(nextPeriodStart(new Date('2026-10-15T02:00:00Z'), 'daily', CST).toISOString())
    .toBe('2026-10-15T16:00:00.000Z')
})

it('starts a week on local Monday', () => {
  // 2026-10-15 local is a Thursday; that week began Monday the 12th local.
  expect(periodStart(new Date('2026-10-15T02:00:00Z'), 'weekly', CST).toISOString())
    .toBe('2026-10-11T16:00:00.000Z')
  expect(nextPeriodStart(new Date('2026-10-15T02:00:00Z'), 'weekly', CST).toISOString())
    .toBe('2026-10-18T16:00:00.000Z')
})

it('starts a month on the local first', () => {
  expect(periodStart(new Date('2026-10-15T02:00:00Z'), 'monthly', CST).toISOString())
    .toBe('2026-09-30T16:00:00.000Z')
  expect(nextPeriodStart(new Date('2026-10-15T02:00:00Z'), 'monthly', CST).toISOString())
    .toBe('2026-10-31T16:00:00.000Z')
})

it('crosses a year boundary on the monthly reset', () => {
  expect(nextPeriodStart(new Date('2026-12-20T02:00:00Z'), 'monthly', CST).toISOString())
    .toBe('2026-12-31T16:00:00.000Z')
})

it('works for a deployment on UTC itself', () => {
  expect(periodStart(new Date('2026-10-15T02:00:00Z'), 'daily', 0).toISOString())
    .toBe('2026-10-15T00:00:00.000Z')
})
