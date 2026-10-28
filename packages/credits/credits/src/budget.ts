/**
 * What one organization bought, and what is left of it this period.
 *
 * A budget is not an allowance. An allowance is what the organization gives
 * each of its own people; a budget is the ceiling on everything they spend
 * together, and it is what the organization bought from the operator. That is
 * why the two are different records with different authorities: a tenant
 * administrator changes what their members get, and only a platform standing
 * changes what the organization may spend in total — an organization that
 * could raise its own ceiling has no ceiling.
 *
 * The ceiling is read per period rather than drawn down from a stored total,
 * for the reason the allowance is: a standing decision must not rewrite last
 * month's spending, and a month that has turned starts at the ceiling again
 * without anything having to run at the turn.
 *
 * @module @deepseek-ai/dsh-credits/budget
 */

import type { PersonId } from '@deepseek-ai/dsh-people'
import type { ResetPeriod } from './period.ts'

/** What one organization may spend together, as the deployment stores it. */
export interface OrganizationBudget {
  /** The organization this is the ceiling for. */
  readonly organization: string
  /** Credits its people may spend together in one period. */
  readonly periodicAmount: number
  /** How long one period is. */
  readonly period: ResetPeriod
  /** When it was set, as a UTC instant. */
  readonly setAt: string
  /** Who set it. */
  readonly setBy: PersonId
}

/** What an administrator submits to set or replace one organization's ceiling. */
export interface BudgetChange {
  /** The organization to set it for. */
  readonly organization: string
  /** Credits its people may spend together in one period. */
  readonly periodicAmount: number
  /** How long one period is. */
  readonly period: ResetPeriod
}

/** One organization's ceiling and what is left of it now. */
export interface BudgetState {
  /** The organization this is the ceiling for. */
  readonly organization: string
  /** Credits its people may spend together in one period. */
  readonly periodicAmount: number
  /** How long one period is. */
  readonly period: ResetPeriod
  /** What its people have spent together since this period began. */
  readonly spent: number
  /** What is left to spend before the period turns. */
  readonly remaining: number
  /** When the current period began, as a UTC instant. */
  readonly periodStartedAt: string
  /** When it turns and the ceiling applies again, as a UTC instant. */
  readonly nextPeriodAt: string
}

/**
 * What is left of one ceiling.
 *
 * Never negative: one request can take an organization past its ceiling,
 * because a call that already produced an answer is settled rather than
 * failed, and reporting a negative remainder would invite a surface to show a
 * debt nobody owes.
 * @param periodicAmount - the ceiling for one period.
 * @param spent - what the organization's people have spent since the period began.
 * @returns the credits left before the period turns.
 */
export function remainingOf(periodicAmount: number, spent: number): number {
  return Math.max(0, periodicAmount - spent)
}
