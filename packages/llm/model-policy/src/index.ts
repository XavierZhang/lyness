/**
 * Service Definition for the models a deployment allows.
 *
 * The models a request may use are a deployment's decision, not a user's, and
 * the two shipped shapes decide it differently: a hosted deployment reads one
 * tenant's roster, an enterprise install reads the one list its administrator
 * maintains. This seam is what lets both exist without either knowing about
 * the other — an enterprise install has no tenants, so a policy bound to
 * tenants could not serve it.
 *
 * Mounting no provider leaves the deployment unrestricted, which is what a
 * single-tenant developer install wants: it is its own operator.
 *
 * @module @lyness/lyn-model-policy
 */

import { Service } from '@lyness/cordis'
import type { Context } from '@lyness/cordis'
import type { ModelAllowance } from './types.ts'

export type { AllowedModel, ModelAllowance } from './types.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** The models this deployment allows; absent means unrestricted. */
    modelPolicy: ModelPolicy
  }
}

/**
 * Abstract policy store. Subclass and implement {@link allowance} for one
 * source of truth; a deployment mounts exactly one.
 */
export abstract class ModelPolicy extends Service {
  /**
   * @param ctx - the context this policy serves.
   */
  constructor(ctx: Context) {
    super(ctx, 'modelPolicy')
  }

  /**
   * The models allowed for the request being resolved.
   *
   * Called per request rather than cached by the consumer, because a hosted
   * deployment resolves a different tenant per request and an administrator's
   * change should reach the next one.
   * @returns the allowed models and the authority that decided them.
   */
  abstract allowance(): Promise<ModelAllowance>
}

export default ModelPolicy
