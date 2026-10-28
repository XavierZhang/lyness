/**
 * Provider: the credit ledger a hosted deployment keeps.
 *
 * The periodic allowance arrives lazily — the first read or spend in a new
 * period records the grant for that period — rather than from a timer. A
 * timer would have to fire for every person on the deployment at the same
 * instant, and would miss anyone whose period rolled over while the process
 * was down. Granting on use costs nothing for people who are not using it and
 * cannot miss a period.
 *
 * @module @deepseek-ai/dsh-credits/store
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { brandString } from '@deepseek-ai/dsh-brand'
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import type { PersonId } from '@deepseek-ai/dsh-people'
import { CreditLedger, CreditsExhausted } from './index.ts'
import type { GrantRequest, SpendRequest } from './index.ts'
import { effectiveAllowance } from './allowance.ts'
import type { EffectiveAllowance } from './allowance.ts'
import type {} from './administration.ts'
import { nextPeriodStart, periodStart } from './period.ts'
import type { ResetPeriod } from './period.ts'
import { budgetDomain } from './budget-storage.ts'
import { remainingOf } from './budget.ts'
import type { BudgetChange, BudgetState, OrganizationBudget } from './budget.ts'
import { creditsDomain } from './storage.ts'
import type { CreditBalance, CreditDebit, CreditGrant, DebitId, GrantId } from './types.ts'

/** Credits each person receives per period before a deployment changes it. */
const DEFAULT_PERIODIC_AMOUNT = 500

/** The clock the allowance is counted against, as an offset from UTC. */
const DEFAULT_OFFSET_HOURS = 8

/** Deployment-owned allowance policy. */
export interface Config {
  /** Credits granted each period. Defaults to 500. */
  periodicAmount?: number
  /** How often the allowance arrives. Defaults to daily. */
  period?: ResetPeriod
  /** Clock offset from UTC the period is counted against. Defaults to 8. */
  offsetHours?: number
}

export const Config: z<Config> = z.object({
  periodicAmount: z.number().step(1).min(0).max(10_000_000).default(DEFAULT_PERIODIC_AMOUNT),
  period: z.union(['daily', 'weekly', 'monthly']).default('daily'),
  offsetHours: z.number().min(-12).max(14).default(DEFAULT_OFFSET_HOURS),
})

/** Resolved allowance policy, with every default applied. */
export interface ResolvedConfig {
  /** Credits granted each period. */
  readonly periodicAmount: number
  /** How often the allowance arrives. */
  readonly period: ResetPeriod
  /** Clock offset the period is counted against. */
  readonly offsetHours: number
}

/**
 * Apply the defaults for a config a caller supplied without the Loader's
 * schema validation.
 * @param config - validated or hand-built configuration.
 * @returns the policy this ledger runs on.
 */
export function resolveConfig(config: Config): ResolvedConfig {
  return {
    periodicAmount: config.periodicAmount ?? DEFAULT_PERIODIC_AMOUNT,
    period: config.period ?? 'daily',
    offsetHours: config.offsetHours ?? DEFAULT_OFFSET_HOURS,
  }
}

/** The credit ledger, persisted and granted on use. */
export class StoredCreditLedger extends CreditLedger {
  static inject = ['storageDomain']

  static readonly Config = Config

  private readonly policy: ResolvedConfig
  private readonly ready: Promise<Domain<typeof creditsDomain>>
  private readonly budgets: Promise<Domain<typeof budgetDomain>>
  private chain: Promise<unknown> = Promise.resolve()

  /**
   * @param ctx - Host context owning durable storage.
   * @param config - validated allowance policy.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx)
    this.policy = resolveConfig(config)
    this.ready = ctx.storageDomain.open(creditsDomain)
    this.budgets = ctx.storageDomain.open(budgetDomain)
    ctx.effect(() => async () => {
      await this.chain // Failures reach their own callers; this only waits.
      await (await this.ready).close()
      await (await this.budgets).close()
    })
  }

  /**
   * What one person may spend now, after any due periodic grant is recorded.
   * @param person - whose balance to read.
   * @returns the balance and what it is made of.
   */
  async balance(person: PersonId): Promise<CreditBalance> {
    return this.serialise(async (domain) => {
      await this.grantPeriodIfDue(domain, person, new Date())
      return this.computeBalance(domain, person, new Date(), await this.allowanceFor(person))
    })
  }

