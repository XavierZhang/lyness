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
 * One decision is not covered by that rule. What an organization may spend in
 * total is what it bought from the operator, so only a platform standing sets
 * it — a tenant administrator who could raise their own organization's
 * ceiling would have no ceiling. That is why the budget is not an allowance
 * override and not part of the configuration a tenant saves for itself.
 *
 * @module @deepseek-ai/dsh-credits/administration
 */

import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import { fieldChanges } from '@deepseek-ai/dsh-admin-audit'
import type {} from '@deepseek-ai/dsh-admin-audit'
import { administers } from '@deepseek-ai/dsh-people'
import type { Membership, PersonId } from '@deepseek-ai/dsh-people'
import { allowanceKey } from './allowance.ts'
import type { AllowanceOverride, AllowanceRecord } from './allowance.ts'
import { allowanceDomain } from './allowance-storage.ts'
import type { BudgetChange, BudgetState, OrganizationBudget } from './budget.ts'
import type { ResetPeriod } from './period.ts'
import type { CreditGrant } from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Administrator credit decisions; absent on a deployment nobody administers credits on. */
    creditAdministration: CreditAdministration
  }
}

/** Message an unauthorized administrator attempt is refused with. */
export const NOT_PERMITTED = 'credits: this standing may not administer that person'

/** Message a grant of a non-positive amount is refused with. */
export const NOT_POSITIVE = 'credits: an administrator grant must be positive'

/** Message a budget change by anything but a platform standing is refused with. */
export const NOT_PLATFORM = 'credits: only a platform standing sets what an organization bought'

/** Message a budget with a negative ceiling is refused with. */
export const NOT_A_CEILING = 'credits: an organization budget cannot be negative'

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

/**
 * The overrides that reach one person, narrowest last.
 *
 * Stored records rather than bare overrides: who set one and when is what an
 * administrator reading somebody else's allowance is looking for, and it is
 * already on the row.
 */
export interface PersonOverrides {
  /** The override set for an organization they hold standing in, if any. */
  readonly organization?: AllowanceRecord | undefined
  /** The override set for them specifically, if any. */
  readonly person?: AllowanceRecord | undefined
}

/** Cordis plugin name used by loader diagnostics. */
export const name = 'credits-administration'

