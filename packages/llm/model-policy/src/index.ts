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
import { administers } from '@lyness/lyn-people'
import type { Membership } from '@lyness/lyn-people'
import type { ModelAllowance, ModelAllowanceInput, ModelPolicyCapability } from './types.ts'

export type { AllowedModel, ModelAllowance, ModelAllowanceInput, ModelPolicyCapability } from './types.ts'

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

  /**
   * Whether this backend accepts a save, and whose administrators may make
   * one.
   *
   * Stated rather than discovered by failing, because an administration
   * surface should show or hide saving instead of offering a button that
   * always errors.
   * @returns the backend's save capability.
   */
  abstract capability(): ModelPolicyCapability

  /**
   * Replace the allowance, on behalf of one standing.
   *
   * The standing is a parameter rather than ambient state so the authority
   * check lives with the write. An authorization check in a surface or an RPC
   * handler is bypassed by the next caller — a maintenance task, a CLI, a
   * setup wizard — while one here cannot be.
   *
   * A read-only backend refuses every save; the default implementation is
   * that refusal, so a backend opts into writing rather than inheriting it.
   * @param input - the replacement allowance.
   * @param by - the standing requesting the change.
   * @throws {Error} when the backend is read-only or the standing may not administer it.
   */
  save(input: ModelAllowanceInput, by: Membership): Promise<void> {
    void input
    void by
    return Promise.reject(new Error(READ_ONLY_POLICY))
  }

  /**
   * Refuse a save the requesting standing is not permitted to make.
   *
   * Shared by every writable backend so one rule decides it: a tenant
   * administrator saves for its own organization, a platform administrator for
   * any, and a member never.
   * @param by - the standing requesting the change.
   * @throws {Error} when that standing may not administer this backend.
   */
  protected assertMayAdminister(by: Membership): void {
    if (!administers(by, this.capability().organization)) {
      throw new Error(NOT_PERMITTED)
    }
  }
}

/** Message a read-only backend refuses a save with. */
export const READ_ONLY_POLICY = 'model-policy: this backend is read-only'

/** Message a writable backend refuses an unauthorized save with. */
export const NOT_PERMITTED = 'model-policy: this standing may not change the allowed models'

export default ModelPolicy
