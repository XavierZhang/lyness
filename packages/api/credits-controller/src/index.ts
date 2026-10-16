/**
 * Host Remote owner of the `credits` namespace: a person reads their own
 * balance, and an administrator grants credits and sets allowances.
 *
 * Every call acts for the standing the request arrived in, never for one the
 * caller names. The authority check itself stays in `lyn-credits` — the same
 * rule decides whether a grant is permitted and whether one person's ledger
 * may be shown to another, and two copies of it would be one too many.
 *
 * A read answers with `administrable` so a surface renders its administrator
 * controls from the same answer that fills them, instead of offering a
 * control the next call would refuse.
 * @module @lyness/lyn-api-credits-controller
 */

import { Context } from '@lyness/cordis'
import type { CreditBalance, CreditDebit, CreditGrant } from '@lyness/lyn-credits'
import type { AllowanceRecord } from '@lyness/lyn-credits/allowance'
import { RESET_PERIODS } from '@lyness/lyn-credits/administration'
import type { CreditAdministration, PersonOverrides } from '@lyness/lyn-credits/administration'
import type { Membership, PersonId } from '@lyness/lyn-people'
import { brandString } from '@lyness/lyn-brand'
import type {} from '@lyness/lyn-request-principal'
import { Remote, RemoteError, TypertRemoteService } from '@lyness/lyn-typert-protocol'
import { z } from 'zod'
import type {
  AllowanceInput, AllowanceOverrideView, AllowanceView,
  CreditAccountView, CreditDebitView, CreditGrantInput, CreditGrantView,
} from './types.ts'

export type * from './types.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** Host owner of the `credits` Remote namespace. */
    creditsController: CreditsController
  }
}

/** Message a deployment that meters nothing answers every credits call with. */
const NO_LEDGER = 'this deployment mounts no credit ledger'

/** Message a read or change of somebody else's credits is refused with. */
const NOT_PERMITTED = 'this standing may not administer that person'

const grantSchema = z.object({
  person: z.string().min(1),
  amount: z.number().int().positive(),
  expiresAt: z.iso.datetime().optional(),
}).strict()

const allowanceSchema = z.object({
  organization: z.string().min(1).optional(),
  person: z.string().min(1).optional(),
  periodicAmount: z.number().int().nonnegative().optional(),
  period: z.enum(['daily', 'weekly', 'monthly']).optional(),
}).strict()

/**
 * Project one grant onto its wire view.
 * @param grant - the recorded grant.
 * @returns the wire grant, with absent optionals dropped rather than serialized.
 */
function grantView(grant: CreditGrant): CreditGrantView {
  return {
    id: String(grant.id),
    amount: grant.amount,
    grantedAt: grant.grantedAt,
    reason: grant.reason,
    ...grant.expiresAt === undefined ? {} : { expiresAt: grant.expiresAt },
    ...grant.grantedBy === undefined ? {} : { grantedBy: String(grant.grantedBy) },
  }
}

/**
 * Project one debit onto its wire view.
 * @param debit - the recorded debit.
 * @returns the wire debit.
 */
function debitView(debit: CreditDebit): CreditDebitView {
  return { id: String(debit.id), amount: debit.amount, at: debit.at, session: debit.session }
}

/**
 * Project one stored override onto its wire view.
 * @param record - the stored override.
 * @returns the wire override.
 */
function overrideView(record: AllowanceRecord): AllowanceOverrideView {
  return {
    setAt: record.setAt,
    setBy: String(record.setBy),
    ...record.periodicAmount === undefined ? {} : { periodicAmount: record.periodicAmount },
    ...record.period === undefined ? {} : { period: record.period },
  }
}

/**
 * Project the overrides reaching one person onto their wire view.
 * @param person - whose allowance this describes.
 * @param overrides - the organization-wide and person-specific overrides.
 * @returns the wire allowance, including the periods a form may offer.
 */
function allowanceView(person: string, overrides: PersonOverrides): AllowanceView {
  const organization = overrides.organization
  const own = overrides.person
  return {
    person,
    periods: RESET_PERIODS,
    ...organization === undefined ? {} : { organization: overrideView(organization) },
    ...own === undefined ? {} : { own: overrideView(own) },
  }
}

