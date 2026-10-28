/**
 * How an HTTP request names its tenant: the header a gateway sets, the
 * hostname the request arrived on, and the subdomain label under a configured
 * base domain. Pure over a directory and a header table, so the route handler
 * owns transport and this module owns the policy.
 */

import { TENANT_ID_SYNTAX } from '@lyness/lyn-tenant'
import type { Tenant, TenantDirectory } from '@lyness/lyn-tenant'

/** Header naming the tenant by id, as a gateway in front of this deployment sets it. */
export const TENANT_HEADER = 'x-tenant-id'

/** How a resolved request named its tenant, for diagnostics and for the response. */
export type TenantSource = 'header' | 'host' | 'subdomain'

/** One resolved request. */
export interface ResolvedTenant {
  /** The tenant this request belongs to. */
  readonly tenant: Tenant
  /** Which part of the request named it. */
  readonly source: TenantSource
}

/** Node's header table: one value per name, or several when the client repeated the name. */
export type RequestHeaders = Partial<Record<string, string | string[]>>

/**
 * Read one header, refusing a repeated name.
 * @param headers - the request's headers.
 * @param name - lowercase header name.
 * @returns the single value, or undefined when absent or repeated.
 */
function header(headers: RequestHeaders, name: string): string | undefined {
  const value = headers[name]
  // A repeated name is ambiguous, and a tenant is an isolation boundary: refuse rather than pick one.
  return typeof value === 'string' ? value : undefined
}

/**
 * The hostname a request arrived on, without its port.
 * @param headers - the request's headers.
 * @returns the lowercase hostname, or undefined when the request carries no usable Host.
 */
export function requestHostname(headers: RequestHeaders): string | undefined {
  const host = header(headers, 'host')?.trim().toLowerCase()
  if (host === undefined || host === '') return undefined
  // A bracketed IPv6 literal keeps its brackets; only the trailing :port is cut.
  const hostname = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0]
  return hostname === undefined || hostname === '' ? undefined : hostname
}

/**
 * The subdomain label a hostname carries directly under a base domain.
 * @param hostname - lowercase hostname without port.
 * @param baseDomain - the deployment's base domain, without a leading dot.
 * @returns the single label, or undefined when the hostname is not one label under that domain.
 */
export function subdomainLabel(hostname: string, baseDomain: string): string | undefined {
  const suffix = `.${baseDomain}`
  if (!hostname.endsWith(suffix)) return undefined
  const label = hostname.slice(0, -suffix.length)
  // Only a direct child resolves: `a.b.example.com` under `example.com` names no tenant.
  return label === '' || label.includes('.') ? undefined : label
}

/**
 * Resolve the tenant one request belongs to.
 *
 * The header wins when present, because a deployment that sets it has already
 * decided the tenant; the hostname and then the subdomain answer the requests
 * that arrive directly. A header naming an unknown or malformed tenant
 * resolves to nothing rather than falling through to the hostname: a caller
 * that stated a tenant must not silently be served another one.
 * @param directory - the mounted tenant directory.
 * @param headers - the request's headers.
 * @param baseDomain - base domain whose direct subdomains name tenants, or undefined to resolve no subdomain.
 * @returns the tenant and how it was named, or undefined when the request resolves to none.
 */
export async function resolveTenant(
  directory: TenantDirectory,
  headers: RequestHeaders,
  baseDomain?: string,
): Promise<ResolvedTenant | undefined> {
  const stated = header(headers, TENANT_HEADER)?.trim()
  if (stated !== undefined && stated !== '') {
    if (!TENANT_ID_SYNTAX.test(stated)) return undefined
    const tenant = await directory.get(stated as Tenant['id'])
    return tenant === undefined ? undefined : { tenant, source: 'header' }
  }
  const hostname = requestHostname(headers)
  if (hostname === undefined) return undefined
  const byHost = await directory.byHost(hostname)
  if (byHost !== undefined) return { tenant: byHost, source: 'host' }
  if (baseDomain === undefined) return undefined
  const label = subdomainLabel(hostname, baseDomain)
  if (label === undefined) return undefined
  const bySlug = await directory.bySlug(label)
  return bySlug === undefined ? undefined : { tenant: bySlug, source: 'subdomain' }
}
