/**
 * Vocabulary for Feishu sign-in: the two identities its directory answers
 * with, and the subject this integration hands a sign-in.
 *
 * @module @lyness/lyn-feishu/types
 */

import type { Branded } from '@lyness/lyn-brand'

/** One tenant's own key, which Feishu calls `tenant_key`. */
export type FeishuTenantKey = Branded<'FeishuTenantKey'>

/**
 * One person's id across everything one Feishu application can see, which
 * Feishu calls `union_id`.
 *
 * The union id rather than the open id: an open id is per application, so a
 * binding written against one would stop matching the moment a deployment
 * registered a second application for the same tenant.
 */
export type FeishuUnionId = Branded<'FeishuUnionId'>

/** One person, as the tenant's directory reports them. */
export interface FeishuSubject {
  /** The tenant that authenticated them. */
  readonly tenantKey: FeishuTenantKey
  /** Their id across this application, stable across renames. */
  readonly unionId: FeishuUnionId
  /** Name the directory holds, when it publishes one. */
  readonly name?: string | undefined
  /** Address the directory holds, when it publishes one. */
  readonly email?: string | undefined
}
