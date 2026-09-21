/** Disposal: the request scope is withdrawn with the fiber that registered it. */

import { Context } from '@lyness/cordis'
import { describe, expect, it } from 'vitest'
import { HostConnectionService } from '@lyness/lyn-client-connection'
import StaticTenantDirectory from '@lyness/lyn-tenant-static'
import RequestTenantScope from '../src/index.ts'

const TENANTS = { tenants: [{ id: 'acme', slug: 'acme', displayName: 'Acme' }] }

describe('the request scope registration', () => {
  it('stops resolving tenants once its fiber is disposed', async () => {
    const ctx = new Context()
    await ctx.plugin(StaticTenantDirectory, TENANTS)
    const connectionFiber = ctx.plugin((pluginCtx: Context) => {
      // The browser-auth owner is unreachable here: nothing in this test passes the trust fence.
      new HostConnectionService(pluginCtx, [], {} as ConstructorParameters<typeof HostConnectionService>[2])
    })
    await connectionFiber.await()
    const fiber = ctx.plugin(RequestTenantScope)
    await fiber.await()

    const connection = ctx.get('connection')
    /* v8 ignore next -- mounted directly above; the read narrows the optional service type. */
    if (connection === undefined) throw new Error('expected the Connection to be mounted')
    let seen: string | undefined
    connection.rpc.intercept('/api', () => true, () => {
      seen = ctx.get('requestTenant')?.current()?.tenant.id
      return Promise.resolve({ ok: true, value: null })
    })
    const shared = connection.createSharedFetchHandler('/api')
    const call = async (): Promise<void> => {
      seen = undefined
      await shared.fetch(new Request('http://host/api/probe/read', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-tenant-id': 'acme' },
        body: JSON.stringify({ type: 'client-request', rpcId: 'r-1', method: 'probe/read', payload: {} }),
      }))
    }

    await call()
    expect(seen).toBe('acme')

    await fiber.dispose()
    await call()
    expect(seen).toBeUndefined()
    await connectionFiber.dispose()
  })
})
