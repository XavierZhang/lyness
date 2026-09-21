/**
 * The tenant one RPC call belongs to, resolved once when the call arrives and
 * readable, without a parameter, by everything that call reaches.
 *
 * Remote methods do not carry the request they arrived on: a namespace answers
 * about what the caller asked for, not about how it asked. That leaves nowhere
 * for the calling organization to live, and a tenant cannot be a method
 * parameter — a caller that names its own tenant names any tenant. So this
 * plugin registers a Connection request scope, resolves the tenant the same way
 * the HTTP route does, and publishes it for the duration of the call.
 *
 * The tenant's configuration is resolved in the same step, because the callers
 * that need it are synchronous — the session-creation listener that stamps a
 * session cannot await a store. Both shipped configuration backends answer a
 * read from memory, so this costs the call one map lookup; a backend whose read
 * is slow pays that on every call.
 *
 * An unresolved call is not refused here. Which calls may proceed without a
 * tenant is the answering surface's decision: a namespace that reads or writes
 * one organization's data refuses, while a call that touches none does not need
 * to know. Refusing here would make every endpoint on every channel
 * tenant-only, which is not what mounting a directory says.
 * @module @lyness/lyn-tenant-request
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { Context, Service } from '@lyness/cordis'
import z from '@lyness/schemastery'
import type {} from '@lyness/lyn-client-connection'
import { resolveTenant } from '@lyness/lyn-tenant-http'
import type { RequestHeaders } from '@lyness/lyn-tenant-http'
import type { RequestTenant, RequestTenantReader } from './types.ts'

export type { RequestTenant, RequestTenantReader } from './types.ts'

/** Plugin config: which hostnames carry a tenant slug. */
export interface Config {
  /** Base domain whose direct subdomains name tenants by slug; omit to resolve no subdomain. */
  baseDomain?: string
}

/**
 * Convert Fetch headers into the header table the resolver reads.
 *
 * `Headers` joins a repeated name into one comma-separated value, which the
 * resolver then refuses as malformed — the same answer it gives a repeated
 * `x-tenant-id` in a node header table, and the answer a tenant boundary wants.
 * @param headers - the request's headers.
 * @returns one lowercase-named entry per header.
 */
function headerTable(headers: Headers): RequestHeaders {
  const table: Record<string, string> = {}
  for (const [name, value] of headers) table[name.toLowerCase()] = value
  return table
}

/**
 * Publishes the tenant of the RPC call in progress.
 *
 * Reads are valid only inside a call the scope entered. Outside one — at load,
 * on a timer, in a session this process resumed — {@link current} answers
 * undefined, which is the honest answer rather than the last call's tenant.
 */
export default class RequestTenantScope extends Service implements RequestTenantReader {
  static inject = ['connection', 'tenants']

  static Config: z<Config> = z.object({ baseDomain: z.string() })

  private readonly store = new AsyncLocalStorage<RequestTenant>()

  private readonly baseDomain: string | undefined

  /**
   * Register the request scope on the Connection.
   * @param ctx - plugin context carrying the directory and the Connection.
   * @param config - the validated plugin config.
   */
  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'requestTenant')
    this.baseDomain = config.baseDomain
    ctx.inject(['connection'], (connectionCtx) => {
      connectionCtx.connection.rpc.scope((request, run) => this.enter(request, run))
    })
  }

  /**
   * The tenant of the call in progress.
   * @returns the resolved tenant, or undefined outside a call and for a call that named none.
   */
  current(): RequestTenant | undefined {
    return this.store.getStore()
  }

  /**
   * Resolve this request's tenant, then run the call inside it.
   * @param request - the HTTP request the call arrived on.
   * @param run - the channel owner's dispatch.
   * @returns whatever the dispatch returned.
   */
  private async enter<T>(request: Request, run: () => Promise<T>): Promise<T> {
    const resolved = await resolveTenant(this.ctx.tenants, headerTable(request.headers), this.baseDomain)
    if (resolved === undefined) return run()
    // Optional service: a deployment may resolve tenants without configuring them.
    const config = await this.ctx.get('tenantConfig')?.get(resolved.tenant.id)
    return this.store.run({
      tenant: resolved.tenant,
      source: resolved.source,
      ...config === undefined ? {} : { config },
    }, run)
  }
}
