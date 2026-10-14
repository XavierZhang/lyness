/**
 * Refuse a model request the deployment's policy does not allow.
 *
 * Enforcement sits on the `llm/stream` waterfall, which every streaming call
 * passes — a loop-built request, a hand-built one, a retry, a replay. A
 * surface that filters a model picker is a presentation; a preset row, a
 * profile patch, and a direct RPC each reach this point without passing one,
 * so this is the operation that makes the decision and therefore the operation
 * that enforces it.
 *
 * A deployment mounting no policy is unrestricted, so this plugin injects the
 * policy and stays inactive without one rather than inventing a default.
 *
 * @module @lyness/lyn-model-policy/enforce
 */

import type { Context } from '@lyness/cordis'
import type { GenerateOptions, StreamChunk } from '@lyness/lyn-llm'
import { LlmError } from '@lyness/lyn-llm'
import type {} from './index.ts'
import type { AllowedModel } from './types.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'model-policy-enforce'

/** The policy to enforce and the runtime whose waterfall carries the calls. */
export const inject = ['llm', 'modelPolicy']

/** Error code a refused route leaves, distinct from a route that does not exist. */
export const MODEL_NOT_ALLOWED = 'MODEL_NOT_ALLOWED'

/**
 * Whether one route appears in an allowance.
 * @param allowed - the models the policy permits.
 * @param provider - the route the request names.
 * @param model - the model the request names.
 * @returns true when the exact pair is permitted.
 */
export function permits(allowed: readonly AllowedModel[], provider: string, model: string): boolean {
  return allowed.some(entry => entry.provider === provider && entry.model === model)
}

/**
 * The refusal a user reads.
 *
 * It names the authority, because "ask your administrator" and "this is what
 * the service offers" are different next actions, and a refusal naming
 * neither produces a support case rather than a fix.
 * @param authority - who decided the allowance.
 * @param provider - the refused route.
 * @param model - the refused model.
 * @returns the message carried by the thrown error.
 */
export function refusal(authority: string, provider: string, model: string): string {
  return `model ${provider}/${model} is not allowed by ${authority}`
}

/**
 * Refuse disallowed routes on every streaming call.
 * @param ctx - context providing the model runtime and the policy.
 */
export function apply(ctx: Context): void {
  ctx.on('llm/stream', async function* enforce(
    options: GenerateOptions,
    next: () => AsyncIterable<StreamChunk>,
  ): AsyncIterable<StreamChunk> {
    const { allowed, authority } = await ctx.modelPolicy.allowance()
    if (!permits(allowed, options.provider, options.model)) {
      // No provider facts: the refusal happens before the provider boundary,
      // so there is no status, request id, or retry hint to carry.
      throw new LlmError(refusal(authority, options.provider, options.model), MODEL_NOT_ALLOWED)
    }
    // Delegating is what reaches the resolved adapter; returning without it
    // would short-circuit every allowed call into silence.
    yield* next()
  })
}
