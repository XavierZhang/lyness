/** Per-request scopes: nesting order, reach into the handler, and withdrawal. */

import { AsyncLocalStorage } from 'node:async_hooks'
import { Context } from '@lyness/cordis'
import { describe, expect, it } from 'vitest'
import type { BrowserAuth } from '../src/browser-auth.ts'
import { HostConnectionService } from '../src/rpc-host.ts'
import type { ConnectionRpcResult } from '../src/rpc.ts'

async function mounted(): Promise<{
  readonly ctx: Context
  readonly connection: HostConnectionService
  readonly dispose: () => Promise<void>
}> {
  const ctx = new Context()
  const fiber = ctx.plugin((pluginCtx) => {
    new HostConnectionService(pluginCtx, [], {} as BrowserAuth)
  })
  await fiber.await()
  return {
    ctx,
    connection: ctx.get('connection') as HostConnectionService,
    dispose: () => fiber.dispose(),
  }
}

/**
 * One decoded call over the shared channel's interceptor.
 * @param connection - the mounted Host service.
 * @param headers - request headers the scope reads.
 * @returns the decoded response body.
 */
async function call(
  connection: HostConnectionService,
  headers: Record<string, string> = {},
): Promise<unknown> {
  const shared = connection.createSharedFetchHandler('/api')
  const response = await shared.fetch(new Request('http://host/api/probe/read', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ type: 'client-request', rpcId: 'r-1', method: 'probe/read', payload: {} }),
  }))
  return response.json()
}

describe('Connection per-request scopes', () => {
  it('lets a handler read state the scope resolved from the request', async () => {
    const { connection, dispose } = await mounted()
    const store = new AsyncLocalStorage<string>()
    connection.rpc.scope((request, run) =>
      store.run(request.headers.get('x-org') ?? 'none', run))
    connection.rpc.intercept(
      '/api',
      endpoint => endpoint.startsWith('probe/'),
      () => Promise.resolve({ ok: true, value: store.getStore() }),
    )

    expect(await call(connection, { 'x-org': 'acme' }))
      .toEqual({ type: 'server-response', rpcId: 'r-1', result: { ok: true, value: 'acme' } })
    expect(await call(connection))
      .toEqual({ type: 'server-response', rpcId: 'r-1', result: { ok: true, value: 'none' } })
    await dispose()
  })

  it('nests several scopes with the first registered outermost, and drops a withdrawn one', async () => {
    const { connection, dispose } = await mounted()
    const seen: string[] = []
    const withdrawn = connection.rpc.scope(async (_request, run) => {
      seen.push('first')
      return run()
    })
    connection.rpc.scope(async (_request, run) => {
      seen.push('second')
      return run()
    })
    connection.rpc.intercept('/api', () => true, () => {
      seen.push('handler')
      return Promise.resolve({ ok: true, value: null })
    })

    await call(connection)
    expect(seen).toEqual(['first', 'second', 'handler'])

    seen.length = 0
    await withdrawn()
    await call(connection)
    expect(seen).toEqual(['second', 'handler'])
    await dispose()
  })

  it('withdraws every scope when the registering fiber is disposed', async () => {
    const { ctx, connection, dispose } = await mounted()
    let entered = 0
    const fiber = ctx.plugin({
      inject: ['connection'],
      apply: (pluginCtx: Context) => {
        void pluginCtx.connection.rpc.scope(async (_request, run) => {
          entered += 1
          return run()
        })
      },
    })
    await fiber.await()
    connection.rpc.intercept('/api', () => true, () =>
      Promise.resolve({ ok: true, value: null } satisfies ConnectionRpcResult<null>))

    await call(connection)
    expect(entered).toBe(1)

    await fiber.dispose()
    await call(connection)
    expect(entered).toBe(1)
    await dispose()
  })
})
