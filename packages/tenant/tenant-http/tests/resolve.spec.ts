/** The resolution policy itself: which part of a request names a tenant, and when a request names none. */

import { describe, expect, it } from 'vitest'
import { TenantId } from '@lyness/lyn-tenant'
import type { Tenant, TenantDirectory } from '@lyness/lyn-tenant'
import { requestHostname, resolveTenant, subdomainLabel, TENANT_HEADER } from '../src/resolve.ts'
import type { RequestHeaders } from '../src/resolve.ts'

const ACME: Tenant = { id: TenantId('acme'), slug: 'acme', displayName: 'Acme' }

/** A directory serving one tenant, reachable by each of the three lookups. */
const DIRECTORY = {
  get: (id: Tenant['id']) => Promise.resolve(id === ACME.id ? ACME : undefined),
  byHost: (hostname: string) => Promise.resolve(hostname === 'acme.example.com' ? ACME : undefined),
  bySlug: (slug: string) => Promise.resolve(slug === ACME.slug ? ACME : undefined),
} as TenantDirectory

/**
 * Resolve one request against the single-tenant directory.
 * @param headers - the request's headers.
 * @param baseDomain - base domain whose subdomains name tenants.
 * @returns how the request resolved, or undefined.
 */
function resolve(headers: RequestHeaders, baseDomain?: string) {
  return resolveTenant(DIRECTORY, headers, baseDomain)
}

describe('requestHostname', () => {
  it('reads the hostname without its port, lowercased', () => {
    expect(requestHostname({ host: 'Acme.Example.COM:8080' })).toBe('acme.example.com')
    expect(requestHostname({ host: '[::1]:3000' })).toBe('[::1]')
  })

  it('reads no hostname from an absent, blank, or repeated Host', () => {
    expect(requestHostname({})).toBeUndefined()
    expect(requestHostname({ host: '   ' })).toBeUndefined()
    expect(requestHostname({ host: ':8080' })).toBeUndefined()
    expect(requestHostname({ host: ['a.example.com', 'b.example.com'] })).toBeUndefined()
  })
})

describe('subdomainLabel', () => {
  it('reads one label directly under the base domain', () => {
    expect(subdomainLabel('acme.example.com', 'example.com')).toBe('acme')
  })

  it('reads no label from the base domain itself, a deeper name, or another domain', () => {
    expect(subdomainLabel('example.com', 'example.com')).toBeUndefined()
    expect(subdomainLabel('a.b.example.com', 'example.com')).toBeUndefined()
    expect(subdomainLabel('acme.example.net', 'example.com')).toBeUndefined()
    expect(subdomainLabel('.example.com', 'example.com')).toBeUndefined()
  })
})

describe('resolveTenant', () => {
  it('takes the tenant the header states', async () => {
    expect(await resolve({ [TENANT_HEADER]: ' acme ', host: 'unknown.example.com' }))
      .toEqual({ tenant: ACME, source: 'header' })
  })

  it('takes the tenant the hostname is served for', async () => {
    expect(await resolve({ host: 'acme.example.com:443' })).toEqual({ tenant: ACME, source: 'host' })
  })

  it('takes the tenant a subdomain slug names when no hostname is claimed', async () => {
    expect(await resolve({ host: 'acme.tenants.example.com' }, 'tenants.example.com'))
      .toEqual({ tenant: ACME, source: 'subdomain' })
  })

  it('refuses a stated tenant that is unknown or malformed rather than falling through', async () => {
    expect(await resolve({ [TENANT_HEADER]: 'globex', host: 'acme.example.com' })).toBeUndefined()
    expect(await resolve({ [TENANT_HEADER]: 'acme corp', host: 'acme.example.com' })).toBeUndefined()
  })

  it('reads a blank or repeated header as no statement at all', async () => {
    expect(await resolve({ [TENANT_HEADER]: '  ', host: 'acme.example.com' })).toEqual({ tenant: ACME, source: 'host' })
    expect(await resolve({ [TENANT_HEADER]: ['acme', 'globex'], host: 'acme.example.com' }))
      .toEqual({ tenant: ACME, source: 'host' })
  })

  it('resolves nothing without a Host, without a base domain, or for an unknown subdomain', async () => {
    expect(await resolve({})).toBeUndefined()
    expect(await resolve({ host: 'acme.tenants.example.com' })).toBeUndefined()
    expect(await resolve({ host: 'globex.tenants.example.com' }, 'tenants.example.com')).toBeUndefined()
    expect(await resolve({ host: 'tenants.example.com' }, 'tenants.example.com')).toBeUndefined()
  })
})
