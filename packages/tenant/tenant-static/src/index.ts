/**
 * Composition-configured backend of the tenant seam: the deployment's tenants
 * are rows in its patch layer, and the directory is the index built from them
 * at load.
 *
 * A tenant roster that lives in composition is the roster an operator can read
 * and diff before a deployment starts, which is what a private deployment and
 * an early SaaS deployment both need; a database-backed directory replaces
 * this row without changing the seam. Every row is validated at load — id and
 * slug syntax, and no two tenants claiming one id, slug, or hostname — because
 * an ambiguous roster resolves requests to arbitrary tenants, and that is
 * another organization's data.
 * @module @lyness/lyn-tenant-static
 */

import { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
import { isTenantSlug, TENANT_ID_SYNTAX, TenantDirectory, TenantId } from '@lyness/lyn-tenant'
import type { Tenant } from '@lyness/lyn-tenant'

/** One configured tenant. */
export interface TenantEntry {
  /** Immutable id; durable records carry this value. */
  id: string
  /** Operator-facing handle and subdomain label, unique in the deployment. */
  slug: string
  /** Name shown to that tenant's users. */
  displayName: string
  /** Hostnames served for this tenant, each claimed by exactly one tenant. */
  hosts?: string[]
}

/** One configured tenant after the schema has applied its defaults. */
interface ResolvedEntry extends TenantEntry {
  hosts: string[]
}

/** Plugin config: the deployment's tenant roster. */
export interface Config {
  /** Every tenant this deployment serves; at least one. */
  tenants: TenantEntry[]
}

/** Hostname syntax a row may claim: labels of letters, digits, and hyphens, without scheme, port, or path. */
const HOSTNAME_SYNTAX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/u

/**
 * Refuse a configured value, naming the row.
 * @param index - position of the row in the roster.
 * @param message - what is wrong with it.
 * @throws {Error} always.
 */
function refuse(index: number, message: string): never {
  throw new Error(`tenant-static: tenants[${String(index)}] ${message}`)
}

/**
 * Claim one key for one tenant, refusing a second claimant.
 * @param claims - keys already claimed, by claimed value.
 * @param key - the value being claimed.
 * @param index - position of the claiming row.
 * @param subject - what the key is, for the refusal message.
 */
function claim(claims: Map<string, string>, key: string, index: number, subject: string): void {
  const owner = claims.get(key)
  if (owner !== undefined) refuse(index, `claims ${subject} ${JSON.stringify(key)}, which tenant ${JSON.stringify(owner)} already claims`)
}

/** The `ctx.tenants` implementation reading its roster from composition config. */
export default class StaticTenantDirectory extends TenantDirectory {
  static Config: z<Config> = z.object({
    tenants: z.array(z.object({
      id: z.string().required(),
      slug: z.string().required(),
      displayName: z.string().required(),
      hosts: z.array(z.string()).default([]),
    })).required(),
  })

  private readonly byId = new Map<string, Tenant>()
  private readonly hosts = new Map<string, Tenant>()
  private readonly slugs = new Map<string, Tenant>()

  /**
   * @param ctx - the host context.
   * @param config - the validated roster.
   * @throws {Error} when a row is malformed, or two rows claim one id, slug, or hostname.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx)
    if (config.tenants.length === 0) throw new Error('tenant-static: the roster names no tenant; a mounted directory serves at least one')
    const idClaims = new Map<string, string>()
    const slugClaims = new Map<string, string>()
    const hostClaims = new Map<string, string>()
    // The schema applied its array default before the constructor ran; the cast
    // records that once rather than defaulting a second time behind its back.
    for (const [index, entry] of (config.tenants as ResolvedEntry[]).entries()) {
      if (!TENANT_ID_SYNTAX.test(entry.id)) {
        refuse(index, `id ${JSON.stringify(entry.id)} is not 1-64 characters of letters, digits, "-", or "_"`)
      }
      const id = TenantId(entry.id)
      if (!isTenantSlug(entry.slug)) refuse(index, `slug ${JSON.stringify(entry.slug)} is not one lowercase DNS label`)
      if (entry.displayName.trim() === '') refuse(index, 'displayName is blank')
      claim(idClaims, entry.id, index, 'id')
      claim(slugClaims, entry.slug, index, 'slug')
      const tenant: Tenant = { id, slug: entry.slug, displayName: entry.displayName }
      idClaims.set(entry.id, entry.id)
      slugClaims.set(entry.slug, entry.id)
      this.byId.set(entry.id, tenant)
      this.slugs.set(entry.slug, tenant)
      for (const host of entry.hosts) {
        const hostname = host.trim().toLowerCase()
        if (!HOSTNAME_SYNTAX.test(hostname)) refuse(index, `host ${JSON.stringify(host)} is not a hostname`)
        claim(hostClaims, hostname, index, 'host')
        hostClaims.set(hostname, entry.id)
        this.hosts.set(hostname, tenant)
      }
    }
  }

  /**
   * Look one tenant up by its immutable id.
   * @param id - the tenant id.
   * @returns the tenant, or undefined when the roster names no such tenant.
   */
  get(id: Tenant['id']): Promise<Tenant | undefined> {
    return Promise.resolve(this.byId.get(id))
  }

  /**
   * Look one tenant up by a hostname it is served on.
   * @param hostname - lowercase hostname without port.
   * @returns the tenant claiming that hostname, or undefined.
   */
  byHost(hostname: string): Promise<Tenant | undefined> {
    return Promise.resolve(this.hosts.get(hostname))
  }

  /**
   * Look one tenant up by its slug.
   * @param slug - the operator-facing handle.
   * @returns the tenant carrying that slug, or undefined.
   */
  bySlug(slug: string): Promise<Tenant | undefined> {
    return Promise.resolve(this.slugs.get(slug))
  }
}
