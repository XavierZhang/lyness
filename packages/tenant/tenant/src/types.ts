/**
 * Tenant types, shared by every face that names a tenant.
 *
 * Types only — no runtime code, and nothing here reaches a Host-only symbol,
 * so a Client compilation face reads exactly the signatures the Host emits.
 * @module @lyness/lyn-tenant/types
 */

import type { TenantId } from './brand.ts'

export type { TenantId } from './brand.ts'

/** One tenant: an organization whose data, configuration, and credentials are separate from every other tenant's. */
export interface Tenant {
  /** Immutable identity, the value durable records and wire payloads carry. */
  readonly id: TenantId
  /** Operator-facing handle, unique in the deployment; also the subdomain label a request can arrive on. */
  readonly slug: string
  /** Name shown to that tenant's users. */
  readonly displayName: string
}