/** Host service backing the generated `ctx.remote.credits` namespace. */
export default class CreditsController extends TypertRemoteService {
  /**
   * Register the credits namespace.
   * @param ctx - Host context where the ledger, the directory, and the request principal may be mounted.
   */
  constructor(ctx: Context) {
    super(ctx, 'creditsController', { namespace: 'credits' })
  }

  /**
   * Read the calling person's own account.
   * @returns their balance and ledger, and whether they may administer anyone.
   * @throws {RemoteError} `credits/anonymous` when the call presented no identity,
   * or `credits/unavailable` when this deployment mounts no ledger.
   */
  @Remote
  async mine(): Promise<CreditAccountView> {
    const person = this.caller()
    return this.read(person, await this.administersAnyone())
  }

  /**
   * Read one person's account as an administrator.
   * @param person - whose account to read.
   * @returns their balance and ledger.
   * @throws {RemoteError} `credits/anonymous`, `credits/unavailable`, or
   * `credits/not-permitted` when the calling standing may not act on that person.
   */
  @Remote
  async account(person: string): Promise<CreditAccountView> {
    const subject = brandString<PersonId>(person)
    if (subject !== this.caller()) await this.assertAdministers(subject)
    return this.read(subject, true)
  }

  /**
   * Add credits to one person.
   * @param input - who receives them, how many, and when they lapse.
   * @returns that person's account as the ledger now reads it.
   * @throws {RemoteError} `credits/anonymous`, `credits/unavailable`,
   * `gateway/bad-request` for invalid fields, `credits/not-permitted`, or
   * `credits/rejected` when the administration seam refuses the grant.
   */
  @Remote
  async grant(input: CreditGrantInput): Promise<CreditAccountView> {
    const parsed = parse(grantSchema, input)
    // Who is asking, then whether there is anything to ask: an anonymous
    // caller hears that before it learns what this deployment mounts. The
    // seam is resolved outside the wrapper because `refusals` re-codes what
    // the seam itself refuses, and an unmounted seam is not one of its rules.
    const by = await this.standing()
    const seam = this.administration()
    const request = {
      person: brandString<PersonId>(parsed.person),
      amount: parsed.amount,
      ...parsed.expiresAt === undefined ? {} : { expiresAt: parsed.expiresAt },
    }
    await refusals(parsed.person, () => seam.grant(request, by))
    return this.read(request.person, true)
  }

  /**
   * Set or replace one recurring-allowance override.
   * @param input - what to change, and whose allowance it applies to.
   * @returns the overrides now reaching the named person, or the setter when the change was organization-wide.
   * @throws {RemoteError} `credits/anonymous`, `credits/unavailable`,
   * `gateway/bad-request` for invalid fields, `credits/not-permitted`, or
   * `credits/rejected` when the change names neither an organization nor a person.
   */
  @Remote
  async setAllowance(input: AllowanceInput): Promise<AllowanceView> {
    const parsed = parse(allowanceSchema, input)
    const by = await this.standing()
    const seam = this.administration()
    const change = {
      ...parsed.organization === undefined ? {} : { organization: parsed.organization },
      ...parsed.person === undefined ? {} : { person: brandString<PersonId>(parsed.person) },
      ...parsed.periodicAmount === undefined ? {} : { periodicAmount: parsed.periodicAmount },
      ...parsed.period === undefined ? {} : { period: parsed.period },
    }
    await refusals(parsed.person ?? parsed.organization ?? '', () => seam.setAllowance(change, by))
    // An organization-wide change has no one person to report, so the setter's
    // own allowance is what a form reads back: it is the one this caller can
    // see resolved, and it already includes the organization override it set.
    const subject = change.person ?? by.person
    return allowanceView(String(subject), await seam.overridesFor(subject))
  }

  /**
   * Read the overrides reaching one person.
   * @param person - whose allowance to resolve.
   * @returns the organization-wide and person-specific overrides, and the periods a form may offer.
   * @throws {RemoteError} `credits/anonymous`, `credits/unavailable`, or `credits/not-permitted`.
   */
  @Remote
  async allowance(person: string): Promise<AllowanceView> {
    const subject = brandString<PersonId>(person)
    if (subject !== this.caller()) await this.assertAdministers(subject)
    return allowanceView(person, await this.administration().overridesFor(subject))
  }

