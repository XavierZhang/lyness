/**
 * Wire vocabulary of the credits surface, and its failure codes.
 *
 * Views rather than the ledger's own types: ids are branded in the Host and
 * plain strings on the wire, and a read adds the fact the ledger does not
 * carry — whether the caller may administer the person they are looking at,
 * which is what decides whether a surface offers a grant at all.
 * @module @deepseek-ai/dsh-api-credits-controller/types
 */

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /**
     * The call presented no identity. Not a validation failure: credits belong
     * to a person, and an anonymous call names none.
     */
    'credits/anonymous': Record<string, never>
    /**
     * The calling standing may not act on that person. Distinct from an
     * invalid request: the same arguments from an administrator of that
     * person's organization would be accepted.
     */
    'credits/not-permitted': { readonly person: string }
    /**
     * The administration seam refused the change. `reason` is its own message,
     * because it owns the rule — a non-positive grant, or an override naming
     * neither an organization nor a person.
     */
    'credits/rejected': { readonly reason: string }
    /**
     * This deployment mounts no ledger, so there are no credits to read or
     * grant. A standalone installation that meters nothing is the normal case.
     */
    'credits/unavailable': Record<string, never>
  }
}

/** How often a recurring allowance arrives. */
export type ResetPeriodView = 'daily' | 'weekly' | 'monthly'

/** One grant, as a surface shows it. */
export interface CreditGrantView {
  /** Stable identity of this grant. */
  readonly id: string
  /** How many credits, always positive. */
  readonly amount: number
  /** When they were granted, as a UTC instant. */
  readonly grantedAt: string
  /** When they lapse, as a UTC instant; absent means they do not. */
  readonly expiresAt?: string
  /** Why they were granted. */
  readonly reason: 'periodic' | 'administrator' | 'purchase'
  /** Who granted them, for an administrator grant. */
  readonly grantedBy?: string
}

/** One spend, as a surface shows it. */
export interface CreditDebitView {
  /** Stable identity of this debit. */
  readonly id: string
  /** How many credits, always positive. */
  readonly amount: number
  /** When they were spent, as a UTC instant. */
  readonly at: string
  /** The session that spent them, so a balance stays answerable. */
  readonly session: string
}

/** One person's credits, with everything a surface needs to explain them. */
export interface CreditAccountView {
  /** Whose account this is. */
  readonly person: string
  /** Credits available to spend now. */
  readonly available: number
  /** Everything granted and not yet expired. */
  readonly granted: number
  /** Everything spent. */
  readonly spent: number
  /**
   * Credits this person receives each period, with every override applied.
   *
   * Sent to every reader, including one who administers nobody: a person
   * cannot tell a quiet day from a lowered allowance without it, and their
   * own limit is the one number they are always entitled to.
   */
  readonly periodicAmount: number
  /** How long one period is. */
  readonly period: ResetPeriodView
  /** When the current period began, as a UTC instant. */
  readonly periodStartedAt: string
  /** What they have spent since the current period began. */
  readonly spentThisPeriod: number
  /** When the next periodic grant is due, as a UTC instant; absent when they receive none. */
  readonly nextGrantAt?: string
  /** Grants recorded for them, newest first. */
  readonly grants: readonly CreditGrantView[]
  /** Debits recorded for them, newest first. */
  readonly debits: readonly CreditDebitView[]
  /**
   * Whether the caller may grant credits and set allowances here.
   *
   * Sent with the account rather than asked for separately so a surface
   * renders the administrator controls from the same answer that fills them,
   * and never shows a control the next call would refuse.
   */
  readonly administrable: boolean
}

/** One recurring-allowance override, as a surface shows it. */
export interface AllowanceOverrideView {
  /** Credits granted each period; absent leaves the inherited amount. */
  readonly periodicAmount?: number
  /** How often the allowance arrives; absent leaves the inherited period. */
  readonly period?: ResetPeriodView
  /** When it was set, as a UTC instant. */
  readonly setAt: string
  /** Who set it. */
  readonly setBy: string
}

/** The overrides reaching one person, narrowest last. */
export interface AllowanceView {
  /** Whose allowance this describes. */
  readonly person: string
  /** The override set for an organization they hold standing in, if any. */
  readonly organization?: AllowanceOverrideView
  /** The override set for them specifically, if any. */
  readonly own?: AllowanceOverrideView
  /** Every period an administrator may choose, so a form offers no other. */
  readonly periods: readonly ResetPeriodView[]
}

/** What one organization bought, and what is left of it this period. */
export interface BudgetView {
  /** The organization this is the ceiling for. */
  readonly organization: string
  /**
   * Credits its people may spend together in one period; absent when nobody
   * set a ceiling, which is no ceiling rather than a ceiling of zero.
   */
  readonly periodicAmount?: number
  /** How long one period is; absent with the ceiling. */
  readonly period?: ResetPeriodView
  /** What its people have spent together since this period began; absent with the ceiling. */
  readonly spent?: number
  /** What is left before the period turns; absent with the ceiling. */
  readonly remaining?: number
  /** When the current period began, as a UTC instant; absent with the ceiling. */
  readonly periodStartedAt?: string
  /** When it turns and the ceiling applies again, as a UTC instant; absent with the ceiling. */
  readonly nextPeriodAt?: string
  /** The periods a form may offer. */
  readonly periods: readonly ResetPeriodView[]
  /**
   * Whether this caller may change the ceiling.
   *
   * Answered with the read so a surface renders its control from the same
   * answer that fills it, instead of offering one the next call would refuse.
   * Only a platform standing may: an organization that could raise its own
   * ceiling would have none.
   */
  readonly settable: boolean
}

/** What a platform administrator sets as one organization's ceiling. */
export interface BudgetInput {
  /** The organization to set it for. */
  readonly organization: string
  /** Credits its people may spend together in one period; zero is a decision. */
  readonly periodicAmount: number
  /** How long one period is. */
  readonly period: ResetPeriodView
}

/** What an administrator adds to one person. */
export interface CreditGrantInput {
  /** Who receives the credits. */
  readonly person: string
  /** How many to grant, a positive whole number. */
  readonly amount: number
  /** When they lapse, as a UTC instant; absent means they do not. */
  readonly expiresAt?: string
}

/** What an administrator changes about a recurring allowance. */
export interface AllowanceInput {
  /** The organization whose people it applies to; absent means one person only. */
  readonly organization?: string
  /** The person it applies to; absent means every person in the organization. */
  readonly person?: string
  /** Credits granted each period; absent leaves the inherited amount. */
  readonly periodicAmount?: number
  /** How often the allowance arrives; absent leaves the inherited period. */
  readonly period?: ResetPeriodView
}
