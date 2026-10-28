/**
 * Per-person and per-organization overrides of the recurring allowance.
 *
 * The deployment's own numbers are the floor a hosted install ships with;
 * these are what a tenant administrator changes for the people in their own
 * organization. They are a separate record from the ledger because they are a
 * standing decision, not a transaction: changing next month's allowance must
 * not rewrite last month's grants, and reading a balance must not depend on
 * replaying every policy change that ever applied.
 *
 * An override states only what it changes. A tenant raising the daily amount
 * and saying nothing about the period leaves the period where the deployment
 * put it, so a later change to the deployment default still reaches them.
 *
 * @module @deepseek-ai/dsh-credits/allowance
 */

import type { PersonId } from '@deepseek-ai/dsh-people'
import type { ResetPeriod } from './period.ts'

/** What one override changes about a recurring allowance. */
export interface AllowanceOverride {
  /** Credits granted each period; absent leaves the inherited amount. */
  readonly periodicAmount?: number | undefined
  /** How often the allowance arrives; absent leaves the inherited period. */
  readonly period?: ResetPeriod | undefined
}

/** One override and who it applies to. */
export interface AllowanceRecord extends AllowanceOverride {
  /** The organization whose people it applies to; absent means one person only. */
  readonly organization?: string | undefined
  /** The person it applies to; absent means every person in the organization. */
  readonly person?: PersonId | undefined
  /** When it was set, as a UTC instant. */
  readonly setAt: string
  /** Who set it. */
  readonly setBy: PersonId
}

/** A recurring allowance with every override applied. */
export interface EffectiveAllowance {
  /** Credits granted each period. */
  readonly periodicAmount: number
  /** How often the allowance arrives. */
  readonly period: ResetPeriod
}

/**
 * Fold the overrides that reach one person onto the deployment's own numbers.
 *
 * The order is deployment, then organization, then person: the narrower
 * decision wins, because that is the one someone made about this person
 * specifically. An absent field is not a decision, so it never overrides
 * anything.
 * @param base - the deployment's recurring allowance.
 * @param organization - the organization's override, if it set one.
 * @param person - the person's own override, if someone set one.
 * @returns the allowance this person's periodic grant uses.
 */
export function effectiveAllowance(
  base: EffectiveAllowance,
  organization: AllowanceOverride | undefined,
  person: AllowanceOverride | undefined,
): EffectiveAllowance {
  return {
    periodicAmount: person?.periodicAmount ?? organization?.periodicAmount ?? base.periodicAmount,
    period: person?.period ?? organization?.period ?? base.period,
  }
}

/**
 * The key one override is stored and found under.
 *
 * Both parts are in the key because the two scopes are different decisions: an
 * override for everyone in an organization and one for a single person must
 * not collide, even when a person's identity and an organization's name
 * happen to read the same.
 * @param organization - the organization it applies to, or undefined for a person-only override.
 * @param person - the person it applies to, or undefined for an organization-wide one.
 * @returns the lookup key.
 */
export function allowanceKey(organization: string | undefined, person: PersonId | undefined): string {
  return JSON.stringify([organization ?? null, person ?? null])
}
