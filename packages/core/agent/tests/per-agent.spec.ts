/**
 * What `composePerAgent` guarantees: every agent gets the contribution once,
 * an agent that goes away is not withdrawn twice, and the contributing
 * plugin's unmount takes back what is still standing.
 */

import { unsupportedModel } from '@lyness/lyn-agent-loop-testkit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@lyness/cordis'
import { Session, SessionId } from '@lyness/lyn-session'
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import AgentRegistry, { composePerAgent } from '@lyness/lyn-agent'
import type { Agent, AgentContribution } from '@lyness/lyn-agent'

const live: Context[] = []
afterEach(async () => { for (const ctx of live.splice(0)) await ctx.fiber.dispose() })

/** A registry over which agents can be registered and unregistered. */
async function bench(): Promise<Context> {
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(AgentRegistry).await()
  return ctx
}

/**
 * A registered Agent double over its own scope, and the two ways it goes
 * away: unregistering it, and disposing the scope its contributions sit on.
 * A production agent does both at once; separating them is what lets the
 * spec show that neither withdraws twice.
 */
async function registered(ctx: Context, rawId: string) {
  const id = SessionId(rawId)
  let scope: Context | undefined
  const fiber = await ctx.plugin((inner: Context) => { scope = inner }).await()
  if (scope === undefined) throw new Error('expected the agent scope to be mounted')
  const agent = {
    id,
    options: {},
    session: Session.create(id),
    model: unsupportedModel(),
    inbox: { nextTurn: [], nextStep: [] } as never,
    status: 'idle' as const,
    ctx: scope,
    send: () => {},
    followup: () => {},
    steer: () => ({ outcome: Promise.resolve({ status: 'rejected' as const }) }),
    inject: () => {},
    cancel: () => {},
    runMaintenance: <T>(task: (signal: AbortSignal) => Promise<T>) => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  } satisfies Agent
  const unregister = await ctx.agents.register(agent)
  return { agent, unregister, disposeScope: () => fiber.dispose() }
}

/** One plugin whose own fiber owns the contribution, so its unmount is observable. */
async function contributor(ctx: Context, contribute: AgentContribution) {
  return ctx.plugin({
    inject: ['agents'],
    apply: (plugin: Context) => { composePerAgent(plugin, contribute) },
  }).await()
}

describe('composePerAgent', () => {
  it('contributes to an agent already running and to one registered afterwards', async () => {
    const ctx = await bench()
    const first = await registered(ctx, 'one')
    const seen: Agent[] = []
    await contributor(ctx, (agent) => {
      seen.push(agent)
      return () => {}
    })
    const second = await registered(ctx, 'two')
    expect(seen).toEqual([first.agent, second.agent])
  })

  it('withdraws the contribution with the agent own scope', async () => {
    const ctx = await bench()
    const withdraw = vi.fn()
    await contributor(ctx, () => withdraw)
    const { disposeScope } = await registered(ctx, 'one')
    await disposeScope()
    expect(withdraw).toHaveBeenCalledOnce()
  })

  it('does not withdraw twice when the plugin unmounts after an agent went away', async () => {
    const ctx = await bench()
    const withdraw = vi.fn()
    const fiber = await contributor(ctx, () => withdraw)
    const { unregister, disposeScope } = await registered(ctx, 'one')
    await unregister()
    await disposeScope()
    await fiber.dispose()
    expect(withdraw).toHaveBeenCalledOnce()
  })

  it('withdraws what is still standing when the plugin unmounts', async () => {
    const ctx = await bench()
    const withdraw = vi.fn()
    const fiber = await contributor(ctx, () => withdraw)
    await registered(ctx, 'one')
    await fiber.dispose()
    expect(withdraw).toHaveBeenCalledOnce()
  })

  it('keeps nothing for an agent the contribution declines', async () => {
    const ctx = await bench()
    const declined: string[] = []
    const fiber = await contributor(ctx, (agent) => {
      declined.push(String(agent.id))
      return undefined
    })
    await registered(ctx, 'one')
    expect(declined).toEqual(['one'])
    // Nothing was kept, so unmounting reaches into no agent scope that was
    // never given anything.
    await fiber.dispose()
  })
})
