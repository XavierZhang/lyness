/**
 * Vocabulary for credits: what was granted, what was spent, and what a
 * balance is made of.
 *
 * @module @lyness/lyn-credits/types
 */

import type { Branded } from '@lyness/lyn-brand'
import type { PersonId } from '@lyness/lyn-people'

/** Opaque identity of one grant. */
export type GrantId = Branded<'GrantId'>

/** Opaque identity of one debit. */
export type DebitId = Branded<'DebitId'>

/** Why credits were granted, which decides how a surface explains them. */
export type GrantReason =
  /** The deployment's recurring free allowance. */
  | 'periodic'
  /** An administrator added them to one person. */
  | 'administrator'
  /** The person bought them. */
  | 'purchase'

/**
 * One grant of credits.
 *
 * Grants expire individually rather than as a balance, so a periodic
 * allowance can lapse at the next reset while purchased credits keep their
 * own longer life. A balance that expired as a whole would take the bought
 * ones with it.
 */
export interface CreditGrant {
  /** Stable identity of this grant. */
  readonly id: GrantId
  /** Whose credits these are. */
  readonly person: PersonId
  /** How many credits, always positive. */
  readonly amount: number
  /** When they were granted, as a UTC instant. */
  readonly grantedAt: string
  /** When they lapse, as a UTC instant; absent means they do not. */
  readonly expiresAt?: string | undefined
  /** Why they were granted. */
  readonly reason: GrantReason
  /** Who granted them, for an administrator grant; absent for a periodic one. */
  readonly grantedBy?: PersonId | undefined
}

/** One spend of credits, always attributable to the session that caused it. */
export interface CreditDebit {
  /** Stable identity of this debit. */
  readonly id: DebitId
  /** Whose credits were spent. */
  readonly person: PersonId
  /** How many credits, always positive. */
  readonly amount: number
  /** When they were spent, as a UTC instant. */
  readonly at: string
  /**
   * The session that spent them.
   *
   * Recorded on every debit because a refusal a customer cannot account for
   * is a support case; a balance whose every debit names its session is
   * answerable.
   */
  readonly session: string
}

/** What one person's balance is made of, at one instant. */
export interface CreditBalance {
  /** Whose balance this is. */
  readonly person: PersonId
  /** Credits available to spend now: unexpired grants less everything spent. */
  readonly available: number
  /** Everything granted and not yet expired. */
  readonly granted: number
  /** Everything spent. */
  readonly spent: number
  /** When the next periodic grant is due, as a UTC instant. */
  readonly nextGrantAt?: string | undefined
}

/** Why a spend was refused. */
export type RefusalReason =
  /** The balance reached zero. */
  | 'exhausted'
  /** The organization capped this person below what they would otherwise have. */
  | 'capped'