  /**
   * Spend credits, or refuse rather than overdraw.
   * @param request - whose credits, how many, and which session.
   * @returns the recorded debit.
   * @throws {CreditsExhausted} when the balance cannot cover the amount.
   */
  async spend(request: SpendRequest): Promise<CreditDebit> {
    if (request.amount <= 0) throw new TypeError('credits: a spend must be positive')
    return this.serialise(async (domain) => {
      const now = new Date()
      await this.grantPeriodIfDue(domain, request.person, now)
      const current = this.computeBalance(domain, request.person, now, await this.allowanceFor(request.person))
      if (current.available < request.amount) {
        throw new CreditsExhausted('exhausted', current.available, current.nextGrantAt)
      }
      const id = brandString<DebitId>(randomUUID())
      const debit = {
        person: request.person,
        amount: request.amount,
        at: now.toISOString(),
        session: request.session,
        ...request.organization === undefined ? {} : { organization: request.organization },
      }
      await domain.table('debits').put(id, debit)
      return { id, ...debit }
    })
  }

  /**
   * Add credits to one person.
   * @param request - who receives them, how many, why, and when they lapse.
   * @returns the recorded grant.
   */
  async grant(request: GrantRequest): Promise<CreditGrant> {
    if (request.amount <= 0) throw new TypeError('credits: a grant must be positive')
    return this.serialise(async (domain) => {
      return this.record(domain, {
        person: request.person,
        amount: request.amount,
        grantedAt: new Date().toISOString(),
        reason: request.reason,
        ...request.expiresAt === undefined ? {} : { expiresAt: request.expiresAt },
        ...request.grantedBy === undefined ? {} : { grantedBy: request.grantedBy },
      })
    })
  }

  /**
   * Everything granted to and spent by one person, newest first.
   * @param person - whose history to read.
   * @returns their grants and debits.
   */
  async history(person: PersonId): Promise<{
    readonly grants: readonly CreditGrant[]
    readonly debits: readonly CreditDebit[]
  }> {
    const domain = await this.ready
    return {
      grants: grantsOf(domain, person).toReversed(),
      debits: debitsOf(domain, person).toReversed(),
    }
  }

  /**
   * What one organization bought, and what is left of it this period.
   * @param organization - whose ceiling to read.
   * @returns the ceiling and what is left, or undefined where nobody set one.
   */
  async budget(organization: string): Promise<BudgetState | undefined> {
    const stored = (await this.budgets).table('budgets').get(organization)
    if (stored === undefined) return undefined
    const now = new Date()
    const started = periodStart(now, stored.period, this.policy.offsetHours)
    const since = started.getTime()
    // Summed from the debits rather than drawn down from a stored total: the
    // ledger is the only record of what was spent, and a counter beside it
    // would be a second number that could disagree with it.
    const domain = await this.ready
    const spent = [...domain.table('debits').entries()]
      .map(([, debit]) => debit)
      .filter(debit => debit.organization === organization && Date.parse(debit.at) >= since)
      .reduce((total, debit) => total + debit.amount, 0)
    return {
      organization,
      periodicAmount: stored.periodicAmount,
      period: stored.period,
      spent,
      remaining: remainingOf(stored.periodicAmount, spent),
      periodStartedAt: started.toISOString(),
      nextPeriodAt: nextPeriodStart(now, stored.period, this.policy.offsetHours).toISOString(),
    }
  }

  /**
   * Set or replace one organization's ceiling.
   * @param change - the organization, the ceiling, and the period it applies to.
   * @param by - who set it, recorded on the record.
   * @returns the stored ceiling.
   */
  async setBudget(change: BudgetChange, by: PersonId): Promise<OrganizationBudget> {
    const record: OrganizationBudget = {
      organization: change.organization,
      periodicAmount: change.periodicAmount,
      period: change.period,
      setAt: new Date().toISOString(),
      setBy: by,
    }
    await (await this.budgets).table('budgets').put(record.organization, record)
    return record
  }