  /** One person's balance and ledger, projected for the wire. */
  private async read(person: PersonId, administrable: boolean): Promise<CreditAccountView> {
    const ledger = this.ctx.get('credits')
    if (ledger === undefined) throw new RemoteError('credits/unavailable', NO_LEDGER, {})
    const [balance, history] = await Promise.all([ledger.balance(person), ledger.history(person)])
    return view(balance, history.grants, history.debits, administrable)
  }

  /** The person this call authenticated as. */
  private caller(): PersonId {
    const principal = this.ctx.get('requestPrincipal')?.current()
    if (principal === undefined) throw new RemoteError('credits/anonymous', 'this request presents no identity', {})
    return principal.person
  }

  /** The standing this call acts in, which a personal context does not have. */
  private async standing(): Promise<Membership> {
    const principal = this.ctx.get('requestPrincipal')?.current()
    if (principal === undefined) throw new RemoteError('credits/anonymous', 'this request presents no identity', {})
    const id = principal.acting.membership
    const held = id === undefined ? undefined : await this.ctx.get('people')?.membership(id)
    if (held === undefined) {
      throw new RemoteError('credits/not-permitted', 'this call acts in no standing that administers credits', {
        person: String(principal.person),
      })
    }
    return held
  }

  /** Whether the calling standing administers anybody at all. */
  private async administersAnyone(): Promise<boolean> {
    const principal = this.ctx.get('requestPrincipal')?.current()
    const id = principal?.acting.membership
    if (id === undefined) return false
    const held = await this.ctx.get('people')?.membership(id)
    return held !== undefined && held.role !== 'member'
  }

  /** Refuse a read of somebody else's ledger by the rule a grant uses. */
  private async assertAdministers(person: PersonId): Promise<void> {
    const by = await this.standing()
    if (!await this.administration().mayAdminister(by, person)) {
      throw new RemoteError('credits/not-permitted', NOT_PERMITTED, { person: String(person) })
    }
  }

  /** The administration seam, or the refusal a deployment without one answers. */
  private administration(): CreditAdministration {
    const administration = this.ctx.get('creditAdministration')
    if (administration === undefined) throw new RemoteError('credits/unavailable', NO_LEDGER, {})
    return administration
  }
}

/**
 * Project one balance and ledger onto the account view.
 * @param balance - what the person may spend now.
 * @param grants - everything granted to them.
 * @param debits - everything they spent.
 * @param administrable - whether the caller may grant and set allowances here.
 * @returns the wire account.
 */
function view(
  balance: CreditBalance,
  grants: readonly CreditGrant[],
  debits: readonly CreditDebit[],
  administrable: boolean,
): CreditAccountView {
  return {
    person: String(balance.person),
    available: balance.available,
    granted: balance.granted,
    spent: balance.spent,
    grants: grants.map(grantView),
    debits: debits.map(debitView),
    administrable,
    ...balance.nextGrantAt === undefined ? {} : { nextGrantAt: balance.nextGrantAt },
  }
}

/**
 * Validate one input, reporting every problem in one answer.
 * @param schema - the input's schema.
 * @param input - what the caller sent.
 * @returns the validated input.
 * @throws {RemoteError} `gateway/bad-request` listing every invalid field.
 */
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input)
  if (parsed.success) return parsed.data
  const problems = parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
  throw new RemoteError('gateway/bad-request', `this credits request is invalid: ${problems.join('; ')}`, { issues: [] })
}

/**
 * Run one administration call, turning its own refusals into routable codes.
 * @param person - who the call was about, for the refusal's details.
 * @param run - the administration call.
 * @throws {RemoteError} `credits/not-permitted` or `credits/rejected`.
 */
async function refusals(person: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.endsWith('may not administer that person')) {
      throw new RemoteError('credits/not-permitted', NOT_PERMITTED, { person }, { cause: error })
    }
    throw new RemoteError('credits/rejected', message, { reason: message }, { cause: error })
  }
}
