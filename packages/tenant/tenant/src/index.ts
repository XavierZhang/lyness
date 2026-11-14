/**
 * Service Definition for the `ctx.tenants` capability seam: which tenants this
 * deployment serves, and how a request's tenant is looked up.
 *
 * A tenant is an organization whose data, configuration, and credentials stay
 * separate from every other tenant's. The seam is a directory, not a policy:
 * it answers three lookups a request can be resolved by — the immutable id a
 * caller states, the hostname a request arrived on, and the slug a subdomain
 * carries — and it never decides which of them a transport should trust. That
 * decision belongs to the Consumer that reads the request, because the trusted
 * source differs per deployment: a header is authoritative behind a gateway
 * that sets it, and forgeable in front of one.
 *
 * A deployment without this service is single-tenant; nothing in the harness
 * requires it. A deployment that mounts it refuses what it cannot resolve
 * rather than falling back, because a tenant is an isolation boundary and a
 * wrong tenant is another organization's data.
 * @module @lyness/lyn-tenant
 */

import { Context, Service } from '@lyness/cordis'
import type { Tenant, TenantId } from './types.ts'

export { isTenantSlug, TenantId, TENANT_ID_SYNTAX, TENANT_SLUG_SYNTAX } from './brand.ts'
export type { Tenant } from './types.ts'

/** Closed failure vocabulary of tenant resolution, mirrored onto the wire by consumers. */
export type TenantErrorCode = 'unknown-tenant'

/** Typed refusal so consumers map business codes without string matching. */
export class TenantError extends Error {
  /**
   * @param code - closed business code of the failure.
   * @param message - operator-facing description.
   */
  constructor(readonly code: TenantErrorCode, message: string) {
    super(message)
    this.name = 'TenantError'
  }
}

declare module '@lyness/cordis' {
  interface Context {
    tenants: TenantDirectory
  }
}

/**
 * Abstract tenant directory. Subclass, implement the three lookups, and load
 * the subclass as a plugin — it registers as `ctx.tenants` (one directory per
 * context; loading a second throws, cordis' standard duplicate-service
 * behavior).
 *
 * Every lookup answers `undefined` for an unknown subject rather than
 * throwing: not finding a tenant is an ordinary outcome of resolving an
 * arbitrary request, and the Consumer decides what refusing looks like on its
 * transport. Lookups are asynchronous because a directory may be a database.
 */
export abstract class TenantDirectory extends Service {
  constructor(ctx: Context) {
    super(ctx, 'tenants')
  }

  /**
   * Look one tenant up by its immutable id.
   * @param id - the tenant id.
   * @returns the tenant, or undefined when this deployment serves no such tenant.
   */
  abstract get(id: TenantId): Promise<Tenant | undefined>

  /**
   * Look one tenant up by a hostname it is served on.
   * @param hostname - lowercase hostname without port.
   * @returns the tenant, or undefined when no tenant claims that hostname.
   */
  abstract byHost(hostname: string): Promise<Tenant | undefined>

  /**
   * Look one tenant up by its slug.
   * @param slug - the operator-facing handle, also the subdomain label.
   * @returns the tenant, or undefined when no tenant carries that slug.
   */
  abstract bySlug(slug: string): Promise<Tenant | undefined>
}

export default TenantDirectory
