/**
 * Host Remote owner of the `agentCapabilities` namespace: what one reader's
 * agents may use, and who decided each part of it.
 *
 * Every answer is projected from the registries an agent itself reads, at the
 * moment it is asked. It keeps no list of its own, because a list kept here
 * would be a second answer about capabilities and would disagree with what
 * the agents actually have the first time a composition changed.
 *
 * Models are not here. `session.modelCatalog` already answers which models
 * this deployment routes, and a surface showing them twice would invite the
 * two answers to drift.
 *
 * @module @lyness/lyn-api-agent-capabilities-controller
 */

import { Context } from '@lyness/cordis'
import { Remote, TypertRemoteService } from '@lyness/lyn-typert-protocol'
import type { ToolDefinition } from '@lyness/lyn-tools'
import type {} from '@lyness/lyn-agent-preset-registry'
import type {} from '@lyness/lyn-skill'
import { connectionsOf, toolsOf } from './project.ts'
import type { AgentCapabilitiesView, SkillAvailabilityView } from './types.ts'

export type * from './types.ts'
export { MCP_TOOL_PREFIX, connectionsOf, serverOfToolName, toolsOf } from './project.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** Host owner of the `agentCapabilities` Remote namespace. */
    agentCapabilitiesController: AgentCapabilitiesController
  }
}

/** Host service backing the generated `ctx.remote.agentCapabilities` namespace. */
export default class AgentCapabilitiesController extends TypertRemoteService {
  static inject = ['tools']

  /**
   * Register the namespace.
   * @param ctx - Host context carrying the tool registry; the preset and skill
   * registries are optional and read through `ctx.get`.
   */
  constructor(ctx: Context) {
    super(ctx, 'agentCapabilitiesController', { namespace: 'agentCapabilities', requires: 'member' })
  }

  /**
   * Describe what this reader's agents may use.
   *
   * The preset's own scope is acquired for the read and released after it, so
   * what is reported is the view an agent of that preset would see rather
   * than the deployment's bare registrations. A deployment that mounts no
   * preset registry reports the deployment view, which is the only one it has.
   * @returns the tools, connections and skills available, each naming who gave it.
   */
  @Remote
  async describe(): Promise<AgentCapabilitiesView> {
    const presets = this.ctx.get('agentPresets')
    if (presets === undefined) return this.viewOf(undefined, undefined)
    const scope = await presets.acquireScope()
    try {
      return await this.viewOf(scope.key, presets.defaultId)
    } finally {
      // The lease is a revision retain: releasing it is what lets the preset
      // generation be collected, so it is released even when the read throws.
      await scope[Symbol.asyncDispose]()
    }
  }

  /**
   * Project one scope's registries.
   * @param scope - the preset scope to read, or undefined for the deployment view.
   * @param preset - the preset's identity, when one was acquired.
   * @returns the view this namespace answers.
   */
  private async viewOf(scope: Parameters<typeof this.ctx.tools.definitions>[0], preset: string | undefined):
  Promise<AgentCapabilitiesView> {
    const deployment = this.ctx.tools.definitions()
    const available: readonly ToolDefinition[] = scope === undefined
      ? deployment
      : this.ctx.tools.definitions(scope)
    const fromDeployment = new Set(deployment.map(one => one.name))
    return {
      ...preset === undefined ? {} : { preset },
      tools: toolsOf(available, fromDeployment),
      connections: connectionsOf(available, fromDeployment),
      ...await this.skillsOf(scope),
    }
  }

  /**
   * Project the skills the registry currently discovers.
   *
   * A deployment that mounts no registry reports no `skills` member at all,
   * which a surface reads as "this installation has no skills" rather than as
   * "it discovered none".
   * @param scope - the preset scope whose layers to view.
   * @returns the member to spread into the view.
   */
  private async skillsOf(scope: Parameters<typeof this.ctx.tools.definitions>[0]):
  Promise<{ skills?: readonly SkillAvailabilityView[] }> {
    const registry = this.ctx.get('skills')
    if (registry === undefined) return {}
    const listed = await registry.list(scope === undefined ? {} : { scope })
    return {
      skills: listed.map((skill): SkillAvailabilityView => ({
        name: skill.name,
        description: skill.description,
        origin: skill.source,
        provider: skill.provider,
      })),
    }
  }
}
