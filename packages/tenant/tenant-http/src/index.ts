/**
 * Consumer of the tenant seam over HTTP: resolves the tenant one request
 * belongs to and answers who that is.
 *
 * Resolution policy lives here rather than in the seam because it is transport
 * knowledge — which part of a request a deployment trusts to name a tenant.
 * The route answers only about the request that asked: it never lists the
 * roster, so a caller learns nothing beyond the tenant its own hostname or
 * header already names. An unresolved request is refused; a tenant is an
 * isolation boundary, so there is no fallback tenant to serve instead.
 * @module @lyness/lyn-tenant-http
 */

import { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
import type {} from '@lyness/lyn-host-webserver'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolveTenant } from './resolve.ts'

export { requestHostname, resolveTenant, subdomainLabel, TENANT_HEADER } from './resolve.ts'
export type { RequestHeaders, ResolvedTenant, TenantSource } from './resolve.ts'

/** Stable Cordis plugin name. */
export const name = 'tenant-http'

/** The directory this route resolves against, and the server it answers on. */
export const inject = ['tenants', 'webServer']

/** Plugin config: where the route answers, and which hostnames carry a tenant slug. */
export interface Config {
  /** Exact pathname of the route. */
  path?: string
  /** Base domain whose direct subdomains name tenants by slug; omit to resolve no subdomain. */
  baseDomain?: string
}

/** Default pathname: outside `/api`, which the browser connection owns whole. */
const DEFAULT_PATH = '/tenant'

export const Config: z<Config> = z.object({
  path: z.string().default(DEFAULT_PATH),
  baseDomain: z.string(),
})

/** Config after the schema has applied its defaults. */
interface ResolvedConfig extends Config {
  path: string
}

/**
 * Answer one request with JSON.
 * @param res - the response to end.
 * @param status - HTTP status code.
 * @param body - JSON-serializable payload.
 */
function json(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(text)
}

/**
 * Serve the tenant route: resolve this deployment's tenant for one request.
 * @param ctx - plugin context carrying `ctx.tenants` and `ctx.webServer`.
 * @param config - the validated plugin config.
 * @throws {Error} when the configured path is not an absolute pathname.
 */
export function apply(ctx: Context, config: Config): void {
  // The schema applied its default before apply ran; the cast records that once
  // rather than defaulting a second time behind the schema's back.
  const { path, baseDomain } = config as ResolvedConfig
  if (!path.startsWith('/')) {
    throw new Error(`tenant-http: path must be an absolute pathname; got ${JSON.stringify(path)}`)
  }
  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      json(res, 405, { error: 'method-not-allowed' })
      return
    }
    const resolved = await resolveTenant(ctx.tenants, req.headers, baseDomain)
    if (resolved === undefined) {
      json(res, 404, { error: 'unknown-tenant' })
      return
    }
    const { tenant, source } = resolved
    json(res, 200, { id: tenant.id, slug: tenant.slug, displayName: tenant.displayName, source })
  }
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path, handler }), 'tenant-http.route')
}
