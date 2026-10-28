/**
 * The authority extension point: what the Gateway asks before it dispatches,
 * what a refusal does to the call, and that a deployment with no rule mounted
 * serves every call as it did before.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context, Service } from '@lyness/cordis'
import { bindTypertRemote, Remote, remoteErrorOf } from '@lyness/lyn-typert-protocol'
import type { RemoteAuthority } from '@lyness/lyn-typert-protocol'
import TypertRegistry from '@lyness/lyn-typert-registry'
import TypertGatewayService from '@lyness/lyn-api-gateway'
import type { RemoteAuthorizationRequest } from '@lyness/lyn-api-gateway'
import type { PeerId, PeerScope } from '@lyness/lyn-typert-protocol'

const live: Context[] = []
afterEach(async () => { for (const ctx of live.splice(0)) await ctx.fiber.dispose() })

/** A namespace members may read and only the platform may write. */
class LedgerService extends Service {
  readonly typertRemote = bindTypertRemote(this, 'ledger', { requires: 'member' })
  written = 0

  constructor(ctx: Context) {
    super(ctx, 'ledger')
  }

  @Remote
  read(): string {
    return 'balance'
  }

  @Remote({ requires: 'platform-administrator' })
  write(): string {
    this.written += 1
    return 'written'
  }
}

/** A namespace nobody classified. */
class LooseService extends Service {
  readonly typertRemote = bindTypertRemote(this, 'loose')

  constructor(ctx: Context) {
    super(ctx, 'loose')
  }

  @Remote
  anything(): string {
    return 'served'
  }
}

/** A Gateway with both fixtures and an optional rule mounted. */
async function bench(rule?: (call: RemoteAuthorizationRequest) => string | undefined): Promise<{
  ctx: Context
  asked: RemoteAuthorizationRequest[]
}> {
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(TypertRegistry)
  await ctx.plugin(TypertGatewayService)
  await ctx.plugin(LedgerService)
  await ctx.plugin(LooseService)
  const asked: RemoteAuthorizationRequest[] = []
  if (rule !== undefined) {
    ctx.on('typert/authorize', (call: RemoteAuthorizationRequest) => {
      asked.push(call)
      return rule(call)
    })
  }
  return { ctx, asked }
}

/** Invoke one endpoint through the Gateway. */
function invoke(ctx: Context, namespace: string, method: string): Promise<unknown> {
  // These assertions are about the authority point, which reads the standing
  // from the rule rather than from the Peer, so one owner Peer serves them all.
  const peer: PeerScope = {
    id: 'authorize-spec-peer' as PeerId,
    ctx,
    principal: { kind: 'owner' },
    interactions: 'answer',
    signal: new AbortController().signal,
    dispose: async () => {},
  }
  return ctx.typertGateway.invoke({ namespace, method, args: {}, peer })
}

describe('the Gateway authority point', () => {
  it('serves every call when no rule is mounted', async () => {
    const { ctx } = await bench()
    expect(await invoke(ctx, 'ledger', 'read')).toBe('balance')
    expect(await invoke(ctx, 'ledger', 'write')).toBe('written')
    expect(await invoke(ctx, 'loose', 'anything')).toBe('served')
  })

  it('asks with the standing the namespace declared', async () => {
    const { ctx, asked } = await bench(() => undefined)
    await invoke(ctx, 'ledger', 'read')
    expect(asked).toEqual([{ endpoint: 'ledger/read', namespace: 'ledger', method: 'read', requires: 'member' }])
  })

  it('asks with the method’s own standing where it raised it', async () => {
    const { ctx, asked } = await bench(() => undefined)
    await invoke(ctx, 'ledger', 'write')
    expect(asked[0]?.requires).toBe('platform-administrator')
  })

  it('asks with no standing for a namespace nobody classified', async () => {
    const { ctx, asked } = await bench(() => undefined)
    await invoke(ctx, 'loose', 'anything')
    expect(asked[0]?.requires).toBeUndefined()
  })

  it('refuses the call with the reason the rule gave, and never runs the method', async () => {
    const { ctx } = await bench(call => call.requires === 'platform-administrator' ? 'not your installation' : undefined)
    const refused = await invoke(ctx, 'ledger', 'write').catch((error: unknown) => error)
    const error = remoteErrorOf(refused)
    expect(error?.code).toBe('gateway/forbidden')
    expect(error?.message).toContain('not your installation')
    const ledger = ctx.get('ledger') as LedgerService
    expect(ledger.written).toBe(0)
    // The same rule leaves the read alone.
    expect(await invoke(ctx, 'ledger', 'read')).toBe('balance')
  })

  it('refuses an awaited decision the same way', async () => {
    const { ctx } = await bench(() => undefined)
    ctx.on('typert/authorize', () => Promise.resolve('decided later'))
    const refused = await invoke(ctx, 'ledger', 'read').catch((error: unknown) => error)
    expect(remoteErrorOf(refused)?.code).toBe('gateway/forbidden')
  })

  it('takes the first refusal and stops asking', async () => {
    const seen: RemoteAuthority[] = []
    const { ctx } = await bench(() => 'first')
    ctx.on('typert/authorize', (call: RemoteAuthorizationRequest) => {
      if (call.requires !== undefined) seen.push(call.requires)
      return 'second'
    })
    const refused = await invoke(ctx, 'ledger', 'read').catch((error: unknown) => error)
    expect(remoteErrorOf(refused)?.message).toContain('first')
    expect(seen).toEqual([])
  })
})
