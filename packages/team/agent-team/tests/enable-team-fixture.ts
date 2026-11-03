/** Enable shared tasks before a keyless fixture's first model request. */

import type { Context } from '@lyness/cordis'
import type {} from '@lyness/lyn-agent-team'

/** Services used to select Team mode. */
export const inject = ['agentTeams']

/**
 * Select Team mode for each new root Session.
 * @param ctx - assembled profile context.
 */
export function apply(ctx: Context): void {
  ctx.on('agent/created', async ({ agent }) => {
    if (agent.session.header.parentSession === undefined) await ctx.agentTeams.setEnabled(agent, true)
  })
}