/** Administrator credit decisions, authorized against the standing making them. */
export class CreditAdministration extends Service {
  static inject = ['credits', 'people', 'storageDomain', 'adminAudit']

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
    const key = allowanceKey(change.organization, change.person)
    const existing = domain.table('overrides').get(key)
    await domain.table('overrides').put(key, record)
    // An override is replaced in place, so what it used to allow is only
    // readable from the trail. A grant is not recorded there: the ledger row
    // is already an immutable record naming who granted what to whom.
    const changes = fieldChanges(
      existing === undefined ? undefined : allowanceFields(existing),
      allowanceFields(record),
    )
    if (existing !== undefined && changes.length === 0) return
    await this.ctx.adminAudit.record({
      kind: 'credit-allowance',
      subject: key,
      subjectName: change.organization ?? String(change.person),
      action: existing === undefined ? 'added' : 'changed',
      // The organization of the standing that made the decision, so a tenant
      // administrator reads back the overrides they set; a platform standing
      // holds none, and those entries are read with the whole trail.
      ...by.organization === undefined ? {} : { organization: by.organization },
      changes,
    }, by)
  }

  /**
   * Set or replace what one organization may spend in total, on behalf of one
   * standing.
   *
   * Authorized against the platform rather than against the organization: a
   * ceiling an organization can raise is not a ceiling. This is the one credit
   * decision `administers` does not answer, because that predicate is true for
   * a tenant administrator of the organization named.
   * @param change - the organization, the ceiling, and the period it applies to.
   * @param by - the standing making the change.
   * @returns the stored ceiling.
   * @throws {Error} when the ceiling is negative or not whole, or that standing is not a platform one.
   */
  async setBudget(change: BudgetChange, by: Membership): Promise<OrganizationBudget> {
    if (!this.maySetBudget(by)) throw new Error(NOT_PLATFORM)
    if (!Number.isInteger(change.periodicAmount) || change.periodicAmount < 0) throw new Error(NOT_A_CEILING)
    const existing = await this.ctx.credits.budget(change.organization)
    const stored = await this.ctx.credits.setBudget(change, by.person)
    const changes = fieldChanges(
      existing === undefined ? undefined : ceilingFields(existing),
      ceilingFields(stored),
    )
    if (existing !== undefined && changes.length === 0) return stored
    await this.ctx.adminAudit.record({
      kind: 'credit-budget',
      subject: change.organization,
      subjectName: change.organization,
      action: existing === undefined ? 'added' : 'changed',
      // Deliberately no organization on the entry: what an organization
      // bought is the platform's own record, read with the whole trail rather
      // than by the organization whose ceiling it is.
      changes,
    }, by)
    return stored
  }

  /**
   * What one organization bought, and what is left of it, on behalf of one
   * standing.
   *
   * Authorized against the organization rather than the platform: an
   * organization may see its own ceiling and what it has spent against it —
   * that is its own money and its own usage — while only a platform standing
   * changes the ceiling.
   * @param organization - whose ceiling to read.
   * @param by - the standing asking.
   * @returns the ceiling and what is left, or undefined where nobody set one.
   * @throws {Error} when that standing may not administer that organization.
   */
  async budgetFor(organization: string, by: Membership): Promise<BudgetState | undefined> {
    if (!administers(by, organization)) throw new Error(NOT_PERMITTED)
    return this.ctx.credits.budget(organization)
  }

  /**
   * Whether one standing may change what an organization bought.
   *
   * Public because a surface that offers the control answers the same
   * question the change does, and two copies of this rule would be one rule
   * too many.
   * @param by - the standing asking.
   * @returns true when it may set an organization's ceiling.
   */
  maySetBudget(by: Membership): boolean {
    return by.role === 'platform-administrator'
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
   * Whether one standing may act on one person's credits.
   *
   * A tenant administrator reaches a person only through a standing they share
   * an organization with. Resolving that through the directory rather than
   * trusting a caller-supplied organization is the point: the caller names who
   * to act on, never the authority to do it.
   *
   * Public because a surface that shows one person's ledger to another answers
   * the same question a grant does, and two copies of this rule would be one
   * rule too many.
   * @param by - the standing asking.
   * @param person - the person it would affect.
   * @returns true when that standing may administer that person.
   */
  async mayAdminister(by: Membership, person: PersonId): Promise<boolean> {
    if (by.role === 'platform-administrator') return true
    for (const held of await this.ctx.people.memberships(person)) {
      if (administers(by, held.organization)) return true
    }
    return false
  }

  /**
   * Refuse an administrator action on a person the standing may not administer.
   * @param by - the standing making the change.
   * @param person - the person it affects.
   * @throws {Error} when that standing may not administer that person.
   */
  private async assertMayAdministerPerson(by: Membership, person: PersonId): Promise<void> {
    if (!await this.mayAdminister(by, person)) throw new Error(NOT_PERMITTED)
  }
}

/**
 * One organization ceiling's audited fields.
 *
 * Only what the platform decided: how much per period and how long a period
 * is. What has been spent against it is the ledger's answer, not a decision.
 */
function ceilingFields(record: { periodicAmount: number; period: ResetPeriod }): Record<string, string> {
  return { periodicAmount: String(record.periodicAmount), period: record.period }
}

/**
 * One allowance override's audited fields.
 *
 * Only what an administrator decided: how much each period and how often. Who
 * set it and when are on the trail's own entry, so repeating them would be
 * two answers to one question.
 */
function allowanceFields(record: AllowanceRecord): Record<string, string> {
  return {
    ...record.periodicAmount === undefined ? {} : { periodicAmount: String(record.periodicAmount) },
    ...record.period === undefined ? {} : { period: record.period },
  }
}

/** Every reset period an administrator may choose. */
export const RESET_PERIODS: readonly ResetPeriod[] = ['daily', 'weekly', 'monthly']

export default CreditAdministration
