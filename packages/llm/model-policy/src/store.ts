/**
 * Provider: the allowed models an administrator maintains at runtime.
 *
 * This is what "only an administrator may change the models" needs on top of
 * the seam: a backend that accepts a save, refuses one from a standing that
 * may not administer it, and persists the result so the next start serves it.
 *
 * The authority check lives in the write rather than in whatever surface
 * offers it. A member reaching this through an RPC, a maintenance task, or a
 * setup wizard is refused by the same rule that refuses them in the
 * administration page, because it is the same rule in the same place.
 *
 * @module @lyness/lyn-model-policy/store
 */

import type { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
import type { Domain } from '@lyness/lyn-storage-domain'
import type { Membership } from '@lyness/lyn-people'
import { ModelPolicy } from './index.ts'
import { allowanceDomain } from './storage.ts'
import type {
  AllowedModel, ModelAllowance, ModelAllowanceInput, ModelPolicyCapability,
} from './types.ts'

/** Authority named in a refusal before an administrator has named one. */
const DEFAULT_AUTHORITY = 'your administrator'

/** Row the stored allowance occupies; one per backend, so the key is fixed. */
const ROW = 'current'

/** Deployment-owned placement for an administrator-maintained allowance. */
export interface Config {
  /**
   * The organization whose administrators may save.
   *
   * Omitted on an installation serving one customer, where only a platform
   * administrator saves. A hosted deployment names the tenant, so a tenant
   * administrator saves for its own organization and no other.
   */
  organization?: string
  /** Models served before an administrator has saved any; empty means none until they do. */
  initial?: AllowedModel[]
}

const AllowedModelSchema: z<AllowedModel> = z.object({
  provider: z.string().required(),
  model: z.string().required(),
})

export const Config: z<Config> = z.object({
  organization: z.string(),
  initial: z.array(AllowedModelSchema).default([]),
})

/**
 * Apply the default for a config a caller supplied without the Loader's schema
 * validation.
 * @param config - validated or hand-built configuration.
 * @returns the models served before a first save.
 */
export function resolveInitial(config: Config): readonly AllowedModel[] {
  return config.initial ?? []
}

/** The allowance an administrator maintains, persisted across restarts. */
export class StoredModelPolicy extends ModelPolicy {
  static inject = ['storageDomain']

  static readonly Config = Config

  private readonly ready: Promise<Domain<typeof allowanceDomain>>
  private readonly organization: string | undefined
  private current: ModelAllowance

  /**
   * @param ctx - Host context owning durable storage.
   * @param config - validated placement and the list served before a first save.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx)
    this.organization = config.organization
    this.current = frozen(resolveInitial(config), DEFAULT_AUTHORITY)
    this.ready = ctx.storageDomain.open(allowanceDomain).then((domain) => {
      const stored = domain.table('allowance').get(ROW)
      if (stored !== undefined) this.current = frozen(stored.allowed, stored.authority)
      return domain
    })
    ctx.effect(() => async () => { await (await this.ready).close() })
  }

  /**
   * The allowance an administrator last saved, or the configured initial one.
   * @returns the current allowance.
   */
  async allowance(): Promise<ModelAllowance> {
    await this.ready
    return this.current
  }

  /**
   * Writable, by the administrators of the organization this backend serves.
   * @returns the save capability.
   */
  capability(): ModelPolicyCapability {
    return Object.freeze({
      writable: true,
      ...this.organization === undefined ? {} : { organization: this.organization },
    })
  }

  /**
   * Replace the allowance on behalf of one standing.
   *
   * An empty list is refused for the same reason the operator-written backend
   * refuses one: an installation allowing nothing serves no one, and a save
   * that empties the list is far likelier a mistake than an intention.
   * @param input - the replacement allowance.
   * @param by - the standing requesting the change.
   * @throws {Error} when that standing may not administer this backend, or the list is empty.
   */
  override async save(input: ModelAllowanceInput, by: Membership): Promise<void> {
    this.assertMayAdminister(by)
    if (input.allowed.length === 0) {
      throw new Error('model-policy-store: a saved allowance must name at least one model')
    }
    const authority = input.authority ?? this.current.authority
    const domain = await this.ready
    await domain.table('allowance').put(ROW, {
      allowed: input.allowed.map(entry => ({ ...entry })),
      authority,
    })
    this.current = frozen(input.allowed, authority)
  }
}

/** One immutable allowance, so a caller cannot alter what the backend serves. */
function frozen(allowed: readonly AllowedModel[], authority: string): ModelAllowance {
  return Object.freeze({
    allowed: Object.freeze(allowed.map(entry => Object.freeze({ ...entry }))),
    authority,
  })
}

export default StoredModelPolicy
