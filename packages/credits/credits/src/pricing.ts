/**
 * What one model request costs in credits.
 *
 * Priced from tokens rather than from money: a provider's rates are the
 * operator's and may change, and a person comparing a balance against a task
 * cannot reason in a unit that moves.
 *
 * @module @deepseek-ai/dsh-credits/pricing
 */

import type { TokenUsage } from '@deepseek-ai/dsh-llm'

/** Credits charged per million billable tokens before a deployment changes it. */
export const DEFAULT_CREDITS_PER_MILLION = 1000

/** Smallest charge for any request that reached a provider. */
export const DEFAULT_MINIMUM_DEBIT = 1

/**
 * Billable tokens in one reported usage.
 *
 * A provider's own total is preferred when it reports one, because an adapter
 * derives it from authoritative counters; the sum is the fallback for adapters
 * that omit it. Cache reads are counted at full rate here rather than
 * discounted: pricing a discount this layer cannot verify would understate
 * every request that used a cache.
 * @param usage - usage as the provider reported it.
 * @returns the token count a charge is computed from.
 */
export function billableTokens(usage: TokenUsage): number {
  return usage.totalTokens ?? usage.inputTokens + usage.outputTokens
}

/**
 * Credits owed for one request.
 *
 * Rounded up and floored at the minimum, so a stream of tiny requests cannot
 * be free: rounding each one down to zero would meter nothing while costing
 * the operator every time.
 * @param usage - usage as the provider reported it.
 * @param creditsPerMillion - credits charged per million billable tokens.
 * @param minimumDebit - smallest charge for a request that reached a provider.
 * @returns the credits to debit, always at least `minimumDebit`.
 */
export function creditsFor(
  usage: TokenUsage,
  creditsPerMillion: number = DEFAULT_CREDITS_PER_MILLION,
  minimumDebit: number = DEFAULT_MINIMUM_DEBIT,
): number {
  const tokens = billableTokens(usage)
  return Math.max(minimumDebit, Math.ceil(tokens * creditsPerMillion / 1_000_000))
}
