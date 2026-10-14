/**
 * Provider: the allowed models an operator writes in composition config.
 *
 * This is the enterprise shape's source of truth. An installation runs on one
 * customer's own servers for that customer's own staff, so there are no
 * tenants to resolve and one list is the whole policy — the administration
 * surface edits this row, and an authorized user chooses among what it names
 * without being able to change it.
 *
 * A hosted deployment mounts a tenant-resolving provider instead, because its
 * allowance differs per request.
 *
 * @module @lyness/lyn-model-policy/static
 */

import type { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
import { ModelPolicy } from './index.ts'
import type { AllowedModel, ModelAllowance } from './types.ts'

/** Authority named in a refusal when this deployment decided the list itself. */
const DEFAULT_AUTHORITY = 'this deployment'

/** One allowed route as an operator writes it. */
const AllowedModelSchema: z<AllowedModel> = z.object({
  provider: z.string().required(),
  model: z.string().required(),
})

/** Operator-written allowance for an installation with one list. */
export interface Config {
  /**
   * Models an authorized user may use.
   *
   * Required and non-empty: an installation that allows nothing serves no one,
   * and an empty list is far more likely to be an unfinished edit than an
   * intention, so it fails at load rather than refusing every request.
   */
  allowed: AllowedModel[]
  /** Who to name in a refusal; defaults to the deployment itself. */
  authority?: string
}

export const Config: z<Config> = z.object({
  allowed: z.array(AllowedModelSchema).required(),
  authority: z.string().default(DEFAULT_AUTHORITY),
})

/**
 * Apply the default for a config a caller supplied without the Loader's schema
 * validation.
 * @param config - validated or hand-built configuration.
 * @returns the authority a refusal names.
 */
export function resolveAuthority(config: Config): string {
  return config.authority ?? DEFAULT_AUTHORITY
}

/** The allowed models an operator wrote, served unchanged for every request. */
export class StaticModelPolicy extends ModelPolicy {
  static readonly Config = Config

  private readonly value: ModelAllowance

  /**
   * @param ctx - the context this policy serves.
   * @param config - validated operator-written allowance.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx)
    if (config.allowed.length === 0) {
      throw new Error('model-policy-static: `allowed` must name at least one model')
    }
    this.value = Object.freeze({
      allowed: Object.freeze(config.allowed.map(entry => Object.freeze({ ...entry }))),
      authority: resolveAuthority(config),
    })
  }

  /**
   * The operator's list, identical for every request.
   * @returns the configured allowance.
   */
  allowance(): Promise<ModelAllowance> {
    return Promise.resolve(this.value)
  }
}

export default StaticModelPolicy
