/**
 * When a periodic grant is due, and which grants it replaces.
 *
 * The clock is a deployment value because "daily" is only meaningful against
 * a timezone, and a deployment serving one region differs from one serving
 * several.
 *
 * @module @deepseek-ai/dsh-credits/period
 */

/** How often a periodic allowance arrives. */
export type ResetPeriod = 'daily' | 'weekly' | 'monthly'

/** Milliseconds in one hour, for offset arithmetic. */
const HOUR_MS = 3_600_000

/** Milliseconds in one day. */
const DAY_MS = 24 * HOUR_MS

/**
 * The instant the current period began, for one clock offset.
 *
 * Computed by shifting into the deployment's local day, truncating, and
 * shifting back, so a UTC+8 deployment resets at 00:00 in Beijing rather than
 * at 08:00 — which is what "daily" means to the people using it.
 * @param at - the instant being classified.
 * @param period - how often the allowance arrives.
 * @param offsetHours - the deployment's clock offset from UTC, such as 8.
 * @returns the start of the period containing `at`.
 */
export function periodStart(at: Date, period: ResetPeriod, offsetHours: number): Date {
  const shifted = new Date(at.getTime() + offsetHours * HOUR_MS)
  const year = shifted.getUTCFullYear()
  const month = shifted.getUTCMonth()
  const day = shifted.getUTCDate()
  let localStart: number
  if (period === 'monthly') {
    localStart = Date.UTC(year, month, 1)
  } else if (period === 'weekly') {
    // Weeks start on Monday, which is what a working week means to the
    // deployments this serves.
    const weekday = (shifted.getUTCDay() + 6) % 7
    localStart = Date.UTC(year, month, day) - weekday * DAY_MS
  } else {
    localStart = Date.UTC(year, month, day)
  }
  return new Date(localStart - offsetHours * HOUR_MS)
}

/**
 * When the period after the one containing `at` begins.
 * @param at - the instant being classified.
 * @param period - how often the allowance arrives.
 * @param offsetHours - the deployment's clock offset from UTC.
 * @returns the start of the next period.
 */
export function nextPeriodStart(at: Date, period: ResetPeriod, offsetHours: number): Date {
  const start = periodStart(at, period, offsetHours)
  if (period === 'monthly') {
    const shifted = new Date(start.getTime() + offsetHours * HOUR_MS)
    const local = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 1)
    return new Date(local - offsetHours * HOUR_MS)
  }
  return new Date(start.getTime() + (period === 'weekly' ? 7 * DAY_MS : DAY_MS))
}
