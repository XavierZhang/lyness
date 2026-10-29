/**
 * Contribute something to every agent in a process, now and later, and take
 * it back when the contributing plugin unmounts.
 *
 * Its own unit because the lifecycle is the same for every contributor and is
 * easy to get subtly wrong: the agents already running when the plugin mounts
 * need the contribution too, an agent that goes away must not be withdrawn
 * twice, and the contributions sit on agent scopes that the contributing
 * plugin's own teardown does not unwind.
 *
 * @module @lyness/lyn-agent/per-agent
 */

import type { Context } from '@lyness/cordis'
import type { Agent } from './types.ts'

/**
 * What one contributor does for a single agent.
 *
 * @param agent - the agent to contribute to.
 * @returns the disposer that withdraws the contribution, or undefined when
 * this agent gets none.
 */
export type AgentContribution = (agent: Agent) => (() => void) | undefined

/**
 * Run one contribution for every agent of this process.
 *
 * The contribution runs once per agent: for each one already running when
 * this is called, and for each one created afterwards. Each disposer is also
 * owned by that agent's own scope, so disposing the agent withdraws the
 * contribution; this function keeps the disposers only for the contributing
 * plugin's unmount, which an agent scope would not reach.
 * @param ctx - the contributing plugin's context, whose `agents` registry it reads.
 * @param contribute - what to do for one agent.
 */
export function composePerAgent(ctx: Context, contribute: AgentContribution): void {
  const composed = new Map<Agent, () => void>()
  const compose = (agent: Agent): void => {
    const withdraw = contribute(agent)
    if (withdraw === undefined) return
    agent.ctx.effect(() => withdraw)
    composed.set(agent, withdraw)
  }
  ctx.on('agent/created', ({ agent }) => { compose(agent) })
  for (const agent of ctx.agents.list()) compose(agent)
  // Dropped rather than withdrawn: the agent's own scope has already taken
  // the contribution back, and withdrawing twice is a second disposal of a
  // registration that no longer exists.
  ctx.on('agent/disposed', ({ agent }) => { composed.delete(agent) })
  ctx.effect(() => () => {
    for (const withdraw of composed.values()) withdraw()
    composed.clear()
  })
}
