/**
 * The two credit decisions an administrator makes, and the one rule that
 * authorizes both.
 *
 * They are here rather than on the ledger for the reason the model policy
 * gives for its own write: the standing is a parameter, so the authority check
 * lives with the operation. A check in a surface or an RPC handler is bypassed
 * by the next caller — a maintenance task, a CLI, a setup wizard — while one
 * here cannot be.
 *
 * The rule is that a platform administrator administers anyone, and a tenant
 * administrator administers the people who hold standing in their own
 * organization. A member administers nobody, including themselves: being able
 * to grant yourself credits is the same as having no allowance.
 *
 * @module @lyness/lyn-credits/administration
 */

import { Service } from '@lyness/cordis'
import type { Context } from '@lyness/cordis'
import type { Domain } from '@lyness/lyn-storage-domain'
import { administers } from '@lyness/lyn-people'
import type { Membership, PersonId } from '@lyness/lyn-people'
import { allowanceKey } from './allowance.ts'
import type { AllowanceOverride, AllowanceRecord } from './allowance.ts'
import { allowanceDomain } from './allowance-storage.ts'
import type { ResetPeriod } from './period.ts'
import type { CreditGrant } from './types.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** Administrator credit decisions; absent on a deployment nobody administers credits on. */
    creditAdministration: CreditAdministration
  }
}

/** Message an unauthorized administrator attempt is refused with. */
export const NOT_PERMITTED = 'credits: this standing may not administer that person'

/** Message a grant of a non-positive amount is refused with. */
export const NOT_POSITIVE = 'credits: an administrator grant must be positive'

/** What an administrator adds to one person. */
export interface AdministratorGrant {
  /** Who receives the credits. */
  readonly person: PersonId
  /** How many to grant, positive. */
  readonly amount: number
  /**
   * When they lapse, as a UTC instant; absent means they do not.
   *
   * Stated per grant rather than per person because that is what an
   * administrator is deciding: these credits, for this long. A person whose
   * every grant expired together would lose bought credits to a lapsed gift.
   */
  readonly expiresAt?: string | undefined
}

/** What an administrator changes about a recurring allowance. */
export interface AllowanceChange extends AllowanceOverride {
  /** The organization whose people it applies to; absent means one person only. */
  readonly organization?: string | undefined
  /** The person it applies to; absent means every person in the organization. */
  readonly person?: PersonId | undefined
}

/** The overrides that reach one person, narrowest last. */
export interface PersonOverrides {
  /** The override set for an organization they hold standing in, if any. */
  readonly organization?: AllowanceOverride | undefined
  /** The override set for them specifically, if any. */
  readonly person?: AllowanceOverride | undefined
}

/** Cordis plugin name used by loader diagnostics. */
export const name = 'credits-administration'

/** Administrator credit decisions, authorized against the standing making them. */
export class CreditAdministration extends Service {
  static inject = ['credits', 'people', 'storageDomain']

  private readonly ready: Promise<Domain<typeof allowanceDomain>>

  /**
   * @param ctx - context providing the ledger, the directory, and storage.
   */
  constructor(ctx: Context) {
    super(ctx, 'creditAdministration')
    this.ready = ctx.storageDomain.open(allowanceDomain)
    ctx.effect(() => async () => { await (await this.ready).close() })
  }

  /**
   * Add credits to one person, on behalf of one standing.
   * @param request - who receives them, how many, and when they lapse.
   * @param by - the standing making the grant.
   * @returns the recorded grant.
   * @throws {Error} when the amount is not positive, or that standing may not administer that person.
   */
  async grant(request: AdministratorGrant, by: Membership): Promise<CreditGrant> {
    if (!Number.isInteger(request.amount) || request.amount <= 0) throw new Error(NOT_POSITIVE)
    await this.assertMayAdministerPerson(by, request.person)
    return this.ctx.credits.grant({
      person: request.person,
      amount: request.amount,
      reason: 'administrator',
      grantedBy: by.person,
      ...request.expiresAt === undefined ? {} : { expiresAt: request.expiresAt },
    })
  }

  /**
   * Set or replace one allowance override, on behalf of one standing.
   *
   * An override for a whole organization is a decision about that
   * organization, so it is authorized against the organization itself; one for
   * a person is authorized against that person's standings.
   * @param change - what to change, and whose allowance it applies to.
   * @param by - the standing making the change.
   * @throws {Error} when the change names neither an organization nor a person, or that standing may not administer it.
   */
  async setAllowance(change: AllowanceChange, by: Membership): Promise<void> {
    if (change.organization === undefined && change.person === undefined) {
      throw new Error('credits: an allowance override must name an organization or a person')
    }
    if (change.person === undefined) {
      if (!administers(by, change.organization)) throw new Error(NOT_PERMITTED)
    } else {
      await this.assertMayAdministerPerson(by, change.person)
    }
    const record: AllowanceRecord = {
      ...change.organization === undefined ? {} : { organization: change.organization },
      ...change.person === undefined ? {} : { person: change.person },
      ...change.periodicAmount === undefined ? {} : { periodicAmount: change.periodicAmount },
      ...change.period === undefined ? {} : { period: change.period },
      setAt: new Date().toISOString(),
      setBy: by.person,
    }
    const domain = await this.ready
    await domain.table('overrides').put(allowanceKey(change.organization, change.person), record)
  }

  /**
   * The overrides that reach one person.
   *
   * Read without an authority check because this is what the ledger itself
   * calls to work out a periodic grant; the decision it reports was already
   * authorized when it was made.
   * @param person - whose allowance to resolve.
   * @returns the organization-wide and person-specific overrides, where they exist.
   */
  async overridesFor(person: PersonId): Promise<PersonOverrides> {
    const domain = await this.ready
    const own = domain.table('overrides').get(allowanceKey(undefined, person))
    for (const membership of await this.ctx.people.memberships(person)) {
      if (membership.organization === undefined) continue
      const scoped = domain.table('overrides').get(allowanceKey(membership.organization, undefined))
      if (scoped === undefined) continue
      return { organization: scoped, ...own === undefined ? {} : { person: own } }
    }
    return own === undefined ? {} : { person: own }
  }

  /**
   * Refuse an administrator action on a person the standing may not administer.
   *
   * A tenant administrator reaches a person only through a standing they share
   * an organization with. Resolving that through the directory rather than
   * trusting a caller-supplied organization is the point: the caller names who
   * to act on, never the authority to do it.
   * @param by - the standing making the change.
   * @param person - the person it affects.
   * @throws {Error} when that standing may not administer that person.
   */
  private async assertMayAdministerPerson(by: Membership, person: PersonId): Promise<void> {
    if (by.role === 'platform-administrator') return
    for (const held of await this.ctx.people.memberships(person)) {
      if (administers(by, held.organization)) return
    }
    throw new Error(NOT_PERMITTED)
  }
}

/** Every reset period an administrator may choose. */
export const RESET_PERIODS: readonly ResetPeriod[] = ['daily', 'weekly', 'monthly']

export default CreditAdministration
