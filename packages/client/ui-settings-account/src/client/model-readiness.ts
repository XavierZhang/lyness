/**
 * Whether this installation can already reach a model.
 *
 * The sign-in gate asks this before covering the product, because the account
 * credential is not the only way to reach one: a provider configured in any
 * `llm-*` settings namespace serves models without anybody signing in, and an
 * API key read from the environment leaves no stored secret behind. Covering
 * on the account state alone would shut such an installation out of itself.
 * @module @lyness/lyn-client-ui-settings-account/model-readiness
 */

import type { JsonValue } from '@lyness/lyn-util-values'
import type { SettingsDescribeView } from '@lyness/lyn-client-ui-settings/client'

/** The namespace prefix every model-provider plugin registers under. */
const MODEL_NAMESPACE_PREFIX = 'llm-'

/**
 * Whether a namespace value names at least one provider.
 * @param value - the namespace's redacted resolved value.
 * @returns true when its `providers` map holds an entry.
 */
function namesProvider(value: JsonValue): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const providers = (value as Record<string, JsonValue>)['providers']
  if (typeof providers !== 'object' || providers === null || Array.isArray(providers)) return false
  return Object.keys(providers).length > 0
}

/**
 * Whether a model is reachable without a sign-in.
 *
 * An unread answer counts as reachable: the gate covers the product, so it
 * waits for a fact rather than covering on the absence of one.
 * @param view - the settings description, or undefined before the first read.
 * @returns true when some model namespace names a provider or holds a secret.
 */
export function modelProviderConfigured(view: SettingsDescribeView | undefined): boolean {
  if (view === undefined) return true
  return view.namespaces.some(namespace => namespace.ns.startsWith(MODEL_NAMESPACE_PREFIX)
    && (namesProvider(namespace.value) || namespace.secrets.some(secret => secret.set)))
}
