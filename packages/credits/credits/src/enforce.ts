/**
 * Spend credits on every model request, and stop the turn when they run out.
 *
 * Enforcement rides the `llm/stream` waterfall, the same point the model
 * policy refuses a disallowed route, and for the same reason: every streaming
 * call passes it, while a surface showing a balance is passed by none of them.
 *
 * The order is check, then call, then charge. Checking before the call is what
 * makes exhaustion stop a turn rather than report after the cost was already
 * incurred; charging after it is what makes the charge the real usage rather
 * than an estimate. A request that fails before reporting usage is not
 * charged, which is the right way round: the operator pays for a failed call
 * either way, and charging a person for one they cannot use would be worse.
 *
 * Two ceilings are checked, not one. A person's own balance is what their
 * organization gives them; their organization's budget is what it bought.
 * Either can stop a turn, and the refusal says which, because a customer told
 * the wrong one sends the wrong person looking.
 *
 * @module @deepseek-ai/dsh-credits/enforce
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { GenerateOptions, StreamChunk, TokenUsage } from '@deepseek-ai/dsh-llm'
import { CreditsExhausted } from './index.ts'
import type {} from './subject.ts'
import { DEFAULT_CREDITS_PER_MILLION, DEFAULT_MINIMUM_DEBIT, creditsFor } from './pricing.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'credits-enforce'

/**
 * The ledger, the runtime whose waterfall carries the calls, and whose credits
 * to spend.
 *
 * `creditSubject` is injected rather than read optionally so a deployment
 * without it leaves this plugin inactive — which a startup audit reports —
 * instead of metering nothing in silence.
 */
export const inject = ['llm', 'credits', 'creditSubject']

/** Deployment-owned pricing for a model request. */
export interface Config {
  /** Credits charged per million billable tokens. Defaults to 1000. */
  creditsPerMillion?: number
  /** Smallest charge for a request that reached a provider. Defaults to 1. */
  minimumDebit?: number
}

export const Config: z<Config> = z.object({
  creditsPerMillion: z.number().step(1).min(0).max(10_000_000).default(DEFAULT_CREDITS_PER_MILLION),
  minimumDebit: z.number().step(1).min(0).max(10_000).default(DEFAULT_MINIMUM_DEBIT),
})

/** Resolved pricing, with every default applied. */
export interface ResolvedConfig {
  /** Credits charged per million billable tokens. */
  readonly creditsPerMillion: number
  /** Smallest charge for a request that reached a provider. */
  readonly minimumDebit: number
}

/**
 * Apply the defaults for a config a caller supplied without the Loader's
 * schema validation.
 * @param config - validated or hand-built configuration.
 * @returns the pricing this enforcement runs on.
 */
export function resolveConfig(config: Config): ResolvedConfig {
  return {
    creditsPerMillion: config.creditsPerMillion ?? DEFAULT_CREDITS_PER_MILLION,
    minimumDebit: config.minimumDebit ?? DEFAULT_MINIMUM_DEBIT,
  }
}

/** The session a charge is attributed to when a request carries no session of its own. */
const UNATTRIBUTED_SESSION = 'unattributed'

/**
 * Check the balance before each call and charge the reported usage after it.
 * @param ctx - context providing the runtime, the ledger, and the subject.
 * @param config - validated pricing.
 */
export function apply(ctx: Context, config: Config): void {
  const pricing = resolveConfig(config)
  ctx.on('llm/stream', async function* meter(
    options: GenerateOptions,
    next: () => AsyncIterable<StreamChunk>,
  ): AsyncIterable<StreamChunk> {
    const subject = await ctx.creditSubject.current()
    if (subject === undefined) {
      // Nobody to charge: a deployment's own work, a replay, a seeded session.
      yield* next()
      return
    }
    const balance = await ctx.credits.balance(subject.person)
    if (balance.available <= 0) {
      // Stop before the call: a turn that runs out mid-way must not overdraw,
      // and a person who can exceed a balance has no balance.
      throw new CreditsExhausted('exhausted', balance.available, balance.nextGrantAt)
    }
    // An organization nobody set a ceiling for has none, rather than a ceiling
    // of zero: a deployment that meters people without selling organizations a
    // budget is the shape this shipped with.
    const budget = subject.organization === undefined
      ? undefined
      : await ctx.credits.budget(subject.organization)
    if (budget !== undefined && budget.remaining <= 0) {
      throw new CreditsExhausted('organization-exhausted', budget.remaining, budget.nextPeriodAt)
    }
    let usage: TokenUsage | undefined
    for await (const chunk of next()) {
      if (chunk.type === 'usage') usage = chunk.usage
      yield chunk
    }
    if (usage === undefined) return
    const owed = creditsFor(usage, pricing.creditsPerMillion, pricing.minimumDebit)
    // Settle to zero rather than refuse. The call already completed and the
    // person already has the answer, so failing the settlement would fail a
    // turn that succeeded. One request can therefore cost more than the
    // balance it had; the defence against that is the check before the *next*
    // one, and removing it entirely would need pre-authorisation rather than
    // settlement.
    const settled = Math.min(owed, (await ctx.credits.balance(subject.person)).available)
    if (settled <= 0) return
    await ctx.credits.spend({
      person: subject.person,
      amount: settled,
      session: sessionOf(options),
      // Recorded on the debit so the organization's spending for a period is
      // the sum of what was spent for it, whatever a person's standing is by
      // the time somebody reads it.
      ...subject.organization === undefined ? {} : { organization: subject.organization },
    })
  })
}

/**
 * The session a charge names.
 *
 * Every debit names a session so a refusal is answerable; a request that
 * carries none is still charged, under a fixed marker rather than silently
 * attributed to an unrelated session.
 * @param options - the request being metered.
 * @returns the session identifier to record on the debit.
 */
export function sessionOf(options: GenerateOptions): string {
  const named: unknown = (options as { sessionId?: unknown }).sessionId
  return typeof named === 'string' && named.length > 0 ? named : UNATTRIBUTED_SESSION
}
