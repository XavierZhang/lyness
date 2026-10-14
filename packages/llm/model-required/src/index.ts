/**
 * Refuse to serve a deployment that reaches no model.
 *
 * A deployment that declares a default model it cannot reach starts, serves
 * its interface, and creates sessions that fail at their first prompt — in
 * front of a user who cannot fix it. Mounting this plugin moves that failure
 * to startup, where the operator who caused it is present.
 *
 * The check runs at successful startup rather than at load, and that is the
 * earliest point it can run: a route registers when its own row applies, and
 * `lyn-llm-pi-ai` registers its routes from the user settings document, so at
 * load time an empty registry is indistinguishable from one whose rows have
 * not applied yet. Load-time failure would be a false alarm; this is the
 * earliest resolvable point.
 *
 * Mounting it is how a deployment shape states the requirement. A hosted or
 * enterprise template selects it; a developer profile does not, because an
 * install that has not been given a key yet should still open its own Models
 * page.
 *
 * @module @lyness/lyn-model-required
 */

import type { Context } from '@lyness/cordis'
import type {} from '@lyness/lyn-llm'
import type {} from '@lyness/lyn-cmdline'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'model-required'

/**
 * The model registry and the launcher's startup signal.
 *
 * `appReady` is injected rather than read optionally because without it this
 * plugin cannot do the one thing it exists for, and a silently inert guard is
 * worse than an absent one.
 */
export const inject = ['llm', 'appReady']


/** Exit code a deployment with no reachable model leaves. */
export const NO_MODEL_EXIT_CODE = 78

/**
 * Operator-facing diagnostic for a deployment that reaches no model.
 *
 * It names the three things an operator can act on, because the registry being
 * empty does not say which of them was omitted.
 */
export const NO_MODEL_DIAGNOSTIC = [
  'lyn: this deployment reaches no model, so it cannot serve a session.',
  '',
  'A deployment states its models before it serves anything. Check, in order:',
  '  1. a default model is declared (the `agent-default-model` row names a provider and model)',
  '  2. the adapter for that provider is enabled (for example the `llm-deepseek` row)',
  '  3. that adapter resolves a credential (its `apiKeyEnv` reference has a stored value)',
  '',
  'A deployment routing through `llm-pi-ai` instead states its routes in the',
  '`llm-pi-ai` settings section, which the Models page writes.',
  '',
].join('\n')

/**
 * Fail startup when the model registry is empty once startup succeeds.
 * @param ctx - context providing the model registry and the startup signal.
 */
export function apply(ctx: Context): void {
  // `appReady` is injected, so cordis leaves this plugin inactive until a
  // launcher has provided it. The declaration stays optional for launchers
  // that never do — which therefore never reach here — so this narrows a type
  // rather than guarding a reachable state.
  const ready = ctx.appReady
  if (ready === undefined) return
  ctx.effect(() => ready.onReady(() => {
    if (ctx.llm.listProviders().length > 0) return
    process.stderr.write(NO_MODEL_DIAGNOSTIC)
    // The launcher owns the exit; a throw here would be swallowed by the
    // readiness listener and leave the process serving.
    ctx.appExit?.(NO_MODEL_EXIT_CODE)
  }))
}
