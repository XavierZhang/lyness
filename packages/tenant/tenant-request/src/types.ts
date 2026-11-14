/**
 * The tenant of the call in progress, as every reader sees it.
 *
 * Types only — no runtime code, and nothing here reaches the Connection. A
 * consumer that reads `ctx.requestTenant` therefore compiles against this
 * module alone, without taking on the web transport the scope is registered on.
 * @module @lyness/lyn-tenant-request/types
 */

import type { Tenant } from '@lyness/lyn-tenant'
import type { TenantConfig } from '@lyness/lyn-tenant-config'
import type { TenantSource } from '@lyness/lyn-tenant-http'

/** Everything the current call knows about the organization that made it. */
export interface RequestTenant {
  /** The tenant this call belongs to. */
  readonly tenant: Tenant
  /** Which part of the request named it. */
  readonly source: TenantSource
  /** The tenant's configuration, when a store is mounted and the tenant has one. */
  readonly config?: TenantConfig | undefined
}

/** What a consumer may do with the tenant of the call in progress. */
export interface RequestTenantReader {
  /**
   * The tenant of the call in progress.
   * @returns the resolved tenant, or undefined outside a call and for a call that named none.
   */
  current(): RequestTenant | undefined
}

declare module '@lyness/cordis' {
  interface Context {
    requestTenant: RequestTenantReader
  }
}
