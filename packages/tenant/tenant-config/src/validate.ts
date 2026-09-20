/**
 * The rules a tenant configuration obeys, in one place.
 *
 * Every backend validates the same way: a read-only backend at load, and a
 * writable one before it saves. A configuration that breaks a rule resolves
 * requests to something nobody configured — a model the tenant has no key
 * for, or a default nobody granted — so the rules are refusals, not warnings.
 */

import type { ModelChoice, TenantConfig } from './types.ts'

/** Modalities every configuration carries. */
export const MODALITIES = ['language', 'image', 'video', 'music'] as const

/**
 * Name one model the way a refusal message quotes it.
 * @param choice - the model entry.
 * @returns provider, model, and effort as one readable token.
 */
function nameOf(choice: ModelChoice): string {
  return `${choice.provider}/${choice.model}${choice.reasoningEffort === undefined ? '' : `@${choice.reasoningEffort}`}`
}

/**
 * Check one tenant configuration.
 * @param config - the configuration to check.
 * @returns every problem found, in reading order; empty when the configuration is usable.
 */
export function validateTenantConfig(config: TenantConfig): string[] {
  const problems: string[] = []
  const granted = new Set<string>()
  for (const grant of config.providers) {
    if (grant.provider.trim() === '') problems.push('a provider grant has a blank provider id')
    else if (granted.has(grant.provider)) problems.push(`provider ${JSON.stringify(grant.provider)} is granted twice`)
    granted.add(grant.provider)
  }

  for (const modality of MODALITIES) {
    const models = config.models[modality]
    const seen = new Set<string>()
    for (const choice of models.available) {
      const name = nameOf(choice)
      if (choice.model.trim() === '') problems.push(`${modality} model ${name} has a blank model id`)
      if (!granted.has(choice.provider)) problems.push(`${modality} model ${name} names a provider this tenant has no grant for`)
      if (seen.has(name)) problems.push(`${modality} model ${name} is listed twice`)
      seen.add(name)
    }
    const preferred = models.preferred
    if (preferred !== undefined && !seen.has(nameOf(preferred))) {
      problems.push(`${modality} prefers ${nameOf(preferred)}, which is not among its available models`)
    }
  }

  const features = new Set<string>()
  for (const feature of config.features) {
    if (feature.trim() === '') problems.push('a feature id is blank')
    else if (features.has(feature)) problems.push(`feature ${JSON.stringify(feature)} is listed twice`)
    features.add(feature)
  }

  for (const [index, constraint] of (config.identity?.constraints ?? []).entries()) {
    if (constraint.trim() === '') problems.push(`identity constraint ${String(index)} is blank`)
  }
  for (const [key, text] of Object.entries(config.copy ?? {})) {
    if (text.trim() === '') problems.push(`copy override ${JSON.stringify(key)} is blank`)
  }
  return problems
}
