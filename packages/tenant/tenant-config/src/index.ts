/**
 * Service Definition for the `ctx.tenantConfig` capability seam: what one
 * tenant configures for itself.
 *
 * A tenant configures the models it may use — language, image, video, music —
 * the providers it reaches them through, the features it may use, the identity
 * text it contributes to its own model requests, and the interface copy it
 * overrides. A private deployment configures the same way a SaaS tenant does;
 * it simply has one tenant.
 *
 * What a tenant does NOT configure here is its brand: the mark, the wordmark,
 * the favicon, and the product name belong to the deployment, because assets
 * are files a deployment serves rather than values a tenant edits.
 *
 * Keys never appear in a configuration. A provider grant carries a
 * `CredentialRef` — a reference the credential store resolves — so a
 * configuration can be read, logged, and exported without carrying a secret.
 *
 * A backend states whether it can be written to. A configuration in
 * composition config is read-only and changes with a restart; a
 * database-backed one is writable and is what an administration surface saves
 * through. Consumers switch on `capability().kind` rather than discovering
 * read-only by catching a failure.
 * @module @lyness/lyn-tenant-config
 */

import { Context, Service } from '@lyness/cordis'
import type { TenantId } from '@lyness/lyn-tenant'
import type { TenantConfig } from './types.ts'

export { MODALITIES, validateTenantConfig } from './validate.ts'
export type {
  Modality, ModalityModels, ModelChoice, ProviderGrant, TenantConfig, TenantIdentity,
} from './types.ts'

/** Whether a backend only reads, or also saves. */
export type TenantConfigCapability =
  | {
    /** The configuration comes from somewhere this process does not write. */
    kind: 'read-only'
  }
  | {
    /** The configuration is stored somewhere this process writes. */
    kind: 'writable'
    /**
     * Save one tenant's complete configuration.
     * @param config - the configuration to store, replacing what the tenant had.
     * @throws {Error} when the configuration breaks a rule `validateTenantConfig` states.
     */
    save(config: TenantConfig): Promise<void>
  }

declare module '@lyness/cordis' {
  interface Context {
    tenantConfig: TenantConfigStore
  }
}

/**
 * Abstract tenant-configuration store. Subclass, implement the read and the
 * capability, and load the subclass as a plugin — it registers as
 * `ctx.tenantConfig` (one store per context; loading a second throws, cordis'
 * standard duplicate-service behavior).
 *
 * A tenant with no configuration reads as `undefined` rather than as an empty
 * configuration: nothing configured and everything configured empty are the
 * same answer to a consumer, and both mean the tenant may use nothing.
 */
export abstract class TenantConfigStore extends Service {
  constructor(ctx: Context) {
    super(ctx, 'tenantConfig')
  }

  /**
   * Read one tenant's configuration.
   * @param tenantId - the tenant.
   * @returns the configuration, or undefined when the tenant has none.
   */
  abstract get(tenantId: TenantId): Promise<TenantConfig | undefined>

  /**
   * Whether this backend can be saved to.
   * @returns the discriminated capability consumers switch on.
   */
  abstract capability(): TenantConfigCapability
}

export default TenantConfigStore
