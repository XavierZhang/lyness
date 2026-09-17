/** The tenant id brand and the syntax an id and a slug must obey. */

import { brandString } from '@lyness/lyn-brand'
import type { Branded } from '@lyness/lyn-brand'

/**
 * Identifies one tenant of this deployment.
 *
 * The id is opaque and immutable: it is neither the slug nor a hostname,
 * because both are presentation an operator may change, while every durable
 * record that names a tenant must keep resolving after such a change.
 */
export type TenantId = Branded<'TenantId'>

/**
 * Syntax of a tenant id: 1–64 characters of ASCII letters, digits, `-`, or
 * `_`, starting with a letter or digit. It admits a uuid and a generated
 * short id, and refuses anything that would need escaping in a header, a
 * path segment, or a storage key.
 */
export const TENANT_ID_SYNTAX = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u

/**
 * Syntax of a tenant slug: one DNS label, so a slug can be a subdomain.
 * Lowercase only, because hostnames compare case-insensitively and two slugs
 * differing in case would be one subdomain.
 */
export const TENANT_SLUG_SYNTAX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u

/**
 * Brand a string as a {@link TenantId}.
 * @param id - the raw id.
 * @returns the same string with the tenant-id brand.
 * @throws {TypeError} when the string is not {@link TENANT_ID_SYNTAX}.
 */
export function TenantId(id: string): TenantId {
  if (!TENANT_ID_SYNTAX.test(id)) {
    throw new TypeError(`TenantId must be 1-64 characters of letters, digits, "-", or "_"; got ${JSON.stringify(id)}`)
  }
  return brandString<TenantId>(id)
}

/**
 * Whether a string is a usable tenant slug.
 * @param slug - the candidate slug.
 * @returns true for one lowercase DNS label.
 */
export function isTenantSlug(slug: string): boolean {
  return TENANT_SLUG_SYNTAX.test(slug)
}