  /** Record one grant and return it with its new identity. */
  private async record(
    domain: Domain<typeof creditsDomain>, grant: Omit<CreditGrant, 'id'>,
  ): Promise<CreditGrant> {
    const id = brandString<GrantId>(randomUUID())
    await domain.table('grants').put(id, grant)
    return { id, ...grant }
  }

  /**
   * Record this period's allowance when it has not been recorded yet.
   *
   * Idempotent by construction: a grant carries the instant it was made, so
   * one already inside the current period means this period is covered. Two
   * concurrent calls cannot double-grant because every mutation is serialised.
   */
  private async grantPeriodIfDue(
    domain: Domain<typeof creditsDomain>, person: PersonId, now: Date,
  ): Promise<void> {
    const allowance = await this.allowanceFor(person)
    if (allowance.periodicAmount === 0) return
    const start = periodStart(now, allowance.period, this.policy.offsetHours).getTime()
    const already = grantsOf(domain, person)
      .some(grant => grant.reason === 'periodic' && Date.parse(grant.grantedAt) >= start)
    if (already) return
    await this.record(domain, {
      person,
      amount: allowance.periodicAmount,
      grantedAt: now.toISOString(),
      expiresAt: nextPeriodStart(now, allowance.period, this.policy.offsetHours).toISOString(),
      reason: 'periodic',
    })
  }

  /**
   * This person's recurring allowance, with any administrator override applied.
   *
   * The administration service is read through `ctx.get` rather than injected:
   * a deployment nobody administers credits on — a single-operator install —
   * mounts no such service, and the deployment's own numbers are then the
   * whole answer. Injecting it would make the ledger unavailable there.
   */
  private async allowanceFor(person: PersonId): Promise<EffectiveAllowance> {
    const base: EffectiveAllowance = {
      periodicAmount: this.policy.periodicAmount,
      period: this.policy.period,
    }
    const administration = this.ctx.get('creditAdministration')
    if (administration === undefined) return base
    const overrides = await administration.overridesFor(person)
    return effectiveAllowance(base, overrides.organization, overrides.person)
  }

  /** Sum unexpired grants less everything spent. */
  private computeBalance(
    domain: Domain<typeof creditsDomain>, person: PersonId, now: Date,
    allowance: EffectiveAllowance,
  ): CreditBalance {
    const instant = now.getTime()
    const granted = grantsOf(domain, person)
      .filter(grant => grant.expiresAt === undefined || Date.parse(grant.expiresAt) > instant)
      .reduce((total, grant) => total + grant.amount, 0)
    const debits = debitsOf(domain, person)
    const spent = debits.reduce((total, debit) => total + debit.amount, 0)
    // What this period cost, beside what the account has cost in all: a person
    // asking whether they are near their limit is asking the first.
    const started = periodStart(now, allowance.period, this.policy.offsetHours)
    const since = started.getTime()
    const spentThisPeriod = debits
      .filter(debit => Date.parse(debit.at) >= since)
      .reduce((total, debit) => total + debit.amount, 0)
    return {
      person,
      available: Math.max(0, granted - spent),
      granted,
      spent,
      periodicAmount: allowance.periodicAmount,
      period: allowance.period,
      periodStartedAt: started.toISOString(),
      spentThisPeriod,
      ...allowance.periodicAmount === 0 ? {} : {
        nextGrantAt: nextPeriodStart(now, allowance.period, this.policy.offsetHours).toISOString(),
      },
    }
  }

  /** Run one durable mutation after the previous one settles. */
  private serialise<T>(work: (domain: Domain<typeof creditsDomain>) => Promise<T>): Promise<T> {
    const result = this.ready.then(work)
    this.chain = result.catch(() => undefined)
    return result
  }
}

/** One person's grants, in write order. */
function grantsOf(domain: Domain<typeof creditsDomain>, person: PersonId): CreditGrant[] {
  return [...domain.table('grants').entries()]
    .filter(([, grant]) => grant.person === person)
    .map(([id, grant]) => ({ id, ...grant }))
}

/** One person's debits, in write order. */
function debitsOf(domain: Domain<typeof creditsDomain>, person: PersonId): CreditDebit[] {
  return [...domain.table('debits').entries()]
    .filter(([, debit]) => debit.person === person)
    .map(([id, debit]) => ({ id, ...debit }))
}

export default StoredCreditLedger
