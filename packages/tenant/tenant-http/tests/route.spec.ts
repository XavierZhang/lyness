/** What the plugin owns beyond resolution: a refused config, and a route that leaves with its fiber. */

import { describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { TenantId } from '@lyness/lyn-tenant'
import type { Tenant, TenantDirectory } from '@lyness/lyn-tenant'
import * as TenantHttp from '../src/index.ts'

const ACME: Tenant = { id: TenantId('acme'), slug: 'acme', displayName: 'Acme' }

/** A context carrying a stub directory and a web server that records its routes. */
function bench() {
  const ctx = new Context()
  const routes = new Map<string, unknown>()
  ctx.provide('tenants', {
    get: () => Promise.resolve(ACME),
    byHost: () => Promise.resolve(undefined),
    bySlug: () => Promise.resolve(undefined),
  } as unknown as TenantDirectory)
  ctx.provide('webServer', {
    register: (route: { path: string }) => {
      routes.set(route.path, route)
      return () => { routes.delete(route.path) }
    },
  } as never)
  return { ctx, routes }
}

describe('tenant-http plugin', () => {
  it('declares the services it reads', () => {
    expect(TenantHttp.name).toBe('tenant-http')
    expect(TenantHttp.inject).toEqual(['tenants', 'webServer'])
  })

  it('claims its route and releases it with the fiber', async () => {
    const { ctx, routes } = bench()
    const fiber = ctx.plugin(TenantHttp, { path: '/tenant' })
    await fiber.await()
    expect([...routes.keys()]).toEqual(['/tenant'])
    await fiber.dispose()
    expect(routes.size).toBe(0)
  })

  it('refuses a path that is not an absolute pathname', async () => {
    const { ctx } = bench()
    await ctx.plugin(TenantHttp, { path: 'tenant' }).await().catch((error: unknown) => {
      expect(String(error)).toMatch(/path must be an absolute pathname/u)
    })
  })
})
