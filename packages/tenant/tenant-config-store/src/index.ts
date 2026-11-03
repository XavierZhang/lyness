/**
 * Durable backend of the tenant-configuration seam: each tenant's
 * configuration is one record in the storage domain, and the store is
 * writable.
 *
 * This is the backend an administration surface saves through. It replaces the
 * composition-configured one without changing the seam: a deployment that
 * mounts it answers the same reads, reports a `writable` capability, and keeps
 * what it saved across restarts. Which medium the records land in — JSON files,
 * SQLite — is the storage layer's decision, not this package's.
 *
 * A save is validated against the seam's own rules before it is written, so an
 * unusable configuration is refused at the surface that asked for it rather
 * than discovered by a request that resolves to a model the tenant has no key
 * for.
 * @module @lyness/lyn-tenant-config-store
 */

import { Service } from '@lyness/cordis'
import type { KvTable } from '@lyness/lyn-storage-domain'
import { TenantConfigStore, validateTenantConfig } from '@lyness/lyn-tenant-config'
import type { TenantConfig, TenantConfigCapability } from '@lyness/lyn-tenant-config'
import type { TenantId } from '@lyness/lyn-tenant'
import { tenantConfigDomainSpec } from './spec.ts'

export { tenantConfigDomainSpec, tenantConfigRecord } from './spec.ts'

/** The `ctx.tenantConfig` implementation keeping one record per tenant in the storage domain. */
export default class StoredTenantConfigStore extends TenantConfigStore {
  static inject = ['storageDomain']

  private table!: KvTable<TenantId, TenantConfig>

  /** Open the domain and hold its table for the service's lifetime. */
  protected async [Service.init](): Promise<void> {
    const domain = await this.ctx.storageDomain.open(tenantConfigDomainSpec)
    this.ctx.effect(() => () => domain.close(), 'tenant-config-store.domainClose')
    this.table = domain.table('tenants')
  }

  /**
   * Read one tenant's configuration.
   * @param tenantId - the tenant.
   * @returns the stored configuration, or undefined when the tenant has none.
   */
  get(tenantId: TenantId): Promise<TenantConfig | undefined> {
    return Promise.resolve(this.table.get(tenantId))
  }

  /**
   * This backend owns its records, so it accepts saves.
   * @returns the writable capability.
   */
  capability(): TenantConfigCapability {
    return { kind: 'writable', save: config => this.save(config) }
  }

  /**
   * Store one tenant's complete configuration, replacing what it had.
   * @param config - the configuration to store.
   * @throws {Error} when it breaks a rule `validateTenantConfig` states.
   */
  private async save(config: TenantConfig): Promise<void> {
    const problems = validateTenantConfig(config)
    if (problems.length > 0) {
      throw new Error(`tenant-config-store: refusing to save an unusable configuration: ${problems.join('; ')}`)
    }
    await this.table.put(config.tenantId, config)
  }
}
