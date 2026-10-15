/**
 * Service Definition for credits: a free allowance a hosted deployment grants,
 * spends, and refuses when exhausted.
 *
 * This exists only on the hosted shape. An enterprise installation mounts no
 * credit module at all, because the customer bought the system rather than
 * usage of it — credits are absent there rather than disabled, which is the
 * only version of "no quota" that cannot leak a balance into a surface, a
 * log, or an error message.
 *
 * A balance is a ledger rather than a counter. Grants and debits are both
 * recorded, and the balance is what they add up to, because a refusal a
 * customer cannot account for is a support case while a balance whose every
 * debit names its session is answerable.
 *
 * @module @lyness/lyn-credits
 */

import { Service } from '@lyness/cordis'
import type { Context } from '@lyness/cordis'
import type { PersonId } from '@lyness/lyn-people'
import type { CreditBalance, CreditDebit, CreditGrant, GrantReason } from './types.ts'

export type {
  CreditBalance, CreditDebit, CreditGrant, DebitId, GrantId, GrantReason, RefusalReason,
} from './types.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** Credits one person may spend; absent on a deployment that meters none. */
    credits: CreditLedger
  }
}

/** A refused spend, carrying what a surface needs to explain it. */
export class CreditsExhausted extends Error {
  /** Credits available when the spend was refused. */
  readonly available: number

  /** When the next periodic grant is due, when one is. */
  readonly nextGrantAt: string | undefined

  /**
   * @param available - credits available at the moment of refusal.
   * @param nextGrantAt - when the next periodic grant arrives, when one does.
   */
  constructor(available: number, nextGrantAt?: string) {
    super(nextGrantAt === undefined
      ? `out of credits (${String(available)} available)`
      : `out of credits (${String(available)} available; the next grant arrives ${nextGrantAt})`)
    this.name = 'CreditsExhausted'
    this.available = available
    this.nextGrantAt = nextGrantAt
  }
}

/** One spend a caller asks the ledger to record. */
export interface SpendRequest {
  /** Whose credits to spend. */
  readonly person: PersonId
  /** How many to spend, positive. */
  readonly amount: number
  /** The session that caused the spend, recorded on the debit. */
  readonly session: string
}

/** One grant an administrator or the deployment adds. */
export interface GrantRequest {
  /** Who receives the credits. */
  readonly person: PersonId
  /** How many to grant, positive. */
  readonly amount: number
  /** Why they are granted. */
  readonly reason: GrantReason
  /** When they lapse, as a UTC instant; absent means they do not. */
  readonly expiresAt?: string | undefined
  /** Who granted them, for an administrator grant. */
  readonly grantedBy?: PersonId | undefined
}

/**
 * Abstract credit ledger. Subclass and implement the four operations for one
 * source of truth; a hosted deployment mounts exactly one.
 */
export abstract class CreditLedger extends Service {
  /**
   * @param ctx - the context this ledger serves.
   */
  constructor(ctx: Context) {
    super(ctx, 'credits')
  }

  /**
   * What one person may spend now.
   * @param person - whose balance to read.
   * @returns the balance, including what it is made of.
   */
  abstract balance(person: PersonId): Promise<CreditBalance>

  /**
   * Spend credits, or refuse when the balance cannot cover it.
   *
   * Refusing rather than overdrawing is the whole point: an overdraw is a cost
   * the operator did not agree to, and a person who can exceed a balance has
   * no balance.
   * @param request - whose credits, how many, and which session.
   * @returns the recorded debit.
   * @throws {CreditsExhausted} when the available balance cannot cover the amount.
   */
  abstract spend(request: SpendRequest): Promise<CreditDebit>

  /**
   * Add credits to one person.
   * @param request - who receives them, how many, why, and when they lapse.
   * @returns the recorded grant.
   */
  abstract grant(request: GrantRequest): Promise<CreditGrant>

  /**
   * Everything granted to and spent by one person, newest first.
   *
   * The ledger is the product rather than an implementation detail: a
   * customer reviewing a refusal reads this, and a balance they cannot
   * account for is a support case.
   * @param person - whose history to read.
   * @returns the grants and debits recorded for them.
   */
  abstract history(person: PersonId): Promise<{
    readonly grants: readonly CreditGrant[]
    readonly debits: readonly CreditDebit[]
  }>
}

export default CreditLedger
